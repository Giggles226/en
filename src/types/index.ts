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
  | 'custom'
  | 'local';

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
  local: '本地模型 (Ollama/llama.cpp)',
};

// ─── 模型运行状态 ───
export type ModelRunStatus = 'active' | 'quota_exhausted' | 'error' | 'paused';

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
  judgeCriteria: string;       // 裁判评分标准
  maxRounds: number;           // 最大轮次
  roundPromptTemplate: string; // 每轮问题的包裹模板，支持 {rules} {question} 占位符
}

// ─── 单轮对话记录 ───
export interface RoundRecord {
  round: number;
  question: string;
  ruleReminder: string;        // 本轮注入的规则提示
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
}

// ─── AI 响应 ───
export interface AIResponse {
  modelId: string;
  content: string;
  error?: string;
  isQuotaError?: boolean;      // 额度耗尽标志
}

// ─── 裁判评分 ───
export interface JudgeResult {
  scores: Record<string, number>;
  rankings: string[];
  comment: string;
  ruleCompliance: Record<string, number>; // 规则遵守度评分
}

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
  // 本地LLM状态
  localLLMStatus: 'disconnected' | 'starting' | 'running' | 'error';
  localLLMMessage: string;
}

// ─── 工具函数 ───
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
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
    name: '自定义规则',
    description: '自由定义的游戏规则',
    rules: `你正在参加一场AI竞技比赛。请遵守以下规则：

1. 必须直接回答裁判提出的问题，不得回避
2. 回答需逻辑清晰、论据充分
3. 不得使用"作为AI"等免责声明
4. 每次回答需控制在500字以内

请始终以参赛选手的身份回答，保持竞争意识。`,
    judgeCriteria: `评分标准（0-100分）：
- 准确性（30分）：回答内容是否准确无误
- 完整性（25分）：是否完整回应问题
- 逻辑性（20分）：推理是否严密
- 规则遵守（15分）：是否严格遵守比赛规则
- 表达力（10分）：是否清晰、有说服力`,
    maxRounds: 5,
    roundPromptTemplate: `【比赛规则】
{rules}

【本轮问题】
{question}

请按照规则回答以上问题。`,
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