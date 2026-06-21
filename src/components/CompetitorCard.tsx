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
  const isDown = competitor.runStatus !== 'active' && competitor.runStatus !== 'eliminated';
  const hasPrivateChat = privateChat && privateChat.messages.length > 0;

  const badgeCls = (() => {
    switch (competitor.runStatus) {
      case 'quota_exhausted': return 'glass-badge-red';
      case 'error': return 'glass-badge-red';
      case 'paused': return 'glass-badge-amber';
      default: return '';
    }
  })();

  const badgeLabel: Record<string, string> = {
    quota_exhausted: '额度耗尽',
    error: '错误',
    paused: '已暂停',
    eliminated: '已淘汰',
  };

  // 外层：玻璃子卡基底 + 状态色叠层
  const outerCls = `glass-subcard p-5 transition-all duration-300 ${
    isEliminated
      ? '!bg-red-500/5 !border-red-500/25'
      : isConversing
      ? '!bg-blue-500/5 !border-blue-500/40 shadow-lg shadow-blue-500/10'
      : isDown
      ? 'opacity-70'
      : 'hover:!border-violet-400/20'
  }`;

  return (
    <div className={outerCls}>
      {/* 头部 */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`text-3xl w-12 h-12 rounded-2xl flex items-center justify-center ${
          isEliminated ? 'bg-red-500/10' : isConversing ? 'bg-blue-500/10' : 'bg-white/[0.04]'
        }`}>
          {competitor.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-white truncate">{competitor.name}</p>
            {isEliminated && <span className="text-red-400 text-sm">💀</span>}
            {isConversing && <span className="text-blue-400 text-xs animate-pulse">对话中</span>}
          </div>
          <p className="text-xs text-slate-500 truncate">{competitor.modelName}</p>
          {badgeLabel[competitor.runStatus] && (
            <span className={`${badgeCls} mt-1 inline-block`}>{badgeLabel[competitor.runStatus]}</span>
          )}
          {eliminationReason && (
            <p className="text-xs text-red-400 mt-1 truncate">淘汰原因: {eliminationReason}</p>
          )}
        </div>
        {score !== undefined && score > 0 && (
          <div className="px-3 py-1.5 rounded-full text-sm font-bold bg-white/[0.06] text-slate-200 border border-white/5">
            {score}
          </div>
        )}
      </div>

      {/* 内容区 */}
      {isLoading ? (
        <div className="rounded-2xl p-4 flex items-center gap-2 bg-white/[0.03]">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>
          <span className="text-slate-500 text-sm ml-2">裁判正在对话...</span>
        </div>
      ) : answer ? (
        <div className="rounded-2xl p-4 max-h-80 overflow-y-auto bg-white/[0.03]">
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
            {answer}
          </p>
        </div>
      ) : isEliminated ? (
        <div className="rounded-2xl p-4 text-center bg-white/[0.02]">
          <p className="text-sm text-red-400/60 italic">🔇 已禁言，仅可与裁判私下交流</p>
        </div>
      ) : (
        <div className="rounded-2xl p-4 text-center bg-white/[0.02]">
          <p className="text-sm text-slate-600 italic">等待对话</p>
        </div>
      )}

      {/* 私人对话 */}
      {hasPrivateChat && (
        <div className="mt-3">
          <button
            onClick={() => setShowPrivateChat(!showPrivateChat)}
            className="w-full text-xs rounded-full py-2 px-4 bg-white/[0.04] border border-white/5 text-slate-400 hover:text-white hover:!border-violet-400/20 transition flex items-center justify-center gap-1"
          >
            {showPrivateChat ? '🔒 隐藏' : '🔒 查看'}私人对话 ({privateChat!.messages.length}条)
          </button>
          {showPrivateChat && (
            <div className="mt-2 rounded-2xl p-3 max-h-60 overflow-y-auto space-y-2 bg-white/[0.02]">
              {privateChat!.messages.map((msg) => (
                <div key={msg.id}
                  className={`rounded-xl p-2.5 text-xs ${
                    msg.role === 'judge'
                      ? 'bg-violet-500/10 border border-violet-500/20 ml-2'
                      : 'bg-blue-500/10 border border-blue-500/20 mr-2'
                  }`}>
                  <span className={`font-bold ${msg.role === 'judge' ? 'text-violet-300' : 'text-blue-400'}`}>
                    {msg.role === 'judge' ? '👑 裁判' : `${competitor.icon} ${competitor.name}`}
                  </span>
                  <p className="text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
