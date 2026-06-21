import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIConfig, ArenaState, GameStatus, GameRule, GameSnapshot, RoundRecord, GamePhase, PrivateChat, PublicMessage, ChatMessage } from '../types';
import { generateId, createEmptyConfig, createDefaultGameRule, createSnapshotId, pickColor, pickIcon } from '../types';

interface ArenaActions {
  // 基础
  setStatus: (status: GameStatus) => void;
  setPhase: (phase: GamePhase) => void;
  setQuestion: (question: string) => void;
  addCompetitor: (competitor: Omit<AIConfig, 'id'>) => AIConfig;
  removeCompetitor: (id: string) => void;
  updateCompetitor: (id: string, updates: Partial<AIConfig>) => void;
  setJudgeModel: (judge: AIConfig) => void;
  clearJudge: () => void;
  setAnswers: (answers: Record<string, string>) => void;
  setScores: (scores: Record<string, number>) => void;
  setJudgeComment: (comment: string) => void;
  setError: (error: string | null) => void;
  // 游戏规则
  setGameRule: (rule: GameRule) => void;
  // 模型状态
  updateModelStatus: (id: string, status: AIConfig['runStatus'], error?: string) => void;
  // 私人对话
  initPrivateChats: (competitorIds: string[]) => void;
  addPrivateMessage: (competitorId: string, message: ChatMessage) => void;
  setCurrentConversationId: (id: string | null) => void;
  // 淘汰
  eliminateModels: (ids: string[], reasons: Record<string, string>) => void;
  // 公共发言
  addPublicMessage: (message: PublicMessage) => void;
  clearPublicMessages: () => void;
  // 快照
  createSnapshot: (label: string) => GameSnapshot;
  restoreSnapshot: (snapshot: GameSnapshot) => void;
  getSavedSnapshots: () => GameSnapshot[];
  deleteSnapshot: (id: string) => void;
  // 暂停/恢复
  pauseGame: (pausedModelId: string, reason: string) => void;
  resumeGame: () => GameSnapshot | null;
  // 对话历史
  addRoundRecord: (record: RoundRecord) => void;
  // 回合
  startRound: () => boolean;
  nextRound: () => void;
  resetGame: () => void;
}

const MAX_COMPETITORS = 24;
const SNAPSHOTS_KEY = 'ai-tavern-arena-snapshots';

export const useArenaStore = create<ArenaState & ArenaActions>()(
  persist(
    (set, get) => ({
      status: 'idle',
      phase: 'idle',
      round: 0,
      gameRule: createDefaultGameRule(),
      question: '',
      competitors: [],
      judgeModel: null,
      answers: {},
      scores: {},
      judgeComment: '',
      totalScores: {},
      error: null,
      roundHistory: [],
      privateChats: [],
      publicMessages: [],
      eliminatedModels: [],
      currentConversationId: null,
      eliminationReasons: {},

      // ─── 基础操作 ───
      setStatus: (status) => set({ status }),
      setPhase: (phase) => set({ phase }),
      setQuestion: (question) => set({ question }),

      addCompetitor: (competitor) => {
        const { competitors } = get();
        if (competitors.length >= MAX_COMPETITORS) return competitor as AIConfig;
        const idx = competitors.length;
        const c: AIConfig = {
          ...competitor,
          id: generateId(),
          color: competitor.color || pickColor(idx),
          icon: competitor.icon || pickIcon(idx),
          runStatus: 'active',
        };
        set({ competitors: [...competitors, c] });
        return c;
      },

      removeCompetitor: (id) =>
        set((s) => ({ competitors: s.competitors.filter((c) => c.id !== id) })),

      updateCompetitor: (id, updates) =>
        set((s) => ({
          competitors: s.competitors.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
          judgeModel: s.judgeModel?.id === id ? { ...s.judgeModel, ...updates } : s.judgeModel,
        })),

      setJudgeModel: (judge) =>
        set((s) => ({
          judgeModel: { ...judge, runStatus: 'active' },
          competitors: s.competitors.filter((c) => c.id !== judge.id),
        })),

      clearJudge: () =>
        set((s) => ({
          judgeModel: null,
          competitors: s.judgeModel ? [...s.competitors, s.judgeModel] : s.competitors,
        })),

      setAnswers: (answers) => set({ answers, status: 'judging' }),

      setScores: (scores) => {
        const { totalScores } = get();
        const merged = { ...totalScores };
        Object.entries(scores).forEach(([id, s]) => {
          merged[id] = (merged[id] || 0) + s;
        });
        set({ scores, totalScores: merged });
      },

      setJudgeComment: (comment) => set({ judgeComment: comment }),
      setError: (error) => set({ error }),

      // ─── 游戏规则 ───
      setGameRule: (rule) => set({ gameRule: rule }),

      // ─── 模型状态 ───
      updateModelStatus: (id, status, error) =>
        set((s) => ({
          competitors: s.competitors.map((c) =>
            c.id === id ? { ...c, runStatus: status, lastError: error } : c
          ),
          judgeModel:
            s.judgeModel?.id === id
              ? { ...s.judgeModel, runStatus: status, lastError: error }
              : s.judgeModel,
        })),

      // ─── 私人对话 ───
      initPrivateChats: (competitorIds) => {
        const chats: PrivateChat[] = competitorIds.map((id) => ({
          competitorId: id,
          messages: [],
          isActive: true,
        }));
        set({ privateChats: chats });
      },

      addPrivateMessage: (competitorId, message) =>
        set((s) => ({
          privateChats: s.privateChats.map((chat) =>
            chat.competitorId === competitorId
              ? { ...chat, messages: [...chat.messages, message] }
              : chat
          ),
        })),

      setCurrentConversationId: (id) => set({ currentConversationId: id }),

      // ─── 淘汰 ───
      eliminateModels: (ids, reasons) =>
        set((s) => {
          const newEliminated = [...s.eliminatedModels, ...ids];
          return {
            eliminatedModels: newEliminated,
            eliminationReasons: { ...s.eliminationReasons, ...reasons },
            competitors: s.competitors.map((c) =>
              ids.includes(c.id) ? { ...c, runStatus: 'eliminated' as const } : c
            ),
            // 标记被淘汰模型的私人对话为非活跃
            privateChats: s.privateChats.map((chat) =>
              ids.includes(chat.competitorId) ? { ...chat, isActive: false } : chat
            ),
          };
        }),

      // ─── 公共发言 ───
      addPublicMessage: (message) =>
        set((s) => ({ publicMessages: [...s.publicMessages, message] })),

      clearPublicMessages: () => set({ publicMessages: [] }),

      // ─── 快照 ───
      createSnapshot: (label) => {
        const snap = buildSnapshot(get(), label);
        saveSnapshotsLocal(appendSnapshot(getSavedSnapshotsLocal(), snap));
        return snap;
      },

      restoreSnapshot: (snapshot) => {
        set({
          competitors: JSON.parse(JSON.stringify(snapshot.competitors)).map((c: AIConfig) => ({
            ...c,
            runStatus: 'active' as const,
          })),
          judgeModel: snapshot.judgeModel
            ? { ...JSON.parse(JSON.stringify(snapshot.judgeModel)), runStatus: 'active' as const }
            : null,
          gameRule: JSON.parse(JSON.stringify(snapshot.gameRule)),
          roundHistory: JSON.parse(JSON.stringify(snapshot.rounds)),
          totalScores: { ...snapshot.totalScores },
          round: snapshot.currentRound,
          // 恢复接续字段（手动读档回到存档点状态，不自动续跑）
          phase: snapshot.phase ?? 'idle',
          question: snapshot.question ?? '',
          privateChats: JSON.parse(JSON.stringify(snapshot.privateChats ?? [])),
          publicMessages: JSON.parse(JSON.stringify(snapshot.publicMessages ?? [])),
          currentConversationId: snapshot.currentConversationId ?? null,
          eliminationReasons: { ...(snapshot.eliminationReasons ?? {}) },
          judgeComment: snapshot.judgeComment ?? '',
          scores: { ...(snapshot.scores ?? {}) },
          answers: {},
          error: null,
          eliminatedModels: [...(snapshot.eliminatedModels || [])],
          status: 'idle',
        });
      },

      getSavedSnapshots: () => getSavedSnapshotsLocal(),

      deleteSnapshot: (id) => {
        const existing = getSavedSnapshotsLocal().filter((s) => s.id !== id);
        localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(existing));
      },

      // ─── 暂停/恢复 ───
      pauseGame: (pausedModelId, reason) => {
        const snap = buildSnapshot(get(), `自动暂停 - ${new Date().toLocaleTimeString()}`);
        snap.pausedModelId = pausedModelId;
        snap.pausedReason = reason;
        saveSnapshotsLocal(appendSnapshot(getSavedSnapshotsLocal(), snap));
        set({ status: 'paused', phase: 'paused', error: reason });
      },

      resumeGame: () => {
        const snapshots = getSavedSnapshotsLocal();
        if (snapshots.length === 0) return null;
        const latest = snapshots[snapshots.length - 1];
        set({
          competitors: JSON.parse(JSON.stringify(latest.competitors)).map((c: AIConfig) => ({
            ...c,
            runStatus: 'active' as const,
          })),
          judgeModel: latest.judgeModel
            ? { ...JSON.parse(JSON.stringify(latest.judgeModel)), runStatus: 'active' as const }
            : null,
          gameRule: JSON.parse(JSON.stringify(latest.gameRule)),
          roundHistory: JSON.parse(JSON.stringify(latest.rounds)),
          totalScores: { ...latest.totalScores },
          round: latest.currentRound,
          // 恢复接续字段（从快照还原本轮中间状态）
          phase: latest.phase ?? 'private_conversations',
          question: latest.question ?? '',
          privateChats: JSON.parse(JSON.stringify(latest.privateChats ?? [])),
          publicMessages: JSON.parse(JSON.stringify(latest.publicMessages ?? [])),
          currentConversationId: latest.currentConversationId ?? null,
          eliminationReasons: { ...(latest.eliminationReasons ?? {}) },
          judgeComment: latest.judgeComment ?? '',
          scores: { ...(latest.scores ?? {}) },
          answers: {},
          error: null,
          eliminatedModels: [...(latest.eliminatedModels ?? [])],
          // 关键：自动续跑 —— 触发主循环 effect 从保存的相位接续
          status: 'loading',
        });
        return latest;
      },

      // ─── 对话历史 ───
      addRoundRecord: (record) =>
        set((s) => ({ roundHistory: [...s.roundHistory, record] })),

      // ─── 回合 ───
      startRound: () => {
        const { competitors, judgeModel, gameRule, question, round, eliminatedModels } = get();
        const survivors = competitors.filter(
          (c) => c.runStatus === 'active' && !eliminatedModels.includes(c.id)
        );
        if (survivors.length < 2) {
          set({ error: '至少需要2个存活参赛模型' });
          return false;
        }
        if (!judgeModel || judgeModel.runStatus !== 'active') {
          set({ error: '请先设置活跃的裁判模型' });
          return false;
        }
        if (!question.trim()) {
          set({ error: '请输入本轮问题' });
          return false;
        }
        if (round >= gameRule.maxRounds) {
          set({ error: '已达到最大轮次' });
          return false;
        }
        set({
          status: 'loading',
          phase: 'judge_reading_rules',
          answers: {},
          scores: {},
          judgeComment: '',
          error: null,
          privateChats: [],
          publicMessages: [],
          currentConversationId: null,
        });
        return true;
      },

      nextRound: () => {
        const { round, gameRule, eliminatedModels, competitors } = get();
        const survivors = competitors.filter(
          (c) => c.runStatus === 'active' && !eliminatedModels.includes(c.id)
        );
        if (survivors.length <= 1) {
          set({ status: 'finished', phase: 'game_over' });
        } else if (round + 1 >= gameRule.maxRounds) {
          set({ status: 'finished', phase: 'game_over', round: round + 1 });
        } else {
          set({
            round: round + 1,
            status: 'idle',
            phase: 'idle',
            question: '',
            privateChats: [],
            publicMessages: [],
          });
        }
      },

      resetGame: () =>
        set({
          status: 'idle',
          phase: 'idle',
          round: 0,
          question: '',
          answers: {},
          scores: {},
          judgeComment: '',
          totalScores: {},
          roundHistory: [],
          error: null,
          privateChats: [],
          publicMessages: [],
          eliminatedModels: [],
          currentConversationId: null,
          eliminationReasons: {},
        }),
    }),
    {
      name: 'ai-tavern-arena-storage',
      partialize: (state) => ({
        competitors: state.competitors,
        judgeModel: state.judgeModel,
        gameRule: state.gameRule,
        totalScores: state.totalScores,
        round: state.round,
        roundHistory: state.roundHistory,
        eliminatedModels: state.eliminatedModels,
        eliminationReasons: state.eliminationReasons,
      }),
    }
  )
);

// ─── 辅助函数 ───

function getSavedSnapshotsLocal(): GameSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSnapshotsLocal(snaps: GameSnapshot[]): void {
  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snaps));
  } catch {
    // localStorage 满或不可用，静默忽略
  }
}

const MAX_SNAPSHOTS = 20;

function appendSnapshot(existing: GameSnapshot[], snap: GameSnapshot): GameSnapshot[] {
  const next = [...existing, snap];
  // 超出上限删除最旧的，控制 localStorage 体积
  return next.length > MAX_SNAPSHOTS ? next.slice(next.length - MAX_SNAPSHOTS) : next;
}

// 截断私人对话消息，避免快照过大撑爆 localStorage
function truncateMessages(chats: PrivateChat[]): PrivateChat[] {
  const MAX_MSG_LEN = 500;
  return chats.map((c) => ({
    ...c,
    messages: c.messages.map((m) => ({
      ...m,
      content: m.content.length > MAX_MSG_LEN ? m.content.slice(0, MAX_MSG_LEN) + '…' : m.content,
    })),
  }));
}

// 构建快照的纯函数（createSnapshot / pauseGame 共用，避免双写）
function buildSnapshot(state: ArenaState, label: string): GameSnapshot {
  return {
    id: createSnapshotId(),
    createdAt: Date.now(),
    label,
    competitors: JSON.parse(JSON.stringify(state.competitors)),
    judgeModel: state.judgeModel ? JSON.parse(JSON.stringify(state.judgeModel)) : null,
    gameRule: JSON.parse(JSON.stringify(state.gameRule)),
    rounds: JSON.parse(JSON.stringify(state.roundHistory)),
    totalScores: { ...state.totalScores },
    currentRound: state.round,
    compressedSummary: compressRounds(state.roundHistory),
    pausedModelId: null,
    pausedReason: '',
    eliminatedModels: [...state.eliminatedModels],
    // 恢复接续所需的本轮中间状态
    phase: state.phase,
    question: state.question,
    privateChats: JSON.parse(JSON.stringify(truncateMessages(state.privateChats))),
    publicMessages: JSON.parse(JSON.stringify(state.publicMessages)),
    currentConversationId: state.currentConversationId,
    eliminationReasons: { ...state.eliminationReasons },
    judgeComment: state.judgeComment,
    scores: { ...state.scores },
  };
}

export function compressRounds(rounds: RoundRecord[]): string {
  if (rounds.length === 0) return '';
  return rounds
    .map((r) => {
      const eliminatedStr = r.eliminatedThisRound?.length
        ? `淘汰: ${r.eliminatedThisRound.join(', ')}`
        : '无淘汰';
      const scoresStr = Object.entries(r.scores)
        .map(([id, s]) => `  ${id}: ${s}分`)
        .join('\n');
      return `[第${r.round + 1}轮] 问题: ${r.question.slice(0, 80)}...\n${eliminatedStr}\n裁判点评: ${r.judgeComment.slice(0, 100)}...\n分数:\n${scoresStr}`;
    })
    .join('\n---\n');
}

export { createEmptyConfig };