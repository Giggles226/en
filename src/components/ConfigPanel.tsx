import { useState, useEffect } from 'react';
import { useArenaStore, createEmptyConfig } from '../stores/arenaStore';
import type { AIConfig, ApiType, ApiKeyConfig } from '../types';
import { API_TYPE_LABELS } from '../types';
import { DEFAULT_ENDPOINTS, getAllApiKeyConfigs, saveApiKeyConfig, deleteApiKeyConfig } from '../services/apiKeyManager';

const API_TYPES: ApiType[] = [
  'openai', 'anthropic', 'google', 'volcengine', 'baidu',
  'alibaba', 'hunyuan', 'moonshot', 'zhipu', 'stepfun',
  'custom',
];

// ─── 全局 API Key 设置 ───
function GlobalApiKeySettings() {
  const [open, setOpen] = useState(false);
  const [configs, setConfigs] = useState<ApiKeyConfig[]>([]);
  const [editingType, setEditingType] = useState<Exclude<ApiType, 'custom'> | null>(null);
  const [form, setForm] = useState<ApiKeyConfig>({ apiType: 'openai', apiKey: '', endpoint: '' });

  const refreshConfigs = () => setConfigs(getAllApiKeyConfigs());

  useEffect(() => {
    if (open) refreshConfigs();
  }, [open]);

  const handleEdit = (apiType: Exclude<ApiType, 'custom'>) => {
    const existing = configs.find((c) => c.apiType === apiType);
    setForm({
      apiType,
      apiKey: existing?.apiKey || '',
      endpoint: existing?.endpoint || '',
    });
    setEditingType(apiType);
  };

  const handleSave = () => {
    if (!form.apiKey.trim()) return;
    saveApiKeyConfig({ ...form });
    refreshConfigs();
    setEditingType(null);
  };

  const handleDelete = (apiType: Exclude<ApiType, 'custom'>) => {
    deleteApiKeyConfig(apiType);
    refreshConfigs();
  };

  const hasKey = (apiType: Exclude<ApiType, 'custom'>) => {
    const cfg = configs.find((c) => c.apiType === apiType);
    return !!(cfg && cfg.apiKey.trim());
  };

  const configuredCount = configs.filter((c) => c.apiKey.trim()).length;

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🔑</span>
          <div>
            <h3 className="font-bold text-white text-sm">全局 API Key</h3>
            <p className="text-xs text-slate-500">{configuredCount} / {Object.keys(DEFAULT_ENDPOINTS).length} 个已配置</p>
          </div>
        </div>
        <button onClick={() => setOpen(true)} className="glass-btn-sm">
          管理
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-card p-5 md:p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-white">🔑 全局 API Key 管理</h3>
              <button onClick={() => { setOpen(false); setEditingType(null); }}
                className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              在此统一配置各平台的 API Key，所有使用该平台的模型将自动共享。模型自身也可覆盖单独的 Key。
            </p>

            <div className="space-y-2 mb-4">
              {(Object.keys(DEFAULT_ENDPOINTS) as Array<Exclude<ApiType, 'custom'>>).map((apiType) => {
                const configured = hasKey(apiType);
                return (
                  <div key={apiType}
                    className={`rounded-2xl p-3 flex items-center gap-3 transition border ${
                      configured ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-900/30 border-white/5'
                    }`}>
                    <span className={`text-lg ${configured ? '' : 'opacity-40'}`}>
                      {configured ? '🔑' : '🔒'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{API_TYPE_LABELS[apiType]}</p>
                      <p className="text-xs text-slate-500">{configured ? '已配置' : '未配置'}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleEdit(apiType)}
                        className="glass-btn-sm">
                        {configured ? '编辑' : '设置'}
                      </button>
                      {configured && (
                        <button onClick={() => handleDelete(apiType)}
                          className="glass-btn-sm text-red-400 hover:bg-red-500/10 hover:border-red-500/30">
                          清除
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {editingType && (
              <div className="bg-slate-900/40 rounded-2xl p-4 border border-amber-500/20">
                <h4 className="text-sm font-bold text-amber-400 mb-3">
                  设置 {API_TYPE_LABELS[editingType]}
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">API Key</label>
                    <input type="password" value={form.apiKey}
                      onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="glass-input w-full text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">自定义端点（可选）</label>
                    <input type="text" value={form.endpoint}
                      onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                      placeholder={DEFAULT_ENDPOINTS[editingType]}
                      className="glass-input w-full text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSave} disabled={!form.apiKey.trim()}
                      className="glass-btn-primary flex-1 py-2.5 text-sm">
                      保存
                    </button>
                    <button onClick={() => setEditingType(null)}
                      className="glass-btn flex-1 py-2.5 text-sm">
                      取消
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── 模型编辑弹窗 ───
function ModelEditor({
  model,
  title,
  onSave,
  onCancel,
}: {
  model: Omit<AIConfig, 'id'>;
  title: string;
  onSave: (model: Omit<AIConfig, 'id'>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<AIConfig, 'id'>>({ ...model });
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    if (!form.name.trim() || !form.modelName.trim()) return;
    onSave(form);
  };

  return (
    <div className="glass-card p-5 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">显示名称</label>
          <input type="text" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="例如: GPT-4o"
            className="glass-input w-full" />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">API 类型</label>
          <select value={form.apiType}
            onChange={(e) => setForm({ ...form, apiType: e.target.value as ApiType })}
            className="glass-input w-full">
            {API_TYPES.map((t) => (
              <option key={t} value={t} className="bg-slate-900">{API_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">API 地址</label>
          <input type="text" value={form.endpoint}
            onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
            placeholder="https://api.openai.com/v1/chat/completions"
            className="glass-input w-full text-sm" />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">
            API 密钥 <span className="text-slate-600">（留空使用全局配置）</span>
          </label>
          <div className="relative">
            <input type={showKey ? 'text' : 'password'} value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="留空则使用全局 API Key..."
              className="glass-input w-full pr-12" />
            <button type="button" onClick={() => setShowKey(!showKey)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-lg">
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">模型名称</label>
          <input type="text" value={form.modelName}
            onChange={(e) => setForm({ ...form, modelName: e.target.value })}
            placeholder="例如: gpt-4o"
            className="glass-input w-full text-sm" />
        </div>

        <button onClick={handleSave}
          disabled={!form.name.trim() || !form.modelName.trim()}
          className="glass-btn-primary w-full mt-2">
          保存
        </button>
      </div>
    </div>
  );
}

// ─── 状态徽章 ───
function StatusBadge({ status }: { status: AIConfig['runStatus'] }) {
  const config: Record<string, { label: string; cls: string }> = {
    active: { label: '运行中', cls: 'glass-badge-green' },
    quota_exhausted: { label: '额度耗尽', cls: 'glass-badge-red' },
    error: { label: '错误', cls: 'glass-badge-red' },
    paused: { label: '已暂停', cls: 'glass-badge-amber' },
    eliminated: { label: '已淘汰', cls: 'bg-red-600/20 border border-red-500/30 text-red-300' },
  };
  const c = config[status] || config.active;
  return <span className={c.cls}>{c.label}</span>;
}

export function ConfigPanel() {
  const {
    competitors, judgeModel,
    addCompetitor, removeCompetitor, updateCompetitor,
    setJudgeModel, clearJudge,
  } = useArenaStore();

  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingJudge, setEditingJudge] = useState(false);

  const handleAdd = (form: Omit<AIConfig, 'id'>) => {
    addCompetitor(form);
    setAddingNew(false);
  };

  const handleSaveEdit = (id: string, form: Omit<AIConfig, 'id'>) => {
    updateCompetitor(id, { ...form, runStatus: 'active' });
    setEditingId(null);
  };

  const handleSaveJudge = (form: Omit<AIConfig, 'id'>) => {
    if (judgeModel) {
      setJudgeModel({ ...form, id: judgeModel.id, runStatus: 'active' });
    }
    setEditingJudge(false);
  };

  return (
    <div className="space-y-4">
      {/* 全局 API Key */}
      <GlobalApiKeySettings />

      <div className="glass-divider" />

      {/* 裁判模型 */}
      {judgeModel ? (
        <div className="rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <span className="text-base">👑</span> 裁判模型
            </h3>
            <StatusBadge status={judgeModel.runStatus} />
          </div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{judgeModel.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate">{judgeModel.name}</p>
              <p className="text-xs text-slate-400 truncate">{judgeModel.modelName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditingJudge(true)} className="glass-btn-sm flex-1">编辑</button>
            <button onClick={clearJudge} className="glass-btn-sm flex-1 text-red-400 hover:bg-red-500/10 hover:border-red-500/30">取消</button>
          </div>
        </div>
      ) : null}

      {/* 参赛模型列表 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            🤖 参赛模型
            <span className="text-slate-500 font-normal text-xs">({competitors.length}/24)</span>
          </h3>
          <button onClick={() => { setAddingNew(true); setEditingId(null); }}
            className="glass-btn-primary py-2 px-4 text-sm">
            + 添加
          </button>
        </div>

        {competitors.length === 0 && !addingNew ? (
          <p className="text-slate-600 text-center py-6 text-sm">还没有模型，点击上方按钮添加</p>
        ) : (
          <div className="space-y-2">
            {competitors.map((comp) => (
              <div key={comp.id}
                className="rounded-2xl p-3 flex items-center gap-3 transition hover:bg-white/[0.02] border border-white/5 bg-slate-900/20">
                <span className="text-2xl">{comp.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate text-sm">{comp.name}</p>
                  <p className="text-xs text-slate-500 truncate">{comp.modelName}</p>
                </div>
                <StatusBadge status={comp.runStatus} />
                <div className="flex gap-1">
                  <button onClick={() => setJudgeModel(comp)}
                    className="text-xs text-amber-400 hover:bg-amber-500/10 px-2 py-1.5 rounded-full transition">👑</button>
                  <button onClick={() => { setEditingId(comp.id); setAddingNew(false); }}
                    className="text-xs text-slate-400 hover:bg-white/5 px-2 py-1.5 rounded-full transition">✏️</button>
                  <button onClick={() => removeCompetitor(comp.id)}
                    className="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1.5 rounded-full transition">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 弹窗 */}
      {addingNew && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <ModelEditor model={{ ...createEmptyConfig() }} title="添加参赛模型"
              onSave={handleAdd} onCancel={() => setAddingNew(false)} />
          </div>
        </div>
      )}

      {editingId && competitors.find((c) => c.id === editingId) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <ModelEditor model={{ ...competitors.find((c) => c.id === editingId)! }}
              title="编辑模型配置" onSave={(f) => handleSaveEdit(editingId, f)}
              onCancel={() => setEditingId(null)} />
          </div>
        </div>
      )}

      {editingJudge && judgeModel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <ModelEditor model={{ ...judgeModel }} title="编辑裁判模型"
              onSave={handleSaveJudge} onCancel={() => setEditingJudge(false)} />
          </div>
        </div>
      )}
    </div>
  );
}