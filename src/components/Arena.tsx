import { useEffect, useRef } from 'react';
import { useArenaStore, compressRounds } from '../stores/arenaStore';
import { ConfigPanel } from './ConfigPanel';
import { RuleEditor } from './RuleEditor';
import { SnapshotPanel } from './SnapshotPanel';
import { QuestionInput } from './QuestionInput';
import { CompetitorCard } from './CompetitorCard';
import { JudgePanel } from './JudgePanel';
import { ScoreBoard } from './ScoreBoard';
import { PublicChat } from './PublicChat';
import {
  judgeAgentPrivateChat,
  judgeAgentDeliberate,
  judgeAgentPublicAnnounce,
  buildRulePrompt,
  buildRestoreContext,
  type QuotaError,
} from '../services/ai_adapters/universal';
import type { AIConfig, RoundRecord, PublicMessage } from '../types';
import { generateChatMessageId } from '../types';

// ─── 辅助函数（模块级，避免闭包陈旧值） ───

function getSurvivorsFromStore(): AIConfig[] {
  const { competitors, eliminatedModels } = useArenaStore.getState();
  return competitors.filter(
    (c) => c.runStatus === 'active' && !eliminatedModels.includes(c.id)
  );
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
  });
}

// 构建恢复上下文（融合历史压缩摘要 + 上轮详情），注入裁判/模型 system prompt
function buildRestoreContextFromStore(): string {
  const st = useArenaStore.getState();
  const history = st.roundHistory;
  const lastRound = history.length > 0 ? history[history.length - 1] : null;
  const compressedSummary = history.length > 0 ? compressRounds(history) : '';
  return buildRestoreContext(compressedSummary, lastRound, st.gameRule);
}

