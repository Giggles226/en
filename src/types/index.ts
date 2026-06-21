// ─── API 类型 ───
export type ApiType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'volcengine'
  | 'baidu'
  | 'alibaba'
  | 'hunyuan'
  | 'moonshot'
  | 'zhipu'
  | 'stepfun'
  | 'custom';

export const API_TYPE_LABELS: Record<ApiType, string> = {
  openai: 'OpenAI 兼容',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
  volcengine: '火山引擎 (豆包)',
  baidu: '百度 (文心一言)',
  alibaba: '阿里 (通义千问)',
  hunyuan: '腾讯 (混元)',
  moonshot: '月之暗面 (Kimi)',
  zhipu: '智谱AI',
  stepfun: '阶跃星辰',
  custom: '自定义',
};

// ─── 全局 API Key 配置（CC Switch 风格统一管理） ───
export interface ApiKeyConfig {
  apiType: Exclude<ApiType, 'custom'>;
  apiKey: string;
  endpoint: string; // 自定义端点，留空则使用默认
}

// ─── 模型运行状态 ───
export type ModelRunStatus = 'active' | 'quota_exhausted' | 'error' | 'paused' | 'eliminated';

// ─── 模型配置 ───
export interface AIConfig {
  id: string;
  name: string;
  apiType: ApiType;
  endpoint: string;
  apiKey: string;
  modelName: string;
  color: string;
  icon: string;
  runStatus: ModelRunStatus;
  lastError?: string;
}

// ─── 游戏规则 ───
export interface GameRule {
  id: string;
  name: string;
  description: string;
  rules: string;              // 完整规则文本，每轮注入给参赛模型
  judgeCriteria: string;       // 裁判淘汰/存活判定标准
  maxRounds: number;           // 最大轮次
  roundPromptTemplate: string; // 每轮问题的包裹模板，支持 {rules} {question} 占位符
  // 新增：私人对话和淘汰规则
  eliminationRules: string;    // 淘汰规则描述
  maxPrivateTurns: number;     // 每轮每个模型的私人对话最大回合数
}

// ─── 聊天消息（私人对话） ───
export interface ChatMessage {
  id: string;
  role: 'judge' | 'competitor';
  content: string;
  timestamp: number;
}

// ─── 私人对话（裁判与单个博弈模型） ───
export interface PrivateChat {
  competitorId: string;
  messages: ChatMessage[];
  isActive: boolean; // 是否仍在进行中
}

// ─── 公共发言 ───
export interface PublicMessage {
  id: string;
  from: string;       // 'judge' 或 modelId
  fromName: string;
  fromIcon: string;
  content: string;
  timestamp: number;
  visibleTo: 'all' | 'survivors'; // 对所有人可见 或 仅存活者可见
}

// ─── 单轮对话记录 ───
export interface RoundRecord {
  round: number;
  question: string;
  ruleReminder: string;        // 本轮注入的规则提示
  privateChats: PrivateChat[];  // 本轮所有私人对话
  publicMessages: PublicMessage[]; // 本轮公共发言
  eliminatedThisRound: string[];  // 本轮被淘汰的模型ID
  answers: Record<string, string>;
  scores: Record<string, number>;
  judgeComment: string;
  timestamp: number;
}

// ─── 游戏快照（用于暂停恢复） ───
export interface GameSnapshot {
  id: string;
  createdAt: number;
  label: string;
  competitors: AIConfig[];
  judgeModel: AIConfig | null;
  gameRule: GameRule;
  rounds: RoundRecord[];
  totalScores: Record<string, number>;
  currentRound: number;
  // 压缩后的上下文摘要（用于恢复时节省token）
  compressedSummary: string;
  // 哪个模型触发了暂停
  pausedModelId: string | null;
  pausedReason: string;
  // 淘汰列表
  eliminatedModels: string[];
  // 恢复接续所需的本轮中间状态
  phase: GamePhase;
  question: string;
  privateChats: PrivateChat[];
  publicMessages: PublicMessage[];
  currentConversationId: string | null;
  eliminationReasons: Record<string, string>;
  judgeComment: string;
  scores: Record<string, number>;
}

// ─── AI 响应 ───
export interface AIResponse {
  modelId: string;
  content: string;
  error?: string;
  isQuotaError?: boolean;      // 额度耗尽标志
}

