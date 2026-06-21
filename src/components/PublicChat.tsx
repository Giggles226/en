import { useArenaStore } from '../stores/arenaStore';

export function PublicChat() {
  const { publicMessages } = useArenaStore();

  if (publicMessages.length === 0) return null;

  return (
    <section>
      <h2 className="glass-section-title">
        <span className="text-lg">📢</span>
        公共发言区
        <span className="text-slate-500 font-normal text-xs ml-auto">{publicMessages.length} 条</span>
      </h2>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {publicMessages.map((msg) => (
          <div key={msg.id}
            className={`rounded-2xl p-4 ${
              msg.from === 'judge'
                ? 'bg-violet-500/5 border border-violet-500/20'
                : 'bg-blue-500/5 border border-blue-500/20'
            }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{msg.fromIcon}</span>
              <span className={`font-bold text-sm ${
                msg.from === 'judge' ? 'text-violet-300' : 'text-blue-400'
              }`}>
                {msg.fromName}
              </span>
              {msg.visibleTo === 'survivors' && (
                <span className="glass-badge-green text-xs">仅存活者</span>
              )}
              <span className="text-xs text-slate-600 ml-auto">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
