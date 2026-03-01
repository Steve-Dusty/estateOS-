'use client';

import type { ConversationRow } from '@/types/graph';

interface Props {
  conversations: ConversationRow[];
  personName: string;
  onSpeakerClick?: (name: string) => void;
}

export default function ConversationThread({ conversations, personName, onSpeakerClick }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="text-slate-500 text-sm italic p-4">
        No conversations recorded yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {conversations.map((c) => {
        const isUser = c.role === 'user';
        const isSteve = c.person_id === 1;
        const speaker = isUser ? (isSteve ? 'Steve' : personName) : 'AI';

        return (
          <div
            key={c.id}
            className={`rounded-lg px-3 py-2 max-w-[90%] ${
              isUser
                ? isSteve
                  ? 'bg-amber-900/30 border border-amber-700/30 self-end'
                  : 'bg-cyan-900/30 border border-cyan-700/30 self-start'
                : 'bg-slate-800/50 border border-slate-700/30 self-start'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-medium cursor-pointer hover:underline ${
                  isUser ? (isSteve ? 'text-amber-400' : 'text-cyan-400') : 'text-slate-400'
                }`}
                onClick={() => onSpeakerClick?.(speaker)}
              >
                {speaker}
              </span>
              <span className="text-xs text-slate-600">
                {new Date(c.timestamp).toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">
              {c.content.slice(0, 500)}
              {c.content.length > 500 && '...'}
            </p>
          </div>
        );
      })}
    </div>
  );
}
