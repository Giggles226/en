import type { ApiType, ApiKeyConfig } from '../types';

// ─── 默认 API 端点 ───
export const DEFAULT_ENDPOINTS: Record<Exclude<ApiType, 'custom'>, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  google: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  baidu: 'https://qianfan.baidubce.com/v2/chat/completions',
  alibaba: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  hunyuan: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
  moonshot: 'https://api.moonshot.cn/v1/chat/completions',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  stepfun: 'https://api.stepfun.com/v1/chat/completions',
};

const STORAGE_KEY = 'ai-tavern-api-keys';

// ─── 从 localStorage 读取/写入 API Key 配置 ───
function loadApiKeys(): ApiKeyConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveApiKeys(configs: ApiKeyConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

// ─── 获取所有已配置的 API Key ───
export function getAllApiKeyConfigs(): ApiKeyConfig[] {
  return loadApiKeys();
}

// ─── 根据 apiType 获取 API Key 配置 ───
export function getApiKeyConfig(apiType: ApiType): ApiKeyConfig | undefined {
  if (apiType === 'custom') return undefined;
  const configs = loadApiKeys();
  return configs.find((c) => c.apiType === apiType);
}

// ─── 保存/更新某个 API 类型的 Key 配置 ───
export function saveApiKeyConfig(config: ApiKeyConfig): void {
  const configs = loadApiKeys();
  const idx = configs.findIndex((c) => c.apiType === config.apiType);
  if (idx >= 0) {
    configs[idx] = config;
  } else {
    configs.push(config);
  }
  saveApiKeys(configs);
}

// ─── 删除某个 API 类型的 Key 配置 ───
export function deleteApiKeyConfig(apiType: ApiType): void {
  const configs = loadApiKeys().filter((c) => c.apiType !== apiType);
  saveApiKeys(configs);
}

// ─── 检查某个 API 类型是否已配置 Key ───
export function hasApiKey(apiType: ApiType): boolean {
  if (apiType === 'custom') return false;
  const cfg = getApiKeyConfig(apiType);
  return !!(cfg && cfg.apiKey.trim());
}

// ─── 获取 API 调用所需的凭证（优先使用全局配置，回退到模型自带） ───
export function resolveApiCredentials(
  apiType: ApiType,
  modelApiKey: string,
  modelEndpoint: string
): { apiKey: string; endpoint: string } {
  // custom 类型始终使用模型自带的配置
  if (apiType === 'custom') {
    return {
      apiKey: modelApiKey,
      endpoint: modelEndpoint,
    };
  }

  // 其他类型：优先使用全局 API Key 配置
  const global = getApiKeyConfig(apiType);
  const apiKey = global?.apiKey?.trim() || modelApiKey;
  const endpoint = global?.endpoint?.trim() || modelEndpoint || DEFAULT_ENDPOINTS[apiType] || '';

  return { apiKey, endpoint };
}