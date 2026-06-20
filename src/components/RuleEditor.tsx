import { useState } from 'react';
import { useArenaStore } from '../stores/arenaStore';
import type { GameRule } from '../types';

export function RuleEditor() {
  const { gameRule, setGameRule } = useArenaStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<GameRule>({ ...gameRule });

  const save = () => {
    setGameRule({ ...draft });
    setOpen(false);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📜</span>
          <div>
            <h3 className="font-bold text-white text-sm">游戏规则</h3>
            <p className="text-xs text-slate-500 truncate max-w-[200px]">{gameRule.name}</p>
          </div>
        </div>
        <button
          onClick={() => { setDraft({ ...gameRule }); setOpen(true); }}
          className="glass-btn-sm"
        >
          编辑
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-card p-5 md:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-white">📜 编辑游戏规则</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">规则名称</label>
                <input type="text" value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="glass-input w-full" />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">规则描述</label>
                <input type="text" value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="glass-input w-full" />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">比赛规则（每轮发送给参赛模型）</label>
                <textarea value={draft.rules}
                  onChange={(e) => setDraft({ ...draft, rules: e.target.value })}
                  rows={4}
                  placeholder="描述比赛规则，会每轮注入给模型..."
                  className="glass-textarea w-full" />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">裁判淘汰/存活判定标准</label>
                <textarea value={draft.judgeCriteria}
                  onChange={(e) => setDraft({ ...draft, judgeCriteria: e.target.value })}
                  rows={4}
                  placeholder="告诉裁判模型如何判定淘汰和存活..."
                  className="glass-textarea w-full" />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">裁判Agent行为规则</label>
                <textarea value={draft.eliminationRules}
                  onChange={(e) => setDraft({ ...draft, eliminationRules: e.target.value })}
                  rows={3}
                  placeholder="定义裁判Agent如何主持游戏、进行私人对话..."
                  className="glass-textarea w-full" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">最大轮次</label>
                  <select value={draft.maxRounds}
                    onChange={(e) => setDraft({ ...draft, maxRounds: parseInt(e.target.value) })}
                    className="glass-input w-full">
                    {[1, 2, 3, 5, 7, 10].map((n) => (
                      <option key={n} value={n} className="bg-slate-900">{n} 轮</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">每轮私人对话回合数</label>
                  <select value={draft.maxPrivateTurns}
                    onChange={(e) => setDraft({ ...draft, maxPrivateTurns: parseInt(e.target.value) })}
                    className="glass-input w-full">
                    {[1, 2, 3, 5].map((n) => (
                      <option key={n} value={n} className="bg-slate-900">{n} 回合</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                  提问模板（{'{rules}'} {'{question}'} 占位符）
                </label>
                <textarea value={draft.roundPromptTemplate}
                  onChange={(e) => setDraft({ ...draft, roundPromptTemplate: e.target.value })}
                  rows={3}
                  className="glass-textarea w-full text-sm" />
              </div>

              <button onClick={save}
                disabled={!draft.name.trim() || !draft.rules.trim()}
                className="glass-btn-primary w-full">
                保存规则
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}