'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const AGENT_NAV = [
  { label: 'Overview', href: '/' },
  { label: 'Intelligence', href: '/intelligence' },
  { label: 'Reports', href: '/reports' },
  { label: 'Clients', href: '/clients' },
  { label: 'Portfolio', href: '/portfolio' },
];

const CLIENT_NAV = [
  { label: 'Home', href: '/client' },
];

export default function NavBar({ variant = 'agent' }: { variant?: 'agent' | 'client' }) {
  const pathname = usePathname();
  const items = variant === 'client' ? CLIENT_NAV : AGENT_NAV;

  return (
    <nav className="h-[48px] flex items-center justify-between px-4 border-b relative z-10"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>

      <div className="flex items-center gap-3">
        <Link href="/landing" className="flex items-center gap-2 select-none">
          <div className="w-6 h-6 flex items-center justify-center rounded-sm" style={{ background: variant === 'client' ? 'rgba(124,58,237,0.8)' : 'var(--accent)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 22V12h6v10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-[15px] font-semibold text-text-primary tracking-tight">
            EstateOS
          </span>
        </Link>

        <div className="h-4 w-px" style={{ background: 'var(--border)' }} />

        <div className="flex items-center gap-0.5">
          {items.map((item) => {
            const isActive = item.href !== '#' && pathname === item.href;
            return (
              <Link key={item.label} href={item.href}
                className={`px-2.5 py-1 text-[12px] font-medium rounded-sm transition-all
                  ${isActive
                    ? 'text-accent bg-accent-dim'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-muted'
                  }`}>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-2 py-1 rounded-sm" style={{ background: 'var(--green-dim)' }}>
          <div className="w-[5px] h-[5px] rounded-full status-live" style={{ background: 'var(--green)' }} />
          <span className="font-mono text-[10px] font-medium" style={{ color: 'var(--green)' }}>Live</span>
        </div>

        <div className="w-6 h-6 flex items-center justify-center text-[9px] font-bold cursor-pointer rounded-sm"
          style={{ background: variant === 'client' ? 'rgba(124,58,237,0.8)' : 'var(--accent)', color: 'white' }}>
          KQ
        </div>
      </div>
    </nav>
  );
}
