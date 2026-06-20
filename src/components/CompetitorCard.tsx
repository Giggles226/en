import { useState } from 'react';
import type { AIConfig, PrivateChat } from '../types';

interface Props {
  competitor: AIConfig;
  answer?: string;
  score?: number;
  isEliminated: boolean;
  privateChat?: PrivateChat;
  eliminationReason?: string;
  isConversing?: boolean;
  isLoading?: boolean;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: '', cls: '' },
  quota_exhausted: { label: '额度耗尽', cls: 'bg-red-500/20 text-red-400' },
  error: { label: '错误', cls: 'bg-red-500/20 text-red-400' },
  paused: { label: '已暂停', cls: 'bg-amber-500/20 text-amber-400' },
  eliminated: { label: '已淘汰', cls: 'bg-red-600/30 text-red-300' },
};

export function CompetitorCard({
  competitor,
  answer,
  score,
  isEliminated,
  privateChat,
  eliminationReason,
  isConversing,
  isLoading,
}: Props) {
  const [showPrivateChat, setShowPrivateChat] = useState(false);
  const badge = STATUS_BADGE[competitor.runStatus];
  const isDown = competitor.runStatus !== 'active' && competitor.runStatus !== 'eliminated';
  const hasPrivateChat = privateChat && privateChat.messages.length > 0;

  return (
    <div
      className={`rounded-3xl p-4 border-2 transition ${
        isEliminated
          ? 'border-red-500/40 bg-red-500/5'
          : isConversing
          ? 'border-blue-500/60 shadow-lg shadow-blue-500/20 bg-blue-500/5'
          : isDown
          ? 'border-red-500/30 opacity-70'
          : 'border-slate-700/50'
      }`}
      style={{ backgroundColor: competitor.color + '15' }}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl">{competitor.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-white truncate">{competitor.name}</p>
            {isEliminated && <span className="text-red-400 text-sm">💀</span>}
            {isConversing && <span className="text-blue-400 text-xs animate-pulse">对话中</span>}
          </div>
          <p className="text-xs text-slate-400 truncate">{competitor.modelName}</p>
          {badge.label && (
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium mt-1 inline-block ${badge.cls}`}>
              {badge.label}
            </span>
          )}
          {eliminationReason && (
            <p className="text-xs text-red-400 mt-1 truncate">淘汰原因: {eliminationReason}</p>
          )}
        </div>
        {score !== undefined && score > 0 && (
          <div className="px-3 py-1.5 rounded-2xl text-base font-bold bg-slate-700/60 text-slate-300">
            {score}
          </div>
        )}
      </div>

      {/* 加载状态 */}
      {isLoading ? (
        <div className="bg-slate-900/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            <span className="ml-2 text-sm">裁判正在对话...</span>
          </div>
        </div>
      ) : answer ? (
        <div className="bg-slate-900/50 rounded-2xl p-4 max-h-80 overflow-y-auto">
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
            {answer}
          </p>
        </div>
      ) : isEliminated ? (
        <div className="bg-slate-900/30 rounded-2xl p-4 text-center">
          <p className="text-sm text-red-400 italic">🔇 已禁言，仅可与裁判私下交流</p>
        </div>
      ) : (
        <div className="bg-slate-900/30 rounded-2xl p-4 text-center">
          <p className="text-sm text-slate-500 italic">等待对话</p>
        </div>
      )}

      {/* 私人对话查看 */}
      {hasPrivateChat && (
        <div className="mt-3">
          <button
            onClick={() => setShowPrivateChat(!showPrivateChat)}
            className="w-full text-xs bg-slate-700/50 hover:bg-slate-700 text-slate-300 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1"
          >
            {showPrivateChat ? '🔒 隐藏私人对话' : '🔒 查看私人对话'} ({privateChat!.messages.length}条)
          </button>
          {showPrivateChat && (
            <div className="mt-2 bg-slate-900/80 rounded-2xl p-3 max-h-60 overflow-y-auto space-y-2">
              {privateChat!.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-xl p-2 text-xs ${
                    msg.role === 'judge'
                      ? 'bg-amber-500/10 border border-amber-500/20 ml-2'
                      : 'bg-blue-500/10 border border-blue-500/20 mr-2'
                  }`}
                >
                  <span className={`font-bold ${msg.role === 'judge' ? 'text-amber-400' : 'text-blue-400'}`}>
                    {msg.role === 'judge' ? '👑 裁判' : `${competitor.icon} ${competitor.name}`}
                  </span>
                  <p className="text-slate-200 mt-1 leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                </div>
              ))}
              {privateChat!.messages.length === 0 && (
                <p className="text-slate-500 text-center text-xs">暂无对话</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}