// ─── 裁判评分/淘汰结果 ───
export interface JudgeResult {
  scores: Record<string, number>;
  rankings: string[];
  comment: string;
  ruleCompliance: Record<string, number>; // 规则遵守度评分
}

// ─── 裁判Agent对话结果 ───
export interface JudgeAgentResult {
  privateConversations: {
    competitorId: string;
    messages: { role: 'judge' | 'competitor'; content: string }[];
  }[];
  eliminatedThisRound: string[];
  eliminationReasons: Record<string, string>;
  publicAnnouncement: string;
}

// ─── 游戏阶段 ───
export type GamePhase =
  | 'idle'
  | 'judge_reading_rules'
  | 'private_conversations'
  | 'judge_deliberation'
  | 'public_announcement'
  | 'round_end'
  | 'paused'
  | 'game_over';

// ─── 游戏状态 ───
export type GameStatus =
  | 'idle'
  | 'configuring'
  | 'loading'
  | 'judging'
  | 'finished'
  | 'paused';

// ─── 竞技场总状态 ───
export interface ArenaState {
  status: GameStatus;
  phase: GamePhase;
  round: number;
  gameRule: GameRule;
  question: string;
  competitors: AIConfig[];
  judgeModel: AIConfig | null;
  answers: Record<string, string>;
  scores: Record<string, number>;
  judgeComment: string;
  totalScores: Record<string, number>;
  error: string | null;
  // 本轮对话历史（用于快照）
  roundHistory: RoundRecord[];
  // 新增：私人对话
  privateChats: PrivateChat[];
  // 新增：公共发言
  publicMessages: PublicMessage[];
  // 新增：淘汰列表
  eliminatedModels: string[];
  // 新增：当前正在对话的模型ID
  currentConversationId: string | null;
  // 新增：淘汰原因
  eliminationReasons: Record<string, string>;
}

// ─── 工具函数 ───
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function generateChatMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function createEmptyConfig(): Omit<AIConfig, 'id'> {
  return {
    name: '',
    apiType: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    modelName: 'gpt-4o',
    color: '#3B82F6',
    icon: '🤖',
    runStatus: 'active',
    lastError: undefined,
  };
}

export function createDefaultGameRule(): GameRule {
  return {
    id: generateId(),
    name: '生存博弈',
    description: '多模型生存博弈，裁判Agent主持淘汰',
    rules: `你正在参加一场AI生存博弈比赛。请遵守以下规则：

1. 裁判会与你进行私人对话，你必须如实回答裁判的问题
2. 不得在对话中透露其他模型的信息（因为你不知道其他模型的情况）
3. 不得使用"作为AI"等免责声明
4. 每次回答需逻辑清晰、论据充分
5. 遵守裁判给出的所有指示
6. 如果你被淘汰，你将无法公开发言，但可以继续与裁判私下交流

请始终以参赛选手的身份回答，保持竞争意识。`,
    judgeCriteria: `淘汰判定标准：
- 违反游戏规则：直接淘汰
- 逻辑严重矛盾：扣分，累计违规淘汰
- 拒绝回答裁判问题：直接淘汰
- 试图作弊或欺骗裁判：直接淘汰
- 回答质量低下：警告，累计警告淘汰

存活判定标准：
- 严格遵守游戏规则
- 回答逻辑清晰、有说服力
- 展现出策略思维`,
    maxRounds: 5,
    roundPromptTemplate: `【比赛规则】
{rules}

【本轮问题】
{question}

请按照规则回答以上问题。`,
    eliminationRules: `你是本场生存博弈的裁判Agent。你需要：
1. 与每个存活的参赛模型进行不公开的私人对话
2. 根据游戏规则判断哪些模型应该被淘汰
3. 被淘汰的模型将被禁言，不能公开发言，但可以继续与你私下交流
4. 确保所有存活模型都遵守游戏规则
5. 每轮结束后进行公共发言，告知所有模型当前状态

淘汰规则：直接淘汰违规者，不留情面。`,
    maxPrivateTurns: 3,
  };
}

export function createSnapshotId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

const COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899',
  '#6366F1', '#10B981', '#F59E0B', '#84CC16',
];

const ICONS = ['🤖', '🧠', '⚡', '🔥', '💎', '🌟', '🎯', '💫'];

export function pickColor(index: number): string {
  return COLORS[index % COLORS.length];
}

export function pickIcon(index: number): string {
  return ICONS[index % ICONS.length];
}