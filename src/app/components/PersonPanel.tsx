'use client';

import { useEffect, useState } from 'react';
import type { PersonDetail, GraphNode } from '@/types/graph';
import ConversationThread from './ConversationThread';
import MediaGallery from './MediaGallery';

interface Props {
  node: GraphNode | null;
  onClose: () => void;
}

export default function PersonPanel({ node, onClose }: Props) {
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'conversations' | 'topics' | 'media'>('conversations');

  useEffect(() => {
    if (!node || node.type !== 'person') {
      setDetail(null);
      return;
    }

    const personId = node.id.replace('person-', '');
    setLoading(true);
    fetch(`/api/persons/${personId}`)
      .then(res => res.json())
      .then(data => {
        setDetail(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [node]);

  useEffect(() => {
    if (!node) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [node, onClose]);

  if (!node) return null;

  return (
    <div className="fixed left-0 top-[48px] bottom-[28px] w-[300px] z-50 flex flex-col overflow-hidden report-panel-enter"
      style={{
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        boxShadow: '8px 0 40px rgba(0,0,0,0.5), 0 0 60px rgba(6,182,212,0.04)',
      }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-sm flex items-center justify-center text-[12px] font-bold"
            style={{ backgroundColor: node.color || 'var(--accent)', color: '#0d1117' }}
          >
            {node.name[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{node.name}</h2>
            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {node.type === 'person'
                ? `${node.conversationCount || 0} conversations`
                : `${node.mentionCount || 0} mentions`}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-sm flex items-center justify-center transition-colors cursor-pointer"
          style={{ color: 'var(--text-tertiary)', background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Meta info */}
      {detail && (
        <div className="px-3 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            {detail.person.telegram_id && (
              <span>Telegram: <span style={{ color: 'var(--text-secondary)' }}>{detail.person.telegram_id}</span></span>
            )}
            <span>First seen: <span style={{ color: 'var(--text-secondary)' }}>{new Date(detail.person.first_seen_at).toLocaleDateString()}</span></span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        {(['conversations', 'topics', 'media'] as const).map(tab => {
          const isActive = activeTab === tab;
          const count = detail
            ? tab === 'conversations' ? detail.conversations.length
            : tab === 'topics' ? detail.topics.length
            : detail.media.length
            : 0;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 text-[10px] font-semibold tracking-wider uppercase transition-colors cursor-pointer"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
              }}
            >
              {tab.slice(0, 5)}{detail ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="font-mono text-[11px] status-live" style={{ color: 'var(--accent)' }}>Loading...</div>
          </div>
        ) : detail ? (
          <>
            {activeTab === 'conversations' && (
              <ConversationThread
                conversations={detail.conversations}
                personName={detail.person.name}
              />
            )}
            {activeTab === 'topics' && (
              <div className="p-3 flex flex-wrap gap-1.5">
                {detail.topics.map(t => (
                  <span
                    key={t.id}
                    className="px-2 py-1 rounded-sm text-[10px] font-medium"
                    style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.15)' }}
                  >
                    {t.name}
                    <span className="ml-1 opacity-60">({t.person_mention_count})</span>
                  </span>
                ))}
                {detail.topics.length === 0 && (
                  <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>No topics extracted.</div>
                )}
              </div>
            )}
            {activeTab === 'media' && <MediaGallery media={detail.media} />}
          </>
        ) : (
          <div className="p-3" style={{ color: 'var(--text-tertiary)' }}>
            {node.type === 'topic' ? (
              <div>
                <p className="text-[11px]">Topic: <span style={{ color: 'var(--amber)' }}>{node.name}</span></p>
                <p className="text-[10px] mt-1">Mentioned {node.mentionCount || 0} times</p>
              </div>
            ) : (
              <span className="text-[11px]">Select a person to view details.</span>
            )}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="flex-shrink-0 px-3 py-1.5 text-center" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
          <kbd className="px-1 py-px rounded-sm" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)' }}>Esc</kbd> to close
        </span>
      </div>
    </div>
  );
}
