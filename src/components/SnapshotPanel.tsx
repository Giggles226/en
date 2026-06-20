import { useArenaStore } from '../stores/arenaStore';
import type { GameSnapshot } from '../types';

export function SnapshotPanel() {
  const { getSavedSnapshots, restoreSnapshot, deleteSnapshot, status } = useArenaStore();
  const snapshots = getSavedSnapshots();
  const isPaused = status === 'paused';

  return (
    <div className="bg-slate-800/60 backdrop-blur-md rounded-3xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💾</span>
          <h3 className="font-bold text-white text-sm">
            快照存档 ({snapshots.length})
          </h3>
        </div>
        {isPaused && (
          <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">
            ⏸️ 已暂停
          </span>
        )}
      </div>

      {snapshots.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4">
          {isPaused
            ? '快照已在暂停时自动保存'
            : '暂无快照。当模型额度耗尽时将自动保存'}
        </p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {snapshots
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((snap) => (
              <SnapshotCard
                key={snap.id}
                snapshot={snap}
                onRestore={() => restoreSnapshot(snap)}
                onDelete={() => deleteSnapshot(snap.id)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function SnapshotCard({
  snapshot,
  onRestore,
  onDelete,
}: {
  snapshot: GameSnapshot;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const date = new Date(snapshot.createdAt);
  const isAuto = snapshot.label.includes('自动暂停');
  const eliminatedCount = snapshot.eliminatedModels?.length || 0;

  return (
    <div
      className={`rounded-2xl p-3 ${
        isAuto
          ? 'bg-amber-500/10 border border-amber-500/30'
          : 'bg-slate-900/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white font-medium truncate">
            {isAuto ? '⏸️ ' : '📸 '}
            {snapshot.label}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {date.toLocaleString()} · 第{snapshot.currentRound + 1}轮
            · {snapshot.competitors.length}个模型
            {eliminatedCount > 0 && <span className="text-red-400"> · 💀{eliminatedCount}淘汰</span>}
          </p>
          {snapshot.pausedReason && (
            <p className="text-xs text-amber-400 mt-1 truncate">
              {snapshot.pausedReason}
            </p>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={onRestore}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-xl transition"
          >
            恢复
          </button>
          <button
            onClick={onDelete}
            className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-2.5 py-1.5 rounded-xl transition"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}