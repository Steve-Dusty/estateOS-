'use client';

interface Props {
  stats: {
    totalPersons: number;
    totalTopics: number;
    totalConversations: number;
    totalRelationships: number;
  } | null;
  connected: boolean;
  nodeCount: number;
  linkCount: number;
}

export default function StatsOverlay({ stats, connected, nodeCount, linkCount }: Props) {
  return (
    <div className="flex flex-col gap-1 text-xs font-mono">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
        <span className="text-slate-400">{connected ? 'Live' : 'Connecting...'}</span>
      </div>
      <div className="text-slate-500">
        {nodeCount} nodes / {linkCount} links
      </div>
      {stats && (
        <>
          <div className="text-slate-500">
            {stats.totalPersons} people / {stats.totalTopics} topics
          </div>
          <div className="text-slate-500">
            {stats.totalConversations} messages
          </div>
        </>
      )}
    </div>
  );
}
