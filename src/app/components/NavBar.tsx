'use client';

import { useState } from 'react';

const NAV_ITEMS = ['Overview', 'Analytics', 'Insights', 'Portfolio'];

export default function NavBar() {
  const [active, setActive] = useState(0);

  return (
    <nav className="h-[48px] flex items-center justify-between px-4 border-b relative z-10"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 cursor-pointer select-none">
          <div className="w-6 h-6 flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 22V12h6v10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-[15px] font-semibold text-text-primary tracking-tight">
            EstateOS
          </span>
        </div>

        <div className="h-4 w-px" style={{ background: 'var(--border)' }} />

        <div className="flex items-center gap-0.5">
          {NAV_ITEMS.map((item, i) => (
            <button key={item} onClick={() => setActive(i)}
              className={`px-2.5 py-1 text-[12px] font-medium transition-all
                ${i === active
                  ? 'text-accent bg-accent-dim'
                  : 'text-text-secondary hover:text-text-primary'
                }`}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-text-tertiary cursor-pointer hover:bg-bg-muted transition-colors"
          style={{ border: '1px solid var(--border)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          Search
        </div>

        <div className="flex items-center gap-1 px-2 py-1" style={{ background: 'var(--green-dim)' }}>
          <div className="w-[5px] h-[5px] status-live" style={{ background: 'var(--green)' }} />
          <span className="font-mono text-[10px] font-medium" style={{ color: 'var(--green)' }}>Live</span>
        </div>

        <div className="w-6 h-6 flex items-center justify-center text-[9px] font-bold cursor-pointer"
          style={{ background: 'var(--accent)', color: 'white' }}>
          KQ
        </div>
      </div>
    </nav>
  );
}
