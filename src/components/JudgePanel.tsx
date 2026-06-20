import { useArenaStore } from '../stores/arenaStore';

export function JudgePanel() {
  const { judgeModel, judgeComment, status, phase, eliminatedModels, eliminationReasons } =
    useArenaStore();
  const isRunning = status === 'loading';
  const isFinished = status === 'finished';

  if (!judgeModel) return null;

  const phaseLabel: Record<string, string> = {
    judge_reading_rules: '📖 正在读取游戏规则...',
    private_conversations: '💬 正在与各模型进行私人对话...',
    judge_deliberation: '⚖️ 正在做出淘汰判定...',
    public_announcement: '📢 正在公开宣布结果...',
    round_end: '✅ 本轮判定完成',
    game_over: '🏁 游戏结束',
  };

  return (
    <div className="rounded-[1.5rem] p-4 bg-slate-900/20 border border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">👑</span>
        <h3 className="text-sm font-bold text-amber-400">裁判Agent</h3>
        {judgeModel && (
          <span className="text-xs text-slate-500 ml-auto">
            {judgeModel.icon} {judgeModel.name}
          </span>
        )}
      </div>

      {/* 当前阶段 */}
      {isRunning && phase !== 'idle' && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3 mb-3">
          <p className="text-amber-400 text-sm font-medium">{phaseLabel[phase] || phase}</p>
        </div>
      )}

      {/* 淘汰统计 */}
      {eliminatedModels.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-3 mb-3">
          <p className="text-red-400 text-xs font-medium mb-1.5">
            💀 已淘汰 {eliminatedModels.length} 个模型
          </p>
          <div className="space-y-1">
            {eliminatedModels.map((id) => (
              <p key={id} className="text-xs text-red-400/70">
                {id.slice(0, 8)}... · {eliminationReasons[id] || '未知原因'}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 判定结果 */}
      {judgeComment ? (
        <div className="bg-slate-900/40 rounded-2xl p-4">
          <p className="text-xs text-amber-400 font-medium mb-2">📝 判定总结</p>
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {judgeComment}
          </p>
        </div>
      ) : isRunning ? (
        <div className="bg-slate-900/30 rounded-2xl p-4 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>
          <span className="text-slate-500 text-sm ml-2">裁判Agent正在执行判定...</span>
        </div>
      ) : isFinished ? (
        <div className="bg-slate-900/20 rounded-2xl p-4 text-center">
          <p className="text-sm text-green-400/70">✅ 本轮判定已完成</p>
        </div>
      ) : (
        <div className="bg-slate-900/20 rounded-2xl p-4 text-center">
          <p className="text-sm text-slate-600 italic">开始游戏后，裁判Agent将自动执行</p>
        </div>
      )}
    </div>
  );
}