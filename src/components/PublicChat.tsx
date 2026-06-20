import { useArenaStore } from '../stores/arenaStore';

export function PublicChat() {
  const { publicMessages } = useArenaStore();

  if (publicMessages.length === 0) return null;

  return (
    <div className="bg-slate-800/60 backdrop-blur-md rounded-3xl p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">📢</span>
        <h3 className="text-lg font-bold text-white">公共发言区</h3>
        <span className="text-xs text-slate-400 ml-auto">
          {publicMessages.length} 条消息
        </span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {publicMessages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-2xl p-4 ${
              msg.from === 'judge'
                ? 'bg-amber-500/10 border border-amber-500/30'
                : 'bg-blue-500/10 border border-blue-500/30'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{msg.fromIcon}</span>
              <span className={`font-bold text-sm ${
                msg.from === 'judge' ? 'text-amber-400' : 'text-blue-400'
              }`}>
                {msg.fromName}
              </span>
              {msg.visibleTo === 'survivors' && (
                <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-lg">
                  仅存活者
                </span>
              )}
              <span className="text-xs text-slate-500 ml-auto">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}