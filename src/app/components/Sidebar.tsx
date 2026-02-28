'use client';

import { Property, PROPERTIES, formatPrice } from '../lib/properties';

interface SidebarProps {
  selectedId: string | null;
  onSelect: (property: Property) => void;
}

export default function Sidebar({ selectedId, onSelect }: SidebarProps) {
  return (
    <div className="w-[260px] min-w-[260px] flex flex-col border-r overflow-hidden relative z-10"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>

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
