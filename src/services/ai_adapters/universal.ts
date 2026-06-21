import type { AIConfig, AIResponse, RoundRecord, GameRule, ChatMessage } from '../../types';
import { resolveApiCredentials } from '../apiKeyManager';

// ─── 额度耗尽检测 ───
const QUOTA_ERROR_PATTERNS = [
  /quota/i, /exceeded/i, /billing/i, /insufficient/i, /balance/i,
  /rate.?limit/i, /too many requests/i, /429/, /402/, /403.*quota/i,
  /账户.*余额/i, /额度.*不足/i, /欠费/i, /limit.*exceeded/i,
];

function isQuotaError(status: number, body: string): boolean {
  if (status === 429 || status === 402) return true;
  if (status === 403 && QUOTA_ERROR_PATTERNS.some((p) => p.test(body))) return true;
  return QUOTA_ERROR_PATTERNS.some((p) => p.test(body));
}

// ─── 额度耗尽信息（冒泡给 Arena 层触发暂停） ───
export interface QuotaError {
  modelId: string;
  modelName: string;
  role: 'judge' | 'competitor';
  message: string;
}

// ─── 构建规则提示词 ───
export function buildRulePrompt(rule: GameRule, question: string): string {
  return rule.roundPromptTemplate
    .replace('{rules}', rule.rules)
    .replace('{question}', question);
}

// ─── 构建恢复上下文（融合压缩摘要 + 上轮详情） ───
export function buildRestoreContext(
  compressedSummary: string,
  lastRound: RoundRecord | null,
  _rule: GameRule
): string {
  const parts: string[] = [];

  if (compressedSummary) {
    parts.push('【历史回合摘要】\n' + compressedSummary);
  }

  if (lastRound) {
    parts.push(
      `\n【上一轮回顾】\n问题: ${lastRound.question}\n裁判点评: ${lastRound.judgeComment}`
    );
  }

  parts.push('\n请继续遵守比赛规则，参加下一轮。');

  return parts.join('\n');
}

// ─── 带重试的 fetch ───
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, init);
      // 5xx 服务端错误可重试，其他状态码直接返回
      if (response.status < 500 || i >= retries) return response;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

// ─── 调用 AI 模型 ───
export async function callAI(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal
): Promise<AIResponse> {
  try {
    const { modelName, apiType } = config;

    // 使用统一 API Key 管理：优先全局配置，回退到模型自带
    const { apiKey, endpoint } = resolveApiCredentials(
      apiType,
      config.apiKey,
      config.endpoint
    );

    if (!apiKey) {
      return {
        modelId: config.id,
        content: '',
        error: `未配置 ${apiType} 的 API Key，请在全局 API Key 设置中配置`,
      };
    }

    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let body: Record<string, unknown> = {};
    let url = endpoint;

    switch (apiType) {
      case 'anthropic':
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        body = {
          model: modelName,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        };
        break;
      case 'google':
        headers['x-goog-api-key'] = apiKey;
        // 替换端点中的 {model} 占位符为实际模型名称
        url = endpoint.replace('{model}', modelName);
        body = {
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
        };
        break;
      default:
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = {
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
        };
        break;
    }

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: signal || AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const quotaErr = isQuotaError(response.status, errorText);

      return {
        modelId: config.id,
        content: '',
        error: `API错误(${response.status}): ${errorText.slice(0, 200)}`,
        isQuotaError: quotaErr,
      };
    }

    const data = await response.json();
    let content = '';

    if (apiType === 'anthropic') {
      content = data.content?.[0]?.text || '';
    } else if (apiType === 'google') {
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      content =
        data.choices?.[0]?.message?.content ||
        data.content ||
        data.data?.answer ||
        '';
    }

    if (!content) {
      return {
        modelId: config.id,
        content: '',
        error: '解析响应失败',
      };
    }

    return { modelId: config.id, content };
  } catch (err) {
    return {
      modelId: config.id,
      content: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// 裁判 Agent 模式：私人对话 + 淘汰判定
// ═══════════════════════════════════════════════════════════════

// ─── 裁判 Agent 与单个博弈模型进行私人对话 ───
export async function judgeAgentPrivateChat(
  judgeModel: AIConfig,
  competitor: AIConfig,
  gameRule: GameRule,
  question: string,
  previousMessages: ChatMessage[],
  turnIndex: number,
  restoreContext?: string
): Promise<{
  judgeMessage: string;
  competitorResponse: string;
  isConversationEnd: boolean;
  shouldEliminate: boolean;
  eliminateReason: string;
  quotaError?: QuotaError;
}> {
  const maxTurns = gameRule.maxPrivateTurns || 3;

  // 构建裁判的系统提示
  const judgeSystemPrompt = `你是本场生存博弈的裁判Agent。你正在与参赛模型"${competitor.name}(${competitor.icon})"进行不公开的私人对话。

你的职责：
1. 根据游戏规则与参赛模型对话，测试其逻辑、策略和规则遵守度
2. 判断该模型是否违反游戏规则，决定是否淘汰
3. 对话内容对其他模型完全不可见

游戏规则：
${gameRule.rules}

淘汰标准：
${gameRule.judgeCriteria}

当前是第${turnIndex + 1}/${maxTurns}轮对话。${restoreContext ? '\n\n' + restoreContext : ''}`;

  // 构建对话历史
  let conversationHistory = '';
  if (previousMessages.length > 0) {
    conversationHistory = '\n对话历史：\n' + previousMessages.map(m =>
      `[${m.role === 'judge' ? '裁判' : competitor.name}]: ${m.content}`
    ).join('\n');
  }

  const judgePrompt = `本轮问题：${question}
${conversationHistory}

请向参赛模型"${competitor.name}"发送一条消息。你可以：
- 提问测试其逻辑
- 给出情景考验其策略
- 检查其是否遵守规则

如果这是最后一轮对话（第${turnIndex + 1}/${maxTurns}轮），请判断是否淘汰该模型。

请严格按照JSON格式返回（不要加其他文字）：
{
  "message": "你发送给参赛模型的消息内容",
  "isConversationEnd": true或false（是否结束与这个模型的对话）,
  "shouldEliminate": true或false（是否淘汰该模型）,
  "eliminateReason": "如果淘汰，给出原因；否则为空字符串"
}`;

  // 裁判发消息
  const judgeResult = await callAI(judgeModel, judgeSystemPrompt, judgePrompt);

  // 额度耗尽冒泡（裁判模型）
  if (judgeResult.isQuotaError) {
    return {
      judgeMessage: '',
      competitorResponse: '',
      isConversationEnd: true,
      shouldEliminate: false,
      eliminateReason: '',
      quotaError: {
        modelId: judgeModel.id,
        modelName: judgeModel.name,
        role: 'judge',
        message: judgeResult.error || '裁判模型额度耗尽',
      },
    };
  }

  let judgeMessage = '';
  let isConversationEnd = turnIndex >= maxTurns - 1;
  let shouldEliminate = false;
  let eliminateReason = '';

  if (judgeResult.error) {
    judgeMessage = `[裁判Agent错误: ${judgeResult.error}]`;
    isConversationEnd = true;
  } else {
    try {
      const jsonMatch = judgeResult.content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : judgeResult.content;
      const parsed = JSON.parse(jsonStr);
      judgeMessage = parsed.message || '请继续参与比赛。';
      isConversationEnd = parsed.isConversationEnd ?? (turnIndex >= maxTurns - 1);
      shouldEliminate = parsed.shouldEliminate ?? false;
      eliminateReason = parsed.eliminateReason || '';
    } catch {
      judgeMessage = judgeResult.content;
    }
  }

  // 参赛模型回复
  const competitorSystemPrompt = `你是参赛选手"${competitor.name}"。你正在参加一场生存博弈比赛。

游戏规则：
${gameRule.rules}

重要提示：
- 裁判正在与你进行私人对话，其他参赛模型看不到这段对话
- 你必须如实、认真回答裁判的问题
- 不要使用"作为AI"等免责声明
- 保持竞争意识，争取不被淘汰

${gameRule.roundPromptTemplate.replace('{rules}', gameRule.rules).replace('{question}', question)}${restoreContext ? '\n\n' + restoreContext : ''}`;

  const competitorResult = await callAI(competitor, competitorSystemPrompt, judgeMessage);

  // 额度耗尽冒泡（参赛模型）—— 保留已生成的裁判消息
  if (competitorResult.isQuotaError) {
    return {
      judgeMessage,
      competitorResponse: '',
      isConversationEnd: true,
      shouldEliminate: false,
      eliminateReason: '',
      quotaError: {
        modelId: competitor.id,
        modelName: competitor.name,
        role: 'competitor',
        message: competitorResult.error || '参赛模型额度耗尽',
      },
    };
  }

  let competitorResponse = competitorResult.error
    ? `[回答错误: ${competitorResult.error}]`
    : competitorResult.content;

  return {
    judgeMessage,
    competitorResponse,
    isConversationEnd,
    shouldEliminate,
    eliminateReason,
  };
}

// ─── 裁判 Agent 进行淘汰判定（汇总所有私人对话后） ───
export async function judgeAgentDeliberate(
  judgeModel: AIConfig,
  gameRule: GameRule,
  survivors: AIConfig[],
  eliminatedModels: string[],
  privateChats: { competitorId: string; competitorName: string; messages: ChatMessage[] }[],
  question: string,
  roundNumber: number,
  restoreContext?: string
): Promise<{
  eliminatedThisRound: string[];
  eliminationReasons: Record<string, string>;
  deliberationComment: string;
  quotaError?: QuotaError;
}> {
  const survivorsList = survivors.map(s => `- ${s.icon} ${s.name} (${s.id})`).join('\n');

  const chatSummaries = privateChats.map(chat => {
    const summary = chat.messages.map(m =>
      `[${m.role === 'judge' ? '裁判' : chat.competitorName}]: ${m.content.slice(0, 150)}${m.content.length > 150 ? '...' : ''}`
    ).join('\n');
    return `【${chat.competitorName}的对话】\n${summary}`;
  }).join('\n\n---\n\n');

  const judgePrompt = `你是本场生存博弈的裁判Agent。本轮私人对话已结束，请做出淘汰判定。

游戏规则：
${gameRule.rules}

淘汰标准：
${gameRule.judgeCriteria}

当前轮次：第${roundNumber + 1}轮
当前问题：${question}

存活模型：
${survivorsList}

已淘汰模型：${eliminatedModels.length > 0 ? eliminatedModels.join(', ') : '无'}

本轮私人对话摘要：
${chatSummaries}

请根据游戏规则和对话内容，做出淘汰判定。淘汰的模型将被禁言，不能公开发言，但可以继续与你私下交流。

请严格按照JSON格式返回（不要加其他文字）：
{
  "eliminatedThisRound": ["被淘汰的模型ID列表"],
  "eliminationReasons": { "模型ID": "淘汰原因" },
  "deliberationComment": "你的判定总结（200字以内）"
}${restoreContext ? '\n\n' + restoreContext : ''}`;

  const result = await callAI(judgeModel, '', judgePrompt);

  // 额度耗尽冒泡
  if (result.isQuotaError) {
    return {
      eliminatedThisRound: [],
      eliminationReasons: {},
      deliberationComment: '',
      quotaError: {
        modelId: judgeModel.id,
        modelName: judgeModel.name,
        role: 'judge',
        message: result.error || '裁判模型额度耗尽',
      },
    };
  }

  if (result.error) {
    return {
      eliminatedThisRound: [],
      eliminationReasons: {},
      deliberationComment: `判定失败：${result.error}`,
    };
  }

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : result.content;
    const parsed = JSON.parse(jsonStr);

    return {
      eliminatedThisRound: Array.isArray(parsed.eliminatedThisRound) ? parsed.eliminatedThisRound : [],
      eliminationReasons: parsed.eliminationReasons || {},
      deliberationComment: parsed.deliberationComment || result.content,
    };
  } catch {
    return {
      eliminatedThisRound: [],
      eliminationReasons: {},
      deliberationComment: result.content,
    };
  }
}

// ─── 裁判 Agent 公共发言 ───
export async function judgeAgentPublicAnnounce(
  judgeModel: AIConfig,
  gameRule: GameRule,
  survivors: AIConfig[],
  eliminatedModels: string[],
  eliminatedThisRound: string[],
  eliminationReasons: Record<string, string>,
  question: string,
  roundNumber: number,
  allCompetitors: AIConfig[],
  restoreContext?: string
): Promise<{ content: string; quotaError?: QuotaError }> {
  const survivorsList = survivors.map(s => `- ${s.icon} ${s.name}`).join('\n');
  const eliminatedList = allCompetitors
    .filter(c => eliminatedModels.includes(c.id))
    .map(c => `- ${c.icon} ${c.name}（${eliminationReasons[c.id] || '被淘汰'}）`)
    .join('\n');

  const judgePrompt = `你是本场生存博弈的裁判Agent。请进行公共发言。

游戏规则：
${gameRule.rules}

当前轮次：第${roundNumber + 1}轮
当前问题：${question}

存活模型（${survivors.length}人）：
${survivorsList}

本轮淘汰（${eliminatedThisRound.length}人）：
${eliminatedList}

请进行公共发言，内容包括：
1. 宣布本轮淘汰结果
2. 告知存活模型当前游戏规则（确保所有存活模型遵守规则）
3. 鼓励存活模型继续竞争

发言要求：
- 有气势，有仪式感
- 明确告知存活模型必须遵守的规则
- 对淘汰模型给予简短评价
- 200字以内

请直接返回发言内容，不要加JSON格式或其他标记。${restoreContext ? '\n\n' + restoreContext : ''}`;

  const result = await callAI(judgeModel, '', judgePrompt);

  // 额度耗尽冒泡
  if (result.isQuotaError) {
    return {
      content: '',
      quotaError: {
        modelId: judgeModel.id,
        modelName: judgeModel.name,
        role: 'judge',
        message: result.error || '裁判模型额度耗尽',
      },
    };
  }

  if (result.error) {
    return { content: `[裁判公共发言失败: ${result.error}]` };
  }

  return { content: result.content };
}
