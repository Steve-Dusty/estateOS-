'use client';

import { useState, useMemo } from 'react';
import type { GraphNode } from '@/types/graph';

interface Props {
  nodes: GraphNode[];
  onSelect: (node: GraphNode) => void;
}

export default function SearchBar({ nodes, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return nodes
      .filter(n => n.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, nodes]);

  return (
    <div className="relative">
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ color: 'var(--text-tertiary)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder="Search…"
          className="w-[160px] pl-7 pr-2.5 py-1.5 text-[11px] font-medium rounded-sm focus:outline-none transition-all"
          style={{
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
          onMouseEnter={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
      </div>

      {focused && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full rounded-sm overflow-hidden z-50"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(6,182,212,0.04)',
          }}>
          {results.map(node => (
            <button
              key={node.id}
              onClick={() => {
                onSelect(node);
                setQuery('');
              }}
              className="w-full px-2.5 py-1.5 text-left flex items-center gap-2 transition-colors cursor-pointer"
              style={{ background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span
                className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                style={{ backgroundColor: node.color || 'var(--accent)' }}
              />
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{node.name}</span>
              <span className="text-[9px] font-mono ml-auto" style={{ color: 'var(--text-tertiary)' }}>{node.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
