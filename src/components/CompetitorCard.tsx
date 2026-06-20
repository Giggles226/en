import type { AIConfig } from '../types';

interface Props {
  competitor: AIConfig;
  answer?: string;
  score?: number;
  rank?: number;
  isLoading?: boolean;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: '', cls: '' },
  quota_exhausted: { label: '额度耗尽', cls: 'bg-red-500/20 text-red-400' },
  error: { label: '错误', cls: 'bg-red-500/20 text-red-400' },
  paused: { label: '已暂停', cls: 'bg-amber-500/20 text-amber-400' },
};

export function CompetitorCard({ competitor, answer, score, rank, isLoading }: Props) {
  const badge = STATUS_BADGE[competitor.runStatus];
  const isDown = competitor.runStatus !== 'active';

  return (
    <div className={`rounded-3xl p-4 border-2 transition ${
      rank === 1 ? 'border-yellow-500/60 shadow-lg shadow-yellow-500/20' :
      isDown ? 'border-red-500/30 opacity-70' :
      'border-slate-700/50'
    }`} style={{ backgroundColor: competitor.color + '15' }}>
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl">{competitor.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-white truncate">{competitor.name}</p>
            {rank === 1 && <span className="text-yellow-400 text-sm">🥇</span>}
            {rank === 2 && <span className="text-slate-300 text-sm">🥈</span>}
            {rank === 3 && <span className="text-amber-600 text-sm">🥉</span>}
          </div>
          <p className="text-xs text-slate-400 truncate">{competitor.modelName}</p>
          {badge.label && (
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium mt-1 inline-block ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>
        {score !== undefined && (
          <div className={`px-3 py-1.5 rounded-2xl text-base font-bold ${
            rank === 1 ? 'bg-yellow-500/30 text-yellow-300' : 'bg-slate-700/60 text-slate-300'
          }`}>{score}</div>
        )}
      </div>

      {isLoading ? (
        <div className="bg-slate-900/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            <span className="ml-2 text-sm">正在思考...</span>
          </div>
        </div>
      ) : answer ? (
        <div className="bg-slate-900/50 rounded-2xl p-4 max-h-80 overflow-y-auto">
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
            {answer}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/30 rounded-2xl p-4 text-center">
          <p className="text-sm text-slate-500 italic">
            {isDown ? '模型已离线' : '等待回答'}
          </p>
        </div>
      )}
    </div>
  );
}