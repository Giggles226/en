import type { AIConfig, AIResponse, JudgeResult, RoundRecord, GameRule } from '../../types';

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

// ─── 调用 AI 模型 ───
export async function callAI(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal
): Promise<AIResponse> {
  try {
    const { endpoint, apiKey, modelName, apiType } = config;

    // 本地模型走 Ollama
    if (apiType === 'local') {
      return callLocalAI(config, systemPrompt, userPrompt, signal);
    }

    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let body: Record<string, unknown> = {};

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

    const response = await fetch(endpoint, {
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

// ─── 调用本地 Ollama ───
async function callLocalAI(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal
): Promise<AIResponse> {
  try {
    const endpoint = config.endpoint || 'http://localhost:11434/v1/chat/completions';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
      }),
      signal: signal || AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        modelId: config.id,
        content: '',
        error: `Ollama错误(${response.status}): ${errorText.slice(0, 200)}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return { modelId: config.id, content };
  } catch (err) {
    return {
      modelId: config.id,
      content: '',
      error: `本地LLM调用失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── 同时调用多个模型（带逐模型错误处理） ───
export async function callMultipleAI(
  configs: AIConfig[],
  systemPrompt: string,
  userPrompt: string
): Promise<{ answers: Record<string, string>; quotaErrors: string[] }> {
  const results = await Promise.all(
    configs.map((c) => callAI(c, systemPrompt, userPrompt))
  );

  const answers: Record<string, string> = {};
  const quotaErrors: string[] = [];

  results.forEach((r) => {
    if (r.isQuotaError) {
      answers[r.modelId] = `[额度耗尽] ${r.error || ''}`;
      quotaErrors.push(r.modelId);
    } else if (r.error) {
      answers[r.modelId] = `[错误: ${r.error}]`;
    } else {
      answers[r.modelId] = r.content;
    }
  });

  return { answers, quotaErrors };
}

// ─── 裁判评分（含规则遵守度） ───
export async function judgeAnswers(
  judgeModel: AIConfig,
  gameRule: GameRule,
  question: string,
  answers: Record<string, string>,
  competitorNames: Record<string, { name: string; icon: string }>
): Promise<JudgeResult> {
  const answersText = Object.entries(answers)
    .map(([id, text]) => {
      const info = competitorNames[id];
      return `【${info?.icon || ''} ${info?.name || id}】\n${text}`;
    })
    .join('\n\n');

  const judgePrompt = `你是本次比赛的裁判。请根据以下规则和评分标准，评判各模型的回答。

比赛规则：
${gameRule.rules}

${gameRule.judgeCriteria}

本轮问题：${question}

各模型回答：
${answersText}

请严格按照JSON格式返回（不要加其他文字）：
{
  "scores": { "model_id": 分数 },
  "rankings": ["第1名id", "第2名id", ...],
  "ruleCompliance": { "model_id": 规则遵守度(0-100) },
  "comment": "整体点评（200字以内）"
}`;

  const result = await callAI(judgeModel, '', judgePrompt);

  if (result.error) {
    const defaultScores: Record<string, number> = {};
    const defaultCompliance: Record<string, number> = {};
    const ids = Object.keys(answers);
    ids.forEach((id, i) => {
      defaultScores[id] = Math.max(50, 80 - i * 5);
      defaultCompliance[id] = 70;
    });
    return {
      scores: defaultScores,
      rankings: ids,
      ruleCompliance: defaultCompliance,
      comment: `评分失败：${result.error}`,
    };
  }

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : result.content;
    const parsed = JSON.parse(jsonStr);

    const scores: Record<string, number> = {};
    const ruleCompliance: Record<string, number> = {};
    const knownIds = Object.keys(answers);

    knownIds.forEach((id) => {
      const s = parsed.scores?.[id];
      scores[id] = typeof s === 'number' && s >= 0 && s <= 100 ? s : 60;
      const rc = parsed.ruleCompliance?.[id];
      ruleCompliance[id] = typeof rc === 'number' && rc >= 0 && rc <= 100 ? rc : 60;
    });

    const rankings = Array.isArray(parsed.rankings)
      ? parsed.rankings.filter((r: string) => knownIds.includes(r))
      : knownIds;

    return {
      scores,
      rankings,
      ruleCompliance,
      comment: parsed.comment || result.content,
    };
  } catch {
    const scores: Record<string, number> = {};
    const ruleCompliance: Record<string, number> = {};
    Object.keys(answers).forEach((id) => {
      scores[id] = 70;
      ruleCompliance[id] = 70;
    });
    return {
      scores,
      ruleCompliance,
      rankings: Object.keys(answers),
      comment: result.content,
    };
  }
}

// ─── 检测 Ollama 是否可用 ───
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}