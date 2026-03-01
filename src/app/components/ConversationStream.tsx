'use client';

import { useRef, useEffect, useState } from 'react';
import type { ConversationEvent } from '@/hooks/useGraphData';

interface Props {
  conversations: ConversationEvent[];
}

const SOURCE_COLORS: Record<string, string> = {
  glasses: 'var(--amber)',
  telegram: '#0088cc',
  webchat: 'var(--accent)',
  elevenlabs: '#8b5cf6',
  unknown: 'var(--text-tertiary)',
};

const SOURCE_LABELS: Record<string, string> = {
  glasses: 'GLASSES',
  telegram: 'TELEGRAM',
  webchat: 'WEB',
  elevenlabs: 'ELEVENLABS',
  unknown: 'OTHER',
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
  return `${Math.floor(diff / 86400_000)}d`;
}

export default function ConversationStream({ conversations }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevLenRef = useRef(conversations.length);

  useEffect(() => {
    if (autoScroll && conversations.length > prevLenRef.current && scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
    prevLenRef.current = conversations.length;
  }, [conversations.length, autoScroll]);

  return (
    <div className="h-[72px] min-h-[72px] flex items-stretch overflow-hidden"
      style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>

      {/* Label */}
      <div className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{ borderRight: '1px solid var(--border)' }}>
        <div className="w-[5px] h-[5px] rounded-full status-live" style={{ background: 'var(--green)' }} />
        <div>
          <div className="text-[10px] font-semibold tracking-wider" style={{ color: 'var(--text-secondary)' }}>STREAM</div>
          <div className="font-mono text-[9px]" style={{ color: 'var(--text-tertiary)' }}>{conversations.length}</div>
        </div>
      </div>

      {/* Scrollable cards */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden flex items-center gap-2 px-2"
        onScroll={(e) => {
          setAutoScroll(e.currentTarget.scrollLeft < 10);
        }}
      >
        {conversations.length === 0 ? (
          <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>No conversations yet</span>
        ) : (
          conversations.map((c, i) => {
            const sourceColor = SOURCE_COLORS[c.source] || SOURCE_COLORS.unknown;
            const sourceLabel = SOURCE_LABELS[c.source] || c.source;
            const isAI = c.role === 'assistant';

            return (
              <div
                key={`${c.timestamp}-${i}`}
                className="flex-shrink-0 max-w-[320px] px-3 py-2 rounded-sm transition-colors"
                style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-mono text-[8px] font-semibold tracking-wider px-1 py-px rounded-sm"
                    style={{ color: sourceColor, background: `color-mix(in srgb, ${sourceColor} 10%, transparent)` }}>
                    {sourceLabel}
                  </span>
                  <span className={`text-[10px] font-medium ${isAI ? 'text-text-tertiary' : ''}`}
                    style={{ color: isAI ? 'var(--text-tertiary)' : 'var(--accent)' }}>
                    {c.speaker}
                  </span>
                  <span className="font-mono text-[9px] ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                    {timeAgo(c.timestamp)}
                  </span>
                </div>
                <p className="text-[10px] leading-snug truncate" style={{ color: 'var(--text-secondary)' }}>
                  {c.content}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
