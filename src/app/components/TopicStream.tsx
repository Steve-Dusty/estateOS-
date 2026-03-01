'use client';

import { useRef, useEffect, useState } from 'react';
import type { TopicEvent } from '@/hooks/useGraphData';

interface Props {
  topics: TopicEvent[];
  onTopicClick?: (name: string) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  glasses: 'var(--amber)',
  phone: 'var(--green)',
  elevenlabs: '#8b5cf6',
  unknown: 'var(--text-tertiary)',
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
  return `${Math.floor(diff / 86400_000)}d`;
}

export default function TopicStream({ topics, onTopicClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevLenRef = useRef(topics.length);

  useEffect(() => {
    if (autoScroll && topics.length > prevLenRef.current && scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
    prevLenRef.current = topics.length;
  }, [topics.length, autoScroll]);

  return (
    <div className="h-[56px] min-h-[56px] flex items-stretch overflow-hidden"
      style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>

      {/* Label */}
      <div className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{ borderRight: '1px solid var(--border)' }}>
        <div className="w-[5px] h-[5px] rounded-full" style={{ background: '#6366f1' }} />
        <div>
          <div className="text-[10px] font-semibold tracking-wider" style={{ color: 'var(--text-secondary)' }}>TOPICS</div>
          <div className="font-mono text-[9px]" style={{ color: 'var(--text-tertiary)' }}>{topics.length}</div>
        </div>
      </div>

      {/* Scrollable topic pills */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden flex items-center gap-2 px-2"
        onScroll={(e) => {
          setAutoScroll(e.currentTarget.scrollLeft < 10);
        }}
      >
        {topics.length === 0 ? (
          <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>No topics extracted yet</span>
        ) : (
          topics.map((t, i) => {
            const color = SOURCE_COLORS[t.source] || SOURCE_COLORS.unknown;
            return (
              <div
                key={`${t.timestamp}-${i}`}
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors"
                style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)' }}
                onClick={() => onTopicClick?.(t.name)}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <span
                  className="w-[4px] h-[4px] rounded-full flex-shrink-0"
                  style={{ background: color }}
                />
                <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                  {t.name}
                </span>
                <span className="font-mono text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
                  {timeAgo(t.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
