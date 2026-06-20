import { useState } from 'react';
import { useArenaStore, createEmptyConfig } from '../stores/arenaStore';
import type { AIConfig, ApiType } from '../types';
import { API_TYPE_LABELS } from '../types';
import { checkOllamaHealth } from '../services/ai_adapters/universal';

const API_TYPES: ApiType[] = [
  'openai', 'anthropic', 'google', 'volcengine', 'baidu',
  'alibaba', 'hunyuan', 'moonshot', 'zhipu', 'stepfun',
  'custom', 'local',
];

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
  const isLocal = form.apiType === 'local';

  const handleSave = () => {
    if (!form.name.trim() || !form.modelName.trim()) return;
    if (!isLocal && !form.apiKey.trim()) return;
    onSave(form);
  };

  return (
    <div className="bg-slate-800/95 backdrop-blur-lg rounded-3xl p-5 border border-slate-700 shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1.5 font-medium">显示名称</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="例如: GPT-4o" className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-base" />
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1.5 font-medium">API类型</label>
          <select value={form.apiType}
            onChange={(e) => {
              const t = e.target.value as ApiType;
              setForm({
                ...form,
                apiType: t,
                endpoint: t === 'local' ? 'http://localhost:11434/v1/chat/completions' : form.endpoint,
              });
            }}
            className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:border-blue-500 transition text-base">
            {API_TYPES.map((t) => (
              <option key={t} value={t}>{API_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {!isLocal && (
          <div>
            <label className="block text-sm text-slate-300 mb-1.5 font-medium">API地址</label>
            <input type="text" value={form.endpoint}
              onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
              placeholder="https://api.openai.com/v1/chat/completions"
              className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm" />
          </div>
        )}

        {!isLocal && (
          <div>
            <label className="block text-sm text-slate-300 mb-1.5 font-medium">API密钥 ⭐</label>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3.5 pr-12 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-base" />
              <button type="button" onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-lg">
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
            {!form.apiKey.trim() && (
              <p className="text-xs text-amber-400 mt-1.5">⚠️ 请务必填入API Key</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm text-slate-300 mb-1.5 font-medium">模型名称</label>
          <input type="text" value={form.modelName}
            onChange={(e) => setForm({ ...form, modelName: e.target.value })}
            placeholder={isLocal ? '例如: qwen2.5:7b, llama3.2:3b' : '例如: gpt-4o'}
            className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm" />
          {isLocal && (
            <p className="text-xs text-slate-500 mt-1.5">
              需要先运行 Ollama 并下载模型：ollama pull {form.modelName || 'qwen2.5:7b'}
            </p>
          )}
        </div>

        <button onClick={handleSave}
          disabled={!form.name.trim() || (!isLocal && !form.apiKey.trim()) || !form.modelName.trim()}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition mt-3">
          保存
        </button>
      </div>
    </div>
  );
}

// 状态标签
function StatusBadge({ status }: { status: AIConfig['runStatus'] }) {
  const config: Record<string, { label: string; cls: string }> = {
    active: { label: '运行中', cls: 'bg-green-500/20 text-green-400' },
    quota_exhausted: { label: '额度耗尽', cls: 'bg-red-500/20 text-red-400' },
    error: { label: '错误', cls: 'bg-red-500/20 text-red-400' },
    paused: { label: '已暂停', cls: 'bg-amber-500/20 text-amber-400' },
  };
  const c = config[status] || config.active;
  return <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${c.cls}`}>{c.label}</span>;
}

export function ConfigPanel() {
  const {
    competitors, judgeModel, localLLMStatus, localLLMMessage,
    addCompetitor, removeCompetitor, updateCompetitor,
    setJudgeModel, clearJudge, setLocalLLMStatus,
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

  const checkOllama = async () => {
    setLocalLLMStatus('starting', '正在检测 Ollama...');
    const ok = await checkOllamaHealth();
    setLocalLLMStatus(ok ? 'running' : 'error', ok ? 'Ollama 已连接' : 'Ollama 未连接，请确认已启动');
  };

  return (
    <div className="space-y-4">
      {/* 本地 LLM 状态 */}
      <div className="bg-slate-800/60 backdrop-blur-md rounded-3xl p-4 border border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🖥️</span>
            <div>
              <p className="text-sm font-bold text-white">本地 LLM</p>
              <p className={`text-xs ${
                localLLMStatus === 'running' ? 'text-green-400' :
                localLLMStatus === 'error' ? 'text-red-400' :
                localLLMStatus === 'starting' ? 'text-amber-400' : 'text-slate-400'
              }`}>
                {localLLMStatus === 'running' ? '✅ 已连接' :
                 localLLMStatus === 'error' ? '❌ 离线' :
                 localLLMStatus === 'starting' ? '⏳ 检测中...' : '⚪ 未检测'}
                {localLLMMessage && ` - ${localLLMMessage}`}
              </p>
            </div>
          </div>
          <button onClick={checkOllama}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-xl transition">
            检测
          </button>
        </div>
      </div>

      {/* 裁判模型 */}
      {judgeModel ? (
        <div className="rounded-3xl p-4 border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/10"
          style={{ backgroundColor: judgeModel.color + '15' }}>
          <h3 className="text-base font-bold text-yellow-400 flex items-center gap-2 mb-3">👑 裁判模型</h3>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{judgeModel.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate">{judgeModel.name}</p>
              <p className="text-xs text-slate-400 truncate">{judgeModel.modelName}</p>
            </div>
            <StatusBadge status={judgeModel.runStatus} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditingJudge(true)}
              className="flex-1 text-sm text-white bg-white/10 hover:bg-white/20 py-2 rounded-xl transition">编辑</button>
            <button onClick={clearJudge}
              className="flex-1 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 py-2 rounded-xl transition">取消</button>
          </div>
        </div>
      ) : null}

      {/* 参赛模型列表 */}
      <div className="bg-slate-800/60 backdrop-blur-md rounded-3xl p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            🤖 参赛模型 ({competitors.length}/24)
          </h3>
          <button onClick={() => { setAddingNew(true); setEditingId(null); }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-2xl transition">
            + 添加
          </button>
        </div>

        {competitors.length === 0 && !addingNew ? (
          <p className="text-slate-500 text-center py-6 text-sm">还没有模型，请添加</p>
        ) : (
          <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
            {competitors.map((comp) => (
              <div key={comp.id}
                className="rounded-2xl p-3 flex items-center gap-3 transition hover:scale-[1.02]"
                style={{ backgroundColor: comp.color + '20' }}>
                <span className="text-2xl">{comp.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{comp.name}</p>
                  <p className="text-xs text-slate-400 truncate">{comp.modelName}</p>
                </div>
                <StatusBadge status={comp.runStatus} />
                <div className="flex gap-1.5">
                  <button onClick={() => setJudgeModel(comp)}
                    className="text-xs text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 px-2.5 py-1.5 rounded-lg transition font-medium">👑</button>
                  <button onClick={() => { setEditingId(comp.id); setAddingNew(false); }}
                    className="text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1.5 rounded-lg transition font-medium">✏️</button>
                  <button onClick={() => removeCompetitor(comp.id)}
                    className="text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg transition font-medium">🗑️</button>
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