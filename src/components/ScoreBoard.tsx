import { useArenaStore } from '../stores/arenaStore';

export function ScoreBoard() {
  const { competitors, judgeModel, totalScores, eliminatedModels } = useArenaStore();

  const allModels = [
    ...competitors.map((c) => ({
      ...c,
      isJudge: false,
      isEliminated: eliminatedModels.includes(c.id) || c.runStatus === 'eliminated',
    })),
    ...(judgeModel ? [{ ...judgeModel, isJudge: true, isEliminated: false }] : []),
  ];

  const sortedModels = allModels
    .map((m) => ({ ...m, total: totalScores[m.id] || 0 }))
    .sort((a, b) => b.total - a.total);

  const hasAnyScore = sortedModels.some((m) => m.total > 0);

  return (
    <div className="glass-subcard p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🏆</span>
        <h3 className="text-sm font-bold text-white">积分榜</h3>
      </div>

      {sortedModels.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-slate-600 text-sm">还没有配置模型</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sortedModels.map((model, index) => {
            const isFirst = hasAnyScore && index === 0 && model.total > 0;
            return (
              <div key={model.id}
                className={`flex items-center gap-3 p-2.5 rounded-2xl transition ${
                  model.isEliminated
                    ? 'bg-red-500/5 border border-red-500/10'
                    : isFirst
                    ? 'bg-violet-500/10 border border-violet-500/25'
                    : 'bg-white/[0.03]'
                }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  model.isEliminated
                    ? 'bg-red-500/20 text-red-400'
                    : index === 0 && model.total > 0
                    ? 'bg-violet-500 text-white'
                    : index === 1 && model.total > 0
                    ? 'bg-slate-300 text-slate-800'
                    : index === 2 && model.total > 0
                    ? 'bg-amber-700 text-white'
                    : 'bg-white/[0.06] text-slate-400'
                }`}>
                  {model.isEliminated ? '💀' : model.total > 0 ? index + 1 : '-'}
                </div>

                <span className="text-xl">{model.icon}</span>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate text-sm">{model.name}</p>
                  <div className="flex gap-1">
                    {model.isJudge && <span className="text-xs text-violet-300">裁判</span>}
                    {model.isEliminated && <span className="text-xs text-red-400">已淘汰</span>}
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    model.isEliminated ? 'text-red-400/60 line-through' :
                    isFirst ? 'text-violet-300' : 'text-white'
                  }`}>
                    {model.total}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasAnyScore && sortedModels.length > 0 && (
        <p className="text-xs text-slate-600 text-center mt-3">
          开始游戏后分数将显示在这里
        </p>
      )}
    </div>
  );
}
