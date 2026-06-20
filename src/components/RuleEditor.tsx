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

  if (!open) {
    return (
      <div className="bg-slate-800/60 backdrop-blur-md rounded-3xl p-4 border border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📜</span>
            <div>
              <h3 className="font-bold text-white text-sm">游戏规则</h3>
              <p className="text-xs text-slate-400 truncate max-w-[200px]">
                {gameRule.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setDraft({ ...gameRule });
              setOpen(true);
            }}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-xl transition"
          >
            编辑
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-800/95 backdrop-blur-lg rounded-3xl p-5 border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-white">📜 编辑游戏规则</h3>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5 font-medium">
              规则名称
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5 font-medium">
              规则描述
            </label>
            <input
              type="text"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5 font-medium">
              比赛规则（每轮发送给参赛模型）
            </label>
            <textarea
              value={draft.rules}
              onChange={(e) => setDraft({ ...draft, rules: e.target.value })}
              rows={6}
              placeholder="描述比赛规则，会每轮注入给模型..."
              className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5 font-medium">
              裁判评分标准
            </label>
            <textarea
              value={draft.judgeCriteria}
              onChange={(e) => setDraft({ ...draft, judgeCriteria: e.target.value })}
              rows={4}
              placeholder="告诉裁判模型如何评分..."
              className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5 font-medium">
              最大轮次
            </label>
            <select
              value={draft.maxRounds}
              onChange={(e) => setDraft({ ...draft, maxRounds: parseInt(e.target.value) })}
              className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
            >
              {[1, 2, 3, 5, 7, 10].map((n) => (
                <option key={n} value={n}>
                  {n} 轮
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5 font-medium">
              提问模板（{'{rules}'} {'{question}'} 占位符）
            </label>
            <textarea
              value={draft.roundPromptTemplate}
              onChange={(e) =>
                setDraft({ ...draft, roundPromptTemplate: e.target.value })
              }
              rows={3}
              className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition resize-none text-sm"
            />
          </div>

          <button
            onClick={save}
            disabled={!draft.name.trim() || !draft.rules.trim()}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition"
          >
            保存规则
          </button>
        </div>
      </div>
    </div>
  );
}