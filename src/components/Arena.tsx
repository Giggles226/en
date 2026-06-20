import { useEffect, useRef } from 'react';
import { useArenaStore } from '../stores/arenaStore';
import { ConfigPanel } from './ConfigPanel';
import { RuleEditor } from './RuleEditor';
import { SnapshotPanel } from './SnapshotPanel';
import { QuestionInput } from './QuestionInput';
import { CompetitorCard } from './CompetitorCard';
import { JudgePanel } from './JudgePanel';
import { ScoreBoard } from './ScoreBoard';
import {
  callMultipleAI,
  judgeAnswers,
  buildRulePrompt,
  buildRestoreContext,
} from '../services/ai_adapters/universal';
import type { RoundRecord } from '../types';

export function Arena() {
  const {
    status,
    competitors,
    judgeModel,
    question,
    gameRule,
    answers,
    scores,
    roundHistory,
    setStatus,
    setAnswers,
    setScores,
    setJudgeComment,
    updateModelStatus,
    pauseGame,
    addRoundRecord,
    setError,
  } = useArenaStore();

  const isRunning = useRef(false);

  useEffect(() => {
    if (status !== 'loading' || !judgeModel || !question) return;
    if (isRunning.current) return;
    isRunning.current = true;

    const activeCompetitors = competitors.filter((c) => c.runStatus === 'active');
    if (activeCompetitors.length < 2) {
      isRunning.current = false;
      return;
    }

    const run = async () => {
      try {
        // 1. 构建带规则注入的提示词
        const rulePrompt = buildRulePrompt(gameRule, question);

        // 2. 如果有历史（恢复场景），注入压缩上下文
        let fullPrompt = rulePrompt;
        if (roundHistory.length > 0) {
          const lastRound = roundHistory[roundHistory.length - 1];
          const restoreCtx = buildRestoreContext(
            compressSummary(roundHistory),
            lastRound,
            gameRule
          );
          fullPrompt = restoreCtx + '\n\n' + rulePrompt;
        }

        // 3. 同时调用所有活跃参赛模型
        const { answers: competitorAnswers, quotaErrors } = await callMultipleAI(
          activeCompetitors,
          gameRule.rules,
          fullPrompt
        );

        // 4. 检测额度耗尽
        if (quotaErrors.length > 0) {
          quotaErrors.forEach((id) => {
            updateModelStatus(id, 'quota_exhausted', '额度耗尽');
          });

          const pausedModel = competitors.find((c) => c.id === quotaErrors[0]);
          const modelName = pausedModel?.name || quotaErrors[0];

          // 仍然展示已获取的回答
          setAnswers(competitorAnswers);

          // 检查是否还有足够的活跃模型继续
          const remaining = activeCompetitors.filter(
            (c) => !quotaErrors.includes(c.id)
          );
          if (remaining.length < 2) {
            pauseGame(
              quotaErrors[0],
              `模型 ${modelName} 额度耗尽，已自动暂停。请充值后恢复。`
            );
            isRunning.current = false;
            return;
          }
        }

        setAnswers(competitorAnswers);
        setStatus('judging');

        // 5. 裁判评分（仅对活跃且有回答的模型）
        const validAnswers: Record<string, string> = {};
        Object.entries(competitorAnswers).forEach(([id, text]) => {
          if (!text.startsWith('[额度耗尽]')) {
            validAnswers[id] = text;
          }
        });

        const competitorInfo: Record<string, { name: string; icon: string }> = {};
        activeCompetitors.forEach((c) => {
          if (validAnswers[c.id]) {
            competitorInfo[c.id] = { name: c.name, icon: c.icon };
          }
        });

        if (Object.keys(validAnswers).length >= 2 && judgeModel.runStatus === 'active') {
          const result = await judgeAnswers(
            judgeModel,
            gameRule,
            question,
            validAnswers,
            competitorInfo
          );

          setScores(result.scores);
          setJudgeComment(result.comment);

          // 记录本轮
          const record: RoundRecord = {
            round: useArenaStore.getState().round,
            question,
            ruleReminder: rulePrompt,
            answers: competitorAnswers,
            scores: result.scores,
            judgeComment: result.comment,
            timestamp: Date.now(),
          };
          addRoundRecord(record);
        } else {
          setJudgeComment('裁判模型不可用，本轮跳过评分');
        }

        setStatus('finished');
        setError(null);
      } catch (err) {
        setStatus('idle');
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        isRunning.current = false;
      }
    };

    run();
  }, [status, competitors, judgeModel, question]);

  const getRankings = (): Record<string, number> => {
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const rankings: Record<string, number> = {};
    sorted.forEach(([id], i) => {
      rankings[id] = i + 1;
    });
    return rankings;
  };

  const rankings = getRankings();
  const hasAnyScore = Object.keys(scores).length > 0;
  const isPaused = status === 'paused';
  const activeCompetitors = competitors.filter((c) => c.runStatus === 'active');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-3 py-5 md:px-6 md:py-8">
        <header className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
            🍺 AI 酒馆竞技场
          </h1>
          <p className="text-slate-400 text-sm md:text-base">
            可定制规则 · 多模型博弈 · 上下文快照恢复
          </p>
        </header>

        {/* 暂停提示 */}
        {isPaused && (
          <div className="bg-amber-500/20 border-2 border-amber-500/50 rounded-3xl p-4 mb-4 text-center">
            <p className="text-amber-300 font-bold text-lg mb-2">⏸️ 游戏已暂停</p>
            <p className="text-amber-400 text-sm">
              某个模型额度耗尽，已自动保存快照。请在左侧配置面板修复该模型，然后点击下方恢复。
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-[380px_1fr] gap-4 md:gap-6">
          {/* 左侧 */}
          <aside className="space-y-4 order-2 lg:order-1">
            <ConfigPanel />
            <RuleEditor />
            <SnapshotPanel />
          </aside>

          {/* 右侧 */}
          <main className="space-y-4 order-1 lg:order-2">
            <QuestionInput />

            {activeCompetitors.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  💬 答题展示 ({activeCompetitors.length}个活跃)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {competitors.map((comp) => (
                    <CompetitorCard
                      key={comp.id}
                      competitor={comp}
                      answer={answers[comp.id]}
                      score={scores[comp.id]}
                      rank={hasAnyScore ? rankings[comp.id] : undefined}
                      isLoading={status === 'loading' && !answers[comp.id]}
                    />
                  ))}
                </div>
              </section>
            )}

            <JudgePanel />
            <ScoreBoard />

            {activeCompetitors.length < 2 && !isPaused && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-3xl p-5 text-center">
                <p className="text-blue-300 text-sm font-medium mb-1">⚙️ 快速开始</p>
                <p className="text-slate-400 text-sm">
                  左侧添加至少 2 个参赛模型 + 1 个裁判模型
                </p>
                <div className="text-xs text-slate-500 mt-3 space-y-1">
                  <p>1. 点击"添加模型"</p>
                  <p>2. 填写名称、API Key、模型名称</p>
                  <p>3. 选中一个模型为裁判</p>
                  <p>4. 编辑游戏规则（可选）</p>
                  <p>5. 输入问题，点击"开始游戏"</p>
                </div>
              </div>
            )}
          </main>
        </div>

        <footer className="text-center mt-10 pb-6">
          <p className="text-xs text-slate-600">
            AI Tavern Arena · 自由规则 · 混合快照 · 本地+云端
          </p>
        </footer>
      </div>
    </div>
  );
}

function compressSummary(rounds: RoundRecord[]): string {
  if (rounds.length === 0) return '';
  return rounds
    .map((r) => {
      const scoresStr = Object.entries(r.scores)
        .map(([id, s]) => `  ${id}: ${s}分`)
        .join('\n');
      return `[第${r.round + 1}轮] 问题: ${r.question.slice(0, 80)}...\n裁判点评: ${r.judgeComment.slice(0, 100)}...\n分数:\n${scoresStr}`;
    })
    .join('\n---\n');
}