import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIConfig, ArenaState, GameStatus, GameRule, GameSnapshot, RoundRecord } from '../types';
import { generateId, createEmptyConfig, createDefaultGameRule, createSnapshotId, pickColor, pickIcon } from '../types';

interface ArenaActions {
  // 基础
  setStatus: (status: GameStatus) => void;
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
  // 本地LLM
  setLocalLLMStatus: (status: ArenaState['localLLMStatus'], message?: string) => void;
}

const MAX_COMPETITORS = 24;
const SNAPSHOTS_KEY = 'ai-tavern-arena-snapshots';

export const useArenaStore = create<ArenaState & ArenaActions>()(
  persist(
    (set, get) => ({
      status: 'idle',
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
      localLLMStatus: 'disconnected',
      localLLMMessage: '',

      // ─── 基础操作 ───
      setStatus: (status) => set({ status }),
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

      // ─── 快照 ───
      createSnapshot: (label) => {
        const s = get();
        const snap: GameSnapshot = {
          id: createSnapshotId(),
          createdAt: Date.now(),
          label,
          competitors: JSON.parse(JSON.stringify(s.competitors)),
          judgeModel: s.judgeModel ? JSON.parse(JSON.stringify(s.judgeModel)) : null,
          gameRule: JSON.parse(JSON.stringify(s.gameRule)),
          rounds: JSON.parse(JSON.stringify(s.roundHistory)),
          totalScores: { ...s.totalScores },
          currentRound: s.round,
          compressedSummary: compressRounds(s.roundHistory),
          pausedModelId: null,
          pausedReason: '',
        };
        // 持久化到 localStorage
        const existing = getSavedSnapshotsLocal();
        existing.push(snap);
        localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(existing));
        return snap;
      },

      restoreSnapshot: (snapshot) => {
        set({
          competitors: JSON.parse(JSON.stringify(snapshot.competitors)),
          judgeModel: snapshot.judgeModel ? JSON.parse(JSON.stringify(snapshot.judgeModel)) : null,
          gameRule: JSON.parse(JSON.stringify(snapshot.gameRule)),
          roundHistory: JSON.parse(JSON.stringify(snapshot.rounds)),
          totalScores: { ...snapshot.totalScores },
          round: snapshot.currentRound,
          status: 'idle',
          question: '',
          answers: {},
          scores: {},
          judgeComment: '',
          error: null,
        });
      },

      getSavedSnapshots: () => getSavedSnapshotsLocal(),

      deleteSnapshot: (id) => {
        const existing = getSavedSnapshotsLocal().filter((s) => s.id !== id);
        localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(existing));
      },

      // ─── 暂停/恢复 ───
      pauseGame: (pausedModelId, reason) => {
        const s = get();
        // 自动保存快照
        const snap: GameSnapshot = {
          id: createSnapshotId(),
          createdAt: Date.now(),
          label: `自动暂停 - ${new Date().toLocaleTimeString()}`,
          competitors: JSON.parse(JSON.stringify(s.competitors)),
          judgeModel: s.judgeModel ? JSON.parse(JSON.stringify(s.judgeModel)) : null,
          gameRule: JSON.parse(JSON.stringify(s.gameRule)),
          rounds: JSON.parse(JSON.stringify(s.roundHistory)),
          totalScores: { ...s.totalScores },
          currentRound: s.round,
          compressedSummary: compressRounds(s.roundHistory),
          pausedModelId,
          pausedReason: reason,
        };
        const existing = getSavedSnapshotsLocal();
        existing.push(snap);
        localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(existing));
        set({ status: 'paused', error: reason });
      },

      resumeGame: () => {
        const snapshots = getSavedSnapshotsLocal();
        if (snapshots.length === 0) return null;
        const latest = snapshots[snapshots.length - 1];
        // 恢复状态
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
          status: 'idle',
          question: '',
          answers: {},
          scores: {},
          judgeComment: '',
          error: null,
        });
        return latest;
      },

      // ─── 对话历史 ───
      addRoundRecord: (record) =>
        set((s) => ({ roundHistory: [...s.roundHistory, record] })),

      // ─── 回合 ───
      startRound: () => {
        const { competitors, judgeModel, gameRule, question, round } = get();
        const activeCompetitors = competitors.filter((c) => c.runStatus === 'active');
        if (activeCompetitors.length < 2) {
          set({ error: '至少需要2个活跃参赛模型' });
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
          answers: {},
          scores: {},
          judgeComment: '',
          error: null,
        });
        return true;
      },

      nextRound: () => {
        const { round, gameRule } = get();
        if (round + 1 >= gameRule.maxRounds) {
          set({ status: 'finished', round: round + 1 });
        } else {
          set({ round: round + 1, status: 'idle', question: '' });
        }
      },

      resetGame: () =>
        set({
          status: 'idle',
          round: 0,
          question: '',
          answers: {},
          scores: {},
          judgeComment: '',
          totalScores: {},
          roundHistory: [],
          error: null,
        }),

      // ─── 本地LLM ───
      setLocalLLMStatus: (status, message) =>
        set({ localLLMStatus: status, localLLMMessage: message || '' }),
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

function compressRounds(rounds: RoundRecord[]): string {
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

export { createEmptyConfig };