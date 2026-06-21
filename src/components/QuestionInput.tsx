import { useState } from 'react';
import { useArenaStore } from '../stores/arenaStore';

export function QuestionInput() {
  const {
    question, setQuestion, status, phase, round, gameRule, startRound,
    competitors, judgeModel, error, nextRound, resetGame, resumeGame,
    eliminatedModels,
  } = useArenaStore();

  const [localQuestion, setLocalQuestion] = useState(question);
  const isRunning = status === 'loading';
  const isFinished = status === 'finished';
  const isPaused = status === 'paused';
  const survivors = competitors.filter(
    (c) => c.runStatus === 'active' && !eliminatedModels.includes(c.id)
  );

  const phaseLabel: Record<string, string> = {
    idle: '待开始',
    judge_reading_rules: '📖 裁判读取规则中...',
    private_conversations: '💬 私人对话中...',
    judge_deliberation: '⚖️ 淘汰判定中...',
    public_announcement: '📢 公开发言中...',
    round_end: '✅ 本轮结束',
    paused: '⏸️ 已暂停',
    game_over: '🏁 游戏结束',
  };

  return (
    <div className="glass-card p-6 md:p-8 animate-fade-in">
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="glass-badge-green text-xs">🟢 {survivors.length} 存活</span>
          {eliminatedModels.length > 0 && (
            <span className="glass-badge-red text-xs">💀 {eliminatedModels.length} 淘汰</span>
          )}
          <span className="glass-badge-slate text-xs">👑 {judgeModel?.runStatus === 'active' ? '裁判就绪' : '无裁判'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            第 {round + 1} / {gameRule.maxRounds} 轮
          </span>
          <span className={`glass-badge text-xs ${
            isRunning ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' :
            isFinished ? 'text-green-400 bg-green-500/10 border border-green-500/20' :
            isPaused ? 'text-violet-300 bg-violet-500/10 border border-violet-500/20' :
            'text-slate-400 bg-slate-500/10 border border-slate-500/20'
          }`}>
            {phaseLabel[phase] || phaseLabel.idle}
          </span>
        </div>
      </div>

      {/* 规则名称 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-slate-500">📜</span>
        <span className="text-xs text-slate-500">{gameRule.name}</span>
      </div>

      {/* 问题输入 */}
      <div className="mb-4">
        <textarea value={localQuestion}
          onChange={(e) => { setLocalQuestion(e.target.value); setQuestion(e.target.value); }}
          placeholder="输入主题让裁判Agent主持博弈..."
          disabled={isRunning || isPaused}
          rows={3}
          className="glass-textarea w-full disabled:opacity-40" />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="glass-badge-red mb-3 flex items-center gap-2 text-sm py-2 px-4">
          ⚠️ {error}
        </div>
      )}

      {/* 操作按钮 */}
      {isPaused ? (
        <div className="space-y-3">
          <p className="text-xs text-violet-300/70 text-center">
            请先在上方配置面板修复额度耗尽的模型 API Key，再恢复游戏
          </p>
          <div className="flex gap-3">
            <button onClick={() => resumeGame()}
              className="glass-btn-primary flex-1">
              ▶️ 恢复并继续游戏
            </button>
            <button onClick={resetGame} className="glass-btn">
              🔄 放弃重开
            </button>
          </div>
        </div>
      ) : isRunning ? (
        <div className="glass-btn w-full text-center text-slate-400 cursor-default">
          ⏳ 裁判Agent正在执行游戏流程...
        </div>
      ) : !isFinished ? (
        <button onClick={() => startRound()}
          disabled={isRunning || survivors.length < 2 || !judgeModel || !localQuestion.trim()}
          className="glass-btn-primary w-full">
          🎮 开始游戏
        </button>
      ) : null}

      {isFinished && phase !== 'game_over' && (
        <div className="flex gap-3">
          {round + 1 < gameRule.maxRounds && survivors.length > 1 && (
            <button onClick={nextRound} className="glass-btn-primary flex-1">
              ➡️ 下一轮
            </button>
          )}
          <button onClick={resetGame} className="glass-btn flex-1">
            🔄 重新开始
          </button>
        </div>
      )}

      {isFinished && phase === 'game_over' && (
        <button onClick={resetGame} className="glass-btn-primary w-full">
          🔄 重新开始
        </button>
      )}
    </div>
  );
}