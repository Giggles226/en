import { useArenaStore } from '../stores/arenaStore';

export function ScoreBoard() {
  const { competitors, judgeModel, totalScores, eliminatedModels } = useArenaStore();

  // 合并所有模型
  const allModels = [
    ...competitors.map((c) => ({
      ...c,
      isJudge: false,
      isEliminated: eliminatedModels.includes(c.id) || c.runStatus === 'eliminated',
    })),
    ...(judgeModel ? [{ ...judgeModel, isJudge: true, isEliminated: false }] : []),
  ];

  const sortedModels = allModels
    .map((m) => ({
      ...m,
      total: totalScores[m.id] || 0,
    }))
    .sort((a, b) => b.total - a.total);

  const hasAnyScore = sortedModels.some((m) => m.total > 0);

  return (
    <div className="bg-slate-800/60 backdrop-blur-md rounded-3xl p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🏆</span>
        <h3 className="text-lg font-bold text-white">积分榜</h3>
      </div>

      {sortedModels.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-slate-500 text-sm">还没有配置模型</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedModels.map((model, index) => {
            const isActive = hasAnyScore && index === 0 && model.total > 0;
            return (
              <div
                key={model.id}
                className={`flex items-center gap-3 p-3 rounded-2xl transition ${
                  model.isEliminated
                    ? 'bg-red-500/10 border border-red-500/20'
                    : isActive
                    ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border border-yellow-500/30'
                    : 'bg-slate-900/40'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    model.isEliminated
                      ? 'bg-red-600/50 text-red-300'
                      : index === 0 && model.total > 0
                      ? 'bg-yellow-500 text-yellow-900'
                      : index === 1 && model.total > 0
                      ? 'bg-slate-300 text-slate-800'
                      : index === 2 && model.total > 0
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {model.isEliminated ? '💀' : model.total > 0 ? index + 1 : '-'}
                </div>

                <span className="text-2xl">{model.icon}</span>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate text-sm">
                    {model.name}
                  </p>
                  <div className="flex gap-1">
                    {model.isJudge && (
                      <span className="text-xs text-yellow-400">裁判</span>
                    )}
                    {model.isEliminated && (
                      <span className="text-xs text-red-400">已淘汰</span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p
                    className={`text-xl font-bold ${
                      model.isEliminated
                        ? 'text-red-400 line-through'
                        : isActive
                        ? 'text-yellow-400'
                        : 'text-white'
                    }`}
                  >
                    {model.total}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasAnyScore && sortedModels.length > 0 && (
        <p className="text-xs text-slate-500 text-center mt-3">
          开始游戏后分数将显示在这里
        </p>
      )}
    </div>
  );
}