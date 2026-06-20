import { useArenaStore } from '../stores/arenaStore';

export function JudgePanel() {
  const { judgeModel, judgeComment, status } = useArenaStore();
  const isJudging = status === 'judging' || status === 'loading';

  if (!judgeModel) return null;

  return (
    <div className="bg-slate-800/60 backdrop-blur-md rounded-3xl p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">📝</span>
        <h3 className="text-lg font-bold text-white">裁判点评</h3>
        {judgeModel && (
          <span className="text-xs text-slate-400 ml-auto">
            by {judgeModel.icon} {judgeModel.name}
          </span>
        )}
      </div>

      {judgeComment ? (
        <div className="bg-slate-900/60 rounded-2xl p-4">
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {judgeComment}
          </p>
        </div>
      ) : isJudging ? (
        <div className="bg-slate-900/60 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
            <div
              className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
              style={{ animationDelay: '0.15s' }}
            />
            <div
              className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
              style={{ animationDelay: '0.3s' }}
            />
            <span className="ml-2 text-sm">裁判正在分析各模型回答...</span>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/30 rounded-2xl p-4 text-center">
          <p className="text-sm text-slate-500 italic">
            开始游戏后，裁判将在此给出点评
          </p>
        </div>
      )}
    </div>
  );
}