export function Arena() {
  const {
    status,
    phase,
    competitors,
    answers,
    scores,
    privateChats,
    eliminatedModels,
    eliminationReasons,
    currentConversationId,
  } = useArenaStore();

  const isRunning = useRef(false);
  const roundProcessed = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // ─── 主游戏循环：仅在 status==='loading' 时启动一次自驱动 runRound ───
  useEffect(() => {
    if (status !== 'loading') return;
    const judge = useArenaStore.getState().judgeModel;
    const q = useArenaStore.getState().question;
    if (!judge || !q) return;
    if (isRunning.current) return; // 防重入（含 StrictMode 双调用）

    isRunning.current = true;
    roundProcessed.current = false;

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    runRound(ctrl.signal)
      .catch((err) => {
        const st = useArenaStore.getState();
        st.setStatus('idle');
        st.setPhase('idle');
        st.setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        isRunning.current = false;
        abortRef.current = null;
      });

    // cleanup：status 变化（暂停/结束/卸载）时中止循环
    return () => {
      ctrl.abort();
    };
    // 仅依赖 status —— phase/privateChats 等变化不再触发 effect，避免死锁
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ─── 额度耗尽统一处理：标记模型 + 自动暂停建快照 ───
  function handleQuotaPause(qe: QuotaError) {
    const st = useArenaStore.getState();
    st.updateModelStatus(qe.modelId, 'quota_exhausted', qe.message);
    st.pauseGame(
      qe.modelId,
      `${qe.modelName}（${qe.role === 'judge' ? '裁判' : '参赛模型'}）额度耗尽：${qe.message}`
    );
  }

  // ─── 相位驱动的可恢复主循环 ───
  async function runRound(signal: AbortSignal) {
    while (!signal.aborted) {
      const st = useArenaStore.getState();
      const phase = st.phase;
      const survivors = getSurvivorsFromStore();

      // 存活不足，提前结束
      if (survivors.length < 2 && phase !== 'round_end' && phase !== 'game_over') {
        st.setPhase('game_over');
        st.setStatus('finished');
        return;
      }

      switch (phase) {
        case 'judge_reading_rules': {
          await delay(500, signal);
          if (signal.aborted) return;
          const s0 = getSurvivorsFromStore();
          useArenaStore.getState().setPhase('private_conversations');
          useArenaStore.getState().initPrivateChats(s0.map((s) => s.id));
          break;
        }
        case 'private_conversations': {
          await runPrivateConversationsLoop(signal);
          if (signal.aborted) return;
          if (useArenaStore.getState().status === 'paused') return; // 额度耗尽暂停
          useArenaStore.getState().setPhase('judge_deliberation');
          break;
        }
        case 'judge_deliberation': {
          await runDeliberation(signal);
          if (signal.aborted) return;
          if (useArenaStore.getState().status === 'paused') return;
          useArenaStore.getState().setPhase('public_announcement');
          break;
        }
        case 'public_announcement': {
          await runPublicAnnouncement(signal);
          if (signal.aborted) return;
          if (useArenaStore.getState().status === 'paused') return;
          useArenaStore.getState().setPhase('round_end');
          break;
        }
        case 'round_end': {
          await finalizeRound(getSurvivorsFromStore());
          return;
        }
        default:
          return;
      }
    }
  }

  // ─── 私人对话：自驱动 while，逐 survivor 逐轮推进 ───
  async function runPrivateConversationsLoop(signal: AbortSignal) {
    const restoreContext = buildRestoreContextFromStore();

    while (!signal.aborted) {
      const st = useArenaStore.getState();
      const survivors = getSurvivorsFromStore();
      const currentChats = st.privateChats;
      const maxTurns = st.gameRule.maxPrivateTurns || 3;

      // 找下一个仍 active 的 survivor 对话
      const next = survivors.find((s) => {
        const chat = currentChats.find((c) => c.competitorId === s.id);
        return chat && chat.isActive;
      });
      if (!next) break; // 全部完成 → 退出，回到 runRound 推进到 deliberation

      const chat = currentChats.find((c) => c.competitorId === next.id)!;
      const turnIndex = chat.messages.filter((m) => m.role === 'judge').length;

      st.setCurrentConversationId(next.id);

      const result = await judgeAgentPrivateChat(
        st.judgeModel!,
        next,
        st.gameRule,
        st.question,
        chat.messages,
        turnIndex,
        restoreContext
      );
      if (signal.aborted) return;

      // 额度耗尽 → 暂停（pauseGame 设 status='paused' → effect cleanup abort）
      if (result.quotaError) {
        handleQuotaPause(result.quotaError);
        return;
      }

      const now = Date.now();
      st.addPrivateMessage(next.id, {
        id: generateChatMessageId(),
        role: 'judge',
        content: result.judgeMessage,
        timestamp: now,
      });
      st.addPrivateMessage(next.id, {
        id: generateChatMessageId(),
        role: 'competitor',
        content: result.competitorResponse,
        timestamp: now + 1,
      });

      if (result.shouldEliminate) {
        st.eliminateModels([next.id], {
          [next.id]: result.eliminateReason || '裁判判定淘汰',
        });
      }

      if (result.isConversationEnd || result.shouldEliminate || turnIndex + 1 >= maxTurns) {
        useArenaStore.setState((s) => ({
          privateChats: s.privateChats.map((c) =>
            c.competitorId === next.id ? { ...c, isActive: false } : c
          ),
        }));
      }

      st.setCurrentConversationId(null);
      await delay(300, signal);
    }
  }

  // ─── 裁判淘汰判定 ───
  async function runDeliberation(signal: AbortSignal) {
    const st = useArenaStore.getState();
    const currentChats = st.privateChats;
    const currentEliminated = st.eliminatedModels;

    const chatSummaries = currentChats.map((chat) => {
      const comp = st.competitors.find((c) => c.id === chat.competitorId);
      return {
        competitorId: chat.competitorId,
        competitorName: comp?.name || chat.competitorId,
        messages: chat.messages,
      };
    });

    const restoreContext = buildRestoreContextFromStore();
    const result = await judgeAgentDeliberate(
      st.judgeModel!,
      st.gameRule,
      getSurvivorsFromStore(),
      currentEliminated,
      chatSummaries,
      st.question,
      st.round,
      restoreContext
    );
    if (signal.aborted) return;

    if (result.quotaError) {
      handleQuotaPause(result.quotaError);
      return;
    }

    if (result.eliminatedThisRound.length > 0) {
      st.eliminateModels(result.eliminatedThisRound, result.eliminationReasons);
    }

    st.setJudgeComment(result.deliberationComment);
  }

  // ─── 裁判公共发言 ───
  async function runPublicAnnouncement(signal: AbortSignal) {
    const st = useArenaStore.getState();
    const currentEliminated = st.eliminatedModels;
    const currentReasons = st.eliminationReasons;

    // Bug #4 修复：从 roundHistory 推算本轮增量（不依赖 ref）
    const eliminatedBefore = st.roundHistory.flatMap((r) => r.eliminatedThisRound);
    const eliminatedThisRound = currentEliminated.filter(
      (id) => !eliminatedBefore.includes(id)
    );

    const restoreContext = buildRestoreContextFromStore();
    const result = await judgeAgentPublicAnnounce(
      st.judgeModel!,
      st.gameRule,
      getSurvivorsFromStore(),
      currentEliminated,
      eliminatedThisRound,
      currentReasons,
      st.question,
      st.round,
      st.competitors,
      restoreContext
    );
    if (signal.aborted) return;

    if (result.quotaError) {
      handleQuotaPause(result.quotaError);
      return;
    }

    const pubMsg: PublicMessage = {
      id: generateChatMessageId(),
      from: 'judge',
      fromName: st.judgeModel?.name || '裁判',
      fromIcon: st.judgeModel?.icon || '👑',
      content: result.content,
      timestamp: Date.now(),
      visibleTo: 'all',
    };
    st.addPublicMessage(pubMsg);
  }

  // ─── 本轮收尾 ───
  async function finalizeRound(survivors: AIConfig[]) {
    if (roundProcessed.current) return;
    roundProcessed.current = true;

    const st = useArenaStore.getState();
    const currentEliminated = st.eliminatedModels;

    // Bug #4 修复：本轮增量淘汰列表
    const eliminatedBefore = st.roundHistory.flatMap((r) => r.eliminatedThisRound);
    const eliminatedThisRound = currentEliminated.filter(
      (id) => !eliminatedBefore.includes(id)
    );

    const record: RoundRecord = {
      round: st.round,
      question: st.question,
      ruleReminder: buildRulePrompt(st.gameRule, st.question),
      privateChats: st.privateChats,
      publicMessages: st.publicMessages,
      eliminatedThisRound, // 增量，不再是累计
      answers: {},
      scores: {},
      judgeComment: st.judgeComment,
      timestamp: Date.now(),
    };
    st.addRoundRecord(record);

    const newScores: Record<string, number> = {};
    survivors.forEach((s) => {
      newScores[s.id] = 10;
    });
    st.setScores(newScores);

    // 每轮结束自动存档（提供恢复点）
    st.createSnapshot(`第${st.round + 1}轮结束自动存档`);

    st.setStatus('finished');
  }

  // ─── 渲染数据 ───
  const isPaused = status === 'paused';
  const survivors = competitors.filter(
    (c) => c.runStatus === 'active' && !eliminatedModels.includes(c.id)
  );
  const eliminated = competitors.filter(
    (c) => eliminatedModels.includes(c.id) || c.runStatus === 'eliminated'
  );

  const phaseLabel: Record<string, string> = {
    idle: '待开始',
    judge_reading_rules: '📖 裁判正在阅读规则...',
    private_conversations: '💬 裁判正在与模型进行私人对话...',
    judge_deliberation: '⚖️ 裁判正在做出淘汰判定...',
    public_announcement: '📢 裁判正在公开宣布结果...',
    round_end: '✅ 本轮结束',
    paused: '⏸️ 已暂停',
    game_over: '🏁 游戏结束',
  };

  return (
    <div className="min-h-screen relative">
      <div className="relative max-w-4xl mx-auto px-5 md:px-8 py-8 md:py-12 space-y-6">
        {/* ─── 顶部标题 ─── */}
        <header className="text-center pb-2">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-violet-300 via-indigo-400 to-violet-500 bg-clip-text text-transparent">
              🍺 AI 酒馆竞技场
            </span>
          </h1>
          <p className="text-slate-500 text-sm mt-2 tracking-wide">
            生存博弈 · 裁判Agent主持 · 私人对话淘汰制
          </p>
        </header>

        {/* ─── 游戏阶段指示器 ─── */}
        {status !== 'idle' && status !== 'paused' && (
          <div className="glass-card p-4 text-center animate-fade-in">
            <span className="text-violet-300 font-bold text-sm">
              {phaseLabel[phase] || phase}
            </span>
            {currentConversationId && (
              <span className="text-slate-500 text-xs ml-3">
                正在对话: {competitors.find((c) => c.id === currentConversationId)?.name || ''}
              </span>
            )}
          </div>
        )}

        {/* ─── 暂停提示 ─── */}
        {isPaused && (
          <div className="glass-card-amber p-5 text-center animate-pulse-glow">
            <p className="text-violet-200 font-bold text-lg mb-1">⏸️ 游戏已暂停</p>
            <p className="text-violet-300/70 text-sm">
              某个模型额度耗尽，已自动保存快照。请在下方修复该模型后恢复。
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
           配置卡片组
           ══════════════════════════════════════════════════════════ */}
        <div className="glass-card p-6 md:p-8 space-y-6 animate-fade-in">
          <ConfigPanel />
          <RuleEditor />
          <SnapshotPanel />
        </div>

        {/* ══════════════════════════════════════════════════════════
           游戏控制
           ══════════════════════════════════════════════════════════ */}
        <QuestionInput />

        {/* ══════════════════════════════════════════════════════════
           竞技场 - 游戏进行中
           ══════════════════════════════════════════════════════════ */}
        {(survivors.length > 0 || eliminated.length > 0) && (
          <div className="glass-card p-6 md:p-8 space-y-6 animate-fade-in">
            {/* 存活模型网格 */}
            {survivors.length > 0 && (
              <section>
                <h2 className="glass-section-title">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  存活模型 ({survivors.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {survivors.map((comp) => {
                    const chat = privateChats.find((c) => c.competitorId === comp.id);
                    return (
                      <CompetitorCard
                        key={comp.id}
                        competitor={comp}
                        answer={answers[comp.id]}
                        score={scores[comp.id]}
                        isEliminated={false}
                        privateChat={chat}
                        isConversing={currentConversationId === comp.id}
                        isLoading={status === 'loading' && currentConversationId === comp.id}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* 淘汰模型 */}
            {eliminated.length > 0 && (
              <section>
                <h2 className="glass-section-title">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  已淘汰 ({eliminated.length}) · 已禁言
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
                  {eliminated.map((comp) => {
                    const chat = privateChats.find((c) => c.competitorId === comp.id);
                    return (
                      <CompetitorCard
                        key={comp.id}
                        competitor={comp}
                        answer={answers[comp.id]}
                        score={scores[comp.id]}
                        isEliminated={true}
                        privateChat={chat}
                        eliminationReason={eliminationReasons[comp.id]}
                        isConversing={false}
                        isLoading={false}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* 公共发言 */}
            <PublicChat />

            {/* 裁判 + 积分榜 并排 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <JudgePanel />
              <ScoreBoard />
            </div>
          </div>
        )}

        {/* ─── 快速开始提示 ─── */}
        {survivors.length < 2 && !isPaused && status === 'idle' && (
          <div className="glass-card p-6 text-center animate-fade-in">
            <div className="text-4xl mb-3">⚙️</div>
            <p className="text-slate-300 font-semibold mb-1">配置你的竞技场</p>
            <p className="text-slate-500 text-sm mb-4">
              添加至少 2 个参赛模型 + 1 个裁判，然后开始游戏
            </p>
            <div className="flex justify-center gap-6 text-xs text-slate-600">
              <span>1. 配置全局 API Key</span>
              <span>2. 添加参赛模型</span>
              <span>3. 指定裁判</span>
              <span>4. 开始竞技</span>
            </div>
          </div>
        )}

        {/* ─── 游戏结束 ─── */}
        {status === 'finished' && phase === 'game_over' && (
          <div className="glass-card-amber p-6 text-center animate-fade-in">
            <p className="text-3xl mb-2">🏆</p>
            <p className="text-violet-200 font-bold text-xl mb-1">游戏结束！</p>
            <p className="text-violet-300/80 text-base">
              {survivors.length === 1
                ? `最终胜者: ${survivors[0].icon} ${survivors[0].name}`
                : survivors.length > 1
                ? `存活者: ${survivors.map((s) => s.name).join('、')}`
                : '所有模型已被淘汰'}
            </p>
          </div>
        )}

        {/* ─── 底部 ─── */}
        <footer className="text-center pb-8">
          <p className="text-xs text-slate-700">
            AI Tavern Arena · 生存博弈 · 裁判Agent · 私人对话淘汰制
          </p>
        </footer>
      </div>
    </div>
  );
}
