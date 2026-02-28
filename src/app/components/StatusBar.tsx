'use client';

import { useEffect, useState } from 'react';

export default function StatusBar() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' }));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-[28px] flex items-center justify-between px-4 border-t relative z-10"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
        <div className="flex items-center gap-1">
          <div className="w-[4px] h-[4px] status-live" style={{ background: 'var(--green)' }} />
          <span>Operational</span>
        </div>
        <span>&middot;</span>
        <span>Orange County, CA</span>
        <span>&middot;</span>
        <span>8 feeds</span>
      </div>
      <div className="font-mono text-[10px] text-text-tertiary">{time}</div>
    </div>
  );
}
