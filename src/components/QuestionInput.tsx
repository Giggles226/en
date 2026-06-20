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

  const handleResume = () => {
    resumeGame();
  };

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
    <div className="bg-slate-800/60 backdrop-blur-md rounded-3xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-400 font-medium">
          第 {round + 1} / {gameRule.maxRounds} 轮
        </span>
        <div className={`px-3 py-1 rounded-xl text-xs font-bold ${
          isRunning ? 'bg-blue-500/20 text-blue-400' :
          isFinished ? 'bg-green-500/20 text-green-400' :
          isPaused ? 'bg-amber-500/20 text-amber-400' :
          'bg-slate-700 text-slate-400'
        }`}>
          {phaseLabel[phase] || phaseLabel.idle}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs text-slate-400">
        <span>🟢 {survivors.length} 个存活</span>
        <span>💀 {eliminatedModels.length} 个淘汰</span>
        <span>👑 {judgeModel?.runStatus === 'active' ? '裁判就绪' : '裁判未就绪'}</span>
        <span>📜 {gameRule.name}</span>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-slate-300 mb-1.5 font-medium">
          📜 本轮主题/问题
        </label>
        <textarea value={localQuestion}
          onChange={(e) => { setLocalQuestion(e.target.value); setQuestion(e.target.value); }}
          placeholder="输入主题让裁判Agent主持博弈..."
          disabled={isRunning || isPaused}
          rows={3}
          className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-base disabled:opacity-50 resize-none" />
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-400 text-sm rounded-2xl px-4 py-2.5 mb-3">
          ⚠️ {error}
        </div>
      )}

      <div className="space-y-2">
        {isPaused ? (
          <button onClick={handleResume}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-3.5 rounded-2xl transition shadow-lg shadow-green-500/20 text-base">
            ▶️ 一键恢复游戏
          </button>
        ) : isRunning ? (
          <div className="w-full bg-slate-700 text-slate-400 font-bold py-3.5 rounded-2xl text-center text-base">
            ⏳ 裁判Agent正在执行游戏流程...
          </div>
        ) : !isFinished ? (
          <button onClick={() => startRound()}
            disabled={isRunning || survivors.length < 2 || !judgeModel || !localQuestion.trim()}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition shadow-lg shadow-orange-500/20 text-base">
            🎮 开始游戏（裁判Agent自动主持）
          </button>
        ) : null}

        {isFinished && phase !== 'game_over' && (
          <div className="flex gap-2">
            {round + 1 < gameRule.maxRounds && survivors.length > 1 && (
              <button onClick={nextRound}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-3.5 rounded-2xl transition">
                ➡️ 下一轮
              </button>
            )}
            <button onClick={resetGame}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3.5 rounded-2xl transition">
              🔄 重新开始
            </button>
          </div>
        )}

        {isFinished && phase === 'game_over' && (
          <button onClick={resetGame}
            className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white font-bold py-3.5 rounded-2xl transition">
            🔄 重新开始
          </button>
        )}
      </div>
    </div>
  );
}