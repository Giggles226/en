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

  // ─── 主游戏循环：状态机驱动 ───
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

    runGameLoop(survivors).finally(() => {
      isRunning.current = false;
    });
  }, [status, phase, competitors, judgeModel, question]);

  // ─── 游戏主循环 ───
  async function runGameLoop(survivors: ReturnType<typeof getSurvivors>) {
    try {
      // Phase 1: 裁判读取规则
      if (phase === 'judge_reading_rules') {
        await new Promise((r) => setTimeout(r, 500)); // 短暂延迟让UI更新
        setPhase('private_conversations');
        // 初始化所有存活模型的私人对话
        initPrivateChats(survivors.map((s) => s.id));
        return;
      }

      // Phase 2: 私人对话（逐个模型进行）
      if (phase === 'private_conversations') {
        await runPrivateConversations(survivors);
        return;
      }

      // Phase 3: 裁判判定
      if (phase === 'judge_deliberation') {
        await runDeliberation(survivors);
        return;
      }

      // Phase 4: 公共发言
      if (phase === 'public_announcement') {
        await runPublicAnnouncement(survivors);
        return;
      }

      // Phase 5: 回合结束
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

  // ─── Phase 2: 私人对话 ───
  async function runPrivateConversations(
    survivors: ReturnType<typeof getSurvivors>
  ) {
    const currentChats = useArenaStore.getState().privateChats;
    const allDone = survivors.every((s) => {
      const chat = currentChats.find((c) => c.competitorId === s.id);
      return chat && !chat.isActive;
    });

    if (allDone) {
      setPhase('judge_deliberation');
      return;
    }

    // 找到下一个需要对话的存活模型
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

    // 进行一轮对话
    const result = await judgeAgentPrivateChat(
      judgeModel!,
      nextSurvivor,
      gameRule,
      question,
      existingMessages,
      turnIndex
    );

    const now = Date.now();

    // 添加裁判消息
    const judgeMsg: ChatMessage = {
      id: generateChatMessageId(),
      role: 'judge',
      content: result.judgeMessage,
      timestamp: now,
    };
    addPrivateMessage(nextSurvivor.id, judgeMsg);

    // 添加参赛模型回复
    const competitorMsg: ChatMessage = {
      id: generateChatMessageId(),
      role: 'competitor',
      content: result.competitorResponse,
      timestamp: now + 1,
    };
    addPrivateMessage(nextSurvivor.id, competitorMsg);

    // 检查是否该模型被淘汰
    if (result.shouldEliminate) {
      eliminateModels([nextSurvivor.id], {
        [nextSurvivor.id]: result.eliminateReason || '裁判判定淘汰',
      });
    }

    // 检查是否结束与该模型的对话
    if (result.isConversationEnd || result.shouldEliminate || turnIndex + 1 >= maxTurns) {
      // 标记该对话为非活跃
      useArenaStore.setState((s) => ({
        privateChats: s.privateChats.map((c) =>
          c.competitorId === nextSurvivor.id ? { ...c, isActive: false } : c
        ),
      }));
    }

    setCurrentConversationId(null);

    // 短暂延迟后继续下一个
    await new Promise((r) => setTimeout(r, 300));
  }

  // ─── Phase 3: 裁判判定 ───
  async function runDeliberation(
    survivors: ReturnType<typeof getSurvivors>
  ) {
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

    // 应用淘汰
    if (result.eliminatedThisRound.length > 0) {
      eliminateModels(result.eliminatedThisRound, result.eliminationReasons);
    }

    setJudgeComment(result.deliberationComment);

    setPhase('public_announcement');
  }

  // ─── Phase 4: 公共发言 ───
  async function runPublicAnnouncement(
    survivors: ReturnType<typeof getSurvivors>
  ) {
    const currentEliminated = useArenaStore.getState().eliminatedModels;
    const currentReasons = useArenaStore.getState().eliminationReasons;

    const announcement = await judgeAgentPublicAnnounce(
      judgeModel!,
      gameRule,
      survivors,
      currentEliminated,
      currentEliminated, // 本轮所有淘汰
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

  // ─── Phase 5: 回合结束 ───
  async function finalizeRound(survivors: ReturnType<typeof getSurvivors>) {
    if (roundProcessed.current) return;
    roundProcessed.current = true;

    const currentChats = useArenaStore.getState().privateChats;
    const currentPublic = useArenaStore.getState().publicMessages;
    const currentEliminated = useArenaStore.getState().eliminatedModels;

    // 记录本轮
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

    // 更新分数：存活者得分
    const newScores: Record<string, number> = {};
    survivors.forEach((s) => {
      newScores[s.id] = 10; // 存活基础分
    });
    useArenaStore.getState().setScores(newScores);

    setStatus('finished');
  }

  // ─── 渲染 ───
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
            生存博弈 · 裁判Agent主持 · 私人对话 · 淘汰制
          </p>
        </header>

        {/* 游戏阶段指示器 */}
        {status !== 'idle' && status !== 'paused' && (
          <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-3 mb-4 border border-slate-700 text-center">
            <span className="text-amber-400 font-bold text-sm">
              {phaseLabel[phase] || phase}
            </span>
            {currentConversationId && (
              <span className="text-slate-400 text-xs ml-3">
                正在对话: {competitors.find((c) => c.id === currentConversationId)?.name || currentConversationId}
              </span>
            )}
          </div>
        )}

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

            {/* 存活模型 */}
            {survivors.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-green-400 mb-3 flex items-center gap-2">
                  🟢 存活模型 ({survivors.length}个)
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
                <h2 className="text-base font-bold text-red-400 mb-3 flex items-center gap-2">
                  🔴 已淘汰 ({eliminated.length}个) - 已禁言，仅可与裁判私下交流
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

            {/* 公共发言区 */}
            <PublicChat />

            <JudgePanel />
            <ScoreBoard />

            {survivors.length < 2 && !isPaused && status === 'idle' && (
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

            {status === 'finished' && phase === 'game_over' && (
              <div className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-500/50 rounded-3xl p-6 text-center">
                <p className="text-yellow-300 font-bold text-xl mb-2">🏆 游戏结束！</p>
                <p className="text-amber-300 text-base">
                  {survivors.length === 1
                    ? `最终胜者: ${survivors[0].icon} ${survivors[0].name}`
                    : survivors.length > 1
                    ? `存活者: ${survivors.map((s) => s.name).join('、')}`
                    : '所有模型已被淘汰'}
                </p>
              </div>
            )}
          </main>
        </div>

        <footer className="text-center mt-10 pb-6">
          <p className="text-xs text-slate-600">
            AI Tavern Arena · 生存博弈 · 裁判Agent · 私人对话淘汰制
          </p>
        </footer>
      </div>
    </div>
  );
}