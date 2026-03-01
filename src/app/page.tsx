'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import NavBar from './components/NavBar';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import PropertyModal from './components/PropertyModal';

const MapView = dynamic(() => import('./components/MapView'), { ssr: false });
import { Property, PROPERTIES, formatPrice } from './lib/properties';

function PropertySearch({ onSelect }: { onSelect: (p: Property) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q = query.toLowerCase().trim();
  const results = q.length > 0
    ? PROPERTIES.filter(p =>
        p.address.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      ).slice(0, 8)
    : [];

  return (
    <div ref={ref} className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-[360px]">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (q.length > 0) setOpen(true); }}
          placeholder="Search properties..."
          className="w-full pl-9 pr-3 py-2 text-[13px] rounded-md border outline-none text-text-primary placeholder:text-text-tertiary"
          style={{
            background: 'rgba(13,17,23,0.85)',
            backdropFilter: 'blur(12px)',
            borderColor: 'var(--border)',
          }}
        />
      </div>
      {open && results.length > 0 && (
        <div
          className="mt-1 rounded-md border overflow-hidden"
          style={{ background: 'rgba(13,17,23,0.92)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}
        >
          {results.map(p => (
            <button
              key={p.id}
              className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
              onClick={() => { onSelect(p); setQuery(p.address); setOpen(false); }}
            >
              <div>
                <div className="text-[12px] font-medium text-text-primary">{p.address}</div>
                <div className="text-[10px] text-text-tertiary">{p.city} &middot; {p.beds}bd {p.baths}ba &middot; {p.sqft.toLocaleString()} sf</div>
              </div>
              <span className="font-mono text-[11px] text-text-secondary">{formatPrice(p.price)}</span>
            </button>
          ))}
        </div>
      )}
      {open && q.length > 0 && results.length === 0 && (
        <div
          className="mt-1 rounded-md border px-3 py-2 text-[11px] text-text-tertiary"
          style={{ background: 'rgba(13,17,23,0.92)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}
        >
          No properties found
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [modalProperty, setModalProperty] = useState<Property | null>(null);

  const handleSelectProperty = useCallback((property: Property) => {
    setSelectedProperty(property);
    setModalProperty(property);
  }, []);

  const handleMapSelectProperty = useCallback((property: Property) => {
    setSelectedProperty(property);
    setModalProperty(property);
  }, []);

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-body)' }}>
      <NavBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          selectedId={selectedProperty?.id ?? null}
          onSelect={handleSelectProperty}
        />
        <div className="flex-1 relative flex flex-col">
          <PropertySearch onSelect={handleSelectProperty} />
          <MapView
            selectedProperty={selectedProperty}
            onSelectProperty={handleMapSelectProperty}
          />
        </div>
      </div>
      <StatusBar />
      {modalProperty && (
        <PropertyModal
          property={modalProperty}
          onClose={() => setModalProperty(null)}
        />
      )}
    </div>
  );
}
