import { useEffect, useRef } from 'react';
import { useArenaStore } from '../stores/arenaStore';
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
} from '../services/ai_adapters/universal';
import type { RoundRecord, ChatMessage, PublicMessage } from '../types';
import { generateChatMessageId } from '../types';

export function Arena() {
  const {
    status,
    phase,
    competitors,
    judgeModel,
    question,
    gameRule,
    round,
    answers,
    scores,
    privateChats,
    eliminatedModels,
    eliminationReasons,
    currentConversationId,
    setStatus,
    setPhase,
    setJudgeComment,
    addRoundRecord,
    setError,
    initPrivateChats,
    addPrivateMessage,
    setCurrentConversationId,
    eliminateModels,
    addPublicMessage,
  } = useArenaStore();

  const isRunning = useRef(false);
  const roundProcessed = useRef(false);
  const eliminatedBeforeRound = useRef<string[]>([]);

  // ─── 主游戏循环 ───
  useEffect(() => {
    if (status !== 'loading' || !judgeModel || !question) return;
    if (isRunning.current) return;

    const survivors = competitors.filter(
      (c) => c.runStatus === 'active' && !eliminatedModels.includes(c.id)
    );

    if (survivors.length < 2 && phase !== 'round_end' && phase !== 'game_over') {
      setPhase('round_end');
      setStatus('finished');
      return;
    }

    isRunning.current = true;
    roundProcessed.current = false;
    eliminatedBeforeRound.current = [...eliminatedModels];

    runGameLoop(survivors).finally(() => {
      isRunning.current = false;
    });
  }, [status, phase, competitors, judgeModel, question, eliminatedModels]);

  async function runGameLoop(survivors: ReturnType<typeof getSurvivors>) {
    try {
      if (phase === 'judge_reading_rules') {
        await new Promise((r) => setTimeout(r, 500));
        setPhase('private_conversations');
        initPrivateChats(survivors.map((s) => s.id));
        return;
      }
      if (phase === 'private_conversations') {
        await runPrivateConversations(survivors);
        return;
      }
      if (phase === 'judge_deliberation') {
        await runDeliberation(survivors);
        return;
      }
      if (phase === 'public_announcement') {
        await runPublicAnnouncement(survivors);
        return;
      }
      if (phase === 'round_end') {
        await finalizeRound(survivors);
        return;
      }
    } catch (err) {
      setStatus('idle');
      setPhase('idle');
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function getSurvivors() {
    return competitors.filter(
      (c) => c.runStatus === 'active' && !eliminatedModels.includes(c.id)
    );
  }

  async function runPrivateConversations(survivors: ReturnType<typeof getSurvivors>) {
    const currentChats = useArenaStore.getState().privateChats;
    const allDone = survivors.every((s) => {
      const chat = currentChats.find((c) => c.competitorId === s.id);
      return chat && !chat.isActive;
    });

    if (allDone) {
      setPhase('judge_deliberation');
      return;
    }

    const nextSurvivor = survivors.find((s) => {
      const chat = currentChats.find((c) => c.competitorId === s.id);
      return chat && chat.isActive;
    });

    if (!nextSurvivor) {
      setPhase('judge_deliberation');
      return;
    }

    setCurrentConversationId(nextSurvivor.id);

    const chat = currentChats.find((c) => c.competitorId === nextSurvivor.id);
    const existingMessages = chat?.messages || [];
    const turnIndex = existingMessages.filter((m) => m.role === 'judge').length;
    const maxTurns = gameRule.maxPrivateTurns || 3;

    const result = await judgeAgentPrivateChat(
      judgeModel!,
      nextSurvivor,
      gameRule,
      question,
      existingMessages,
      turnIndex
    );

    const now = Date.now();

    const judgeMsg: ChatMessage = {
      id: generateChatMessageId(),
      role: 'judge',
      content: result.judgeMessage,
      timestamp: now,
    };
    addPrivateMessage(nextSurvivor.id, judgeMsg);

    const competitorMsg: ChatMessage = {
      id: generateChatMessageId(),
      role: 'competitor',
      content: result.competitorResponse,
      timestamp: now + 1,
    };
    addPrivateMessage(nextSurvivor.id, competitorMsg);

    if (result.shouldEliminate) {
      eliminateModels([nextSurvivor.id], {
        [nextSurvivor.id]: result.eliminateReason || '裁判判定淘汰',
      });
    }

    if (result.isConversationEnd || result.shouldEliminate || turnIndex + 1 >= maxTurns) {
      useArenaStore.setState((s) => ({
        privateChats: s.privateChats.map((c) =>
          c.competitorId === nextSurvivor.id ? { ...c, isActive: false } : c
        ),
      }));
    }

    setCurrentConversationId(null);
    await new Promise((r) => setTimeout(r, 300));
  }

  async function runDeliberation(survivors: ReturnType<typeof getSurvivors>) {
    const currentChats = useArenaStore.getState().privateChats;
    const currentEliminated = useArenaStore.getState().eliminatedModels;

    const chatSummaries = currentChats.map((chat) => {
      const comp = competitors.find((c) => c.id === chat.competitorId);
      return {
        competitorId: chat.competitorId,
        competitorName: comp?.name || chat.competitorId,
        messages: chat.messages,
      };
    });

    const result = await judgeAgentDeliberate(
      judgeModel!,
      gameRule,
      survivors,
      currentEliminated,
      chatSummaries,
      question,
      round
    );

    if (result.eliminatedThisRound.length > 0) {
      eliminateModels(result.eliminatedThisRound, result.eliminationReasons);
    }

    setJudgeComment(result.deliberationComment);
    setPhase('public_announcement');
  }

  async function runPublicAnnouncement(survivors: ReturnType<typeof getSurvivors>) {
    const currentEliminated = useArenaStore.getState().eliminatedModels;
    const currentReasons = useArenaStore.getState().eliminationReasons;

    const eliminatedThisRound = currentEliminated.filter(
      (id) => !eliminatedBeforeRound.current.includes(id)
    );

    const announcement = await judgeAgentPublicAnnounce(
      judgeModel!,
      gameRule,
      survivors,
      currentEliminated,
      eliminatedThisRound,
      currentReasons,
      question,
      round,
      competitors
    );

    const pubMsg: PublicMessage = {
      id: generateChatMessageId(),
      from: 'judge',
      fromName: judgeModel?.name || '裁判',
      fromIcon: judgeModel?.icon || '👑',
      content: announcement,
      timestamp: Date.now(),
      visibleTo: 'all',
    };
    addPublicMessage(pubMsg);

    setPhase('round_end');
  }

  async function finalizeRound(survivors: ReturnType<typeof getSurvivors>) {
    if (roundProcessed.current) return;
    roundProcessed.current = true;

    const currentChats = useArenaStore.getState().privateChats;
    const currentPublic = useArenaStore.getState().publicMessages;
    const currentEliminated = useArenaStore.getState().eliminatedModels;

    const record: RoundRecord = {
      round,
      question,
      ruleReminder: buildRulePrompt(gameRule, question),
      privateChats: currentChats,
      publicMessages: currentPublic,
      eliminatedThisRound: currentEliminated,
      answers: {},
      scores: {},
      judgeComment: useArenaStore.getState().judgeComment,
      timestamp: Date.now(),
    };
    addRoundRecord(record);

    const newScores: Record<string, number> = {};
    survivors.forEach((s) => {
      newScores[s.id] = 10;
    });
    useArenaStore.getState().setScores(newScores);

    setStatus('finished');
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
      <div className="relative max-w-3xl mx-auto px-4 py-6 md:py-10 space-y-5">
        {/* ─── 顶部标题 ─── */}
        <header className="text-center pb-2">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500 bg-clip-text text-transparent">
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
            <span className="text-amber-400 font-bold text-sm">
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
            <p className="text-amber-300 font-bold text-lg mb-1">⏸️ 游戏已暂停</p>
            <p className="text-amber-400/70 text-sm">
              某个模型额度耗尽，已自动保存快照。请在下方修复该模型后恢复。
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
           配置卡片组
           ══════════════════════════════════════════════════════════ */}
        <div className="glass-card p-5 md:p-6 space-y-5 animate-fade-in">
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
          <div className="glass-card p-5 md:p-6 space-y-5 animate-fade-in">
            {/* 存活模型网格 */}
            {survivors.length > 0 && (
              <section>
                <h2 className="glass-section-title">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  存活模型 ({survivors.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-70">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <p className="text-amber-300 font-bold text-xl mb-1">游戏结束！</p>
            <p className="text-amber-400/80 text-base">
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