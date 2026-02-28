'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Property, PROPERTIES, formatPrice } from '../lib/properties';

interface SidebarProps {
  selectedId: string | null;
  onSelect: (property: Property) => void;
}

export default function Sidebar({ selectedId, onSelect }: SidebarProps) {
  const [width, setWidth] = useState(260);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - startX.current;
      setWidth(Math.max(180, Math.min(500, startW.current + delta)));
    };
    const onMouseUp = () => { isDragging.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, []);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  return (
    <div className="flex flex-col border-r overflow-hidden relative z-10"
      style={{ width, minWidth: 180, maxWidth: 500, borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>

      {/* Drag handle */}
      <div
        className="absolute top-0 right-0 w-[4px] h-full cursor-col-resize z-20 hover:bg-accent/30 active:bg-accent/50 transition-colors"
        onMouseDown={onDragStart}
      />

      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-text-tertiary tracking-widest uppercase">Properties</span>
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>{PROPERTIES.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
        {PROPERTIES.map((property, i) => (
          <div key={property.id}
            className={`prop-card cursor-pointer fade-in d${i + 1} rounded-sm overflow-hidden ${selectedId === property.id ? 'active' : ''}`}
            onClick={() => onSelect(property)}>

            {/* Image */}
            <div className="w-full h-[100px] overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={property.image} alt={property.address}
                className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.55) 0%, transparent 50%)' }} />
              <span className="absolute bottom-1.5 left-2 font-mono text-[14px] font-semibold text-white"
                style={{ textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>
                {formatPrice(property.price)}
              </span>
            </div>

            {/* Info */}
            <div className="px-2.5 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[12px] font-semibold text-text-primary truncate">{property.address}</span>
                <span className="font-mono text-[10px] font-medium" style={{ color: 'var(--green)' }}>+{property.roi}%</span>
              </div>
              <div className="text-[10px] text-text-tertiary">
                {property.city} &middot; {property.beds}bd {property.baths}ba &middot; {property.sqft.toLocaleString()} sf
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
