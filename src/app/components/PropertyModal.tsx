'use client';

import { Property, formatPrice, getRiskLabel } from '../lib/properties';

interface PropertyModalProps {
  property: Property;
  onClose: () => void;
}

export default function PropertyModal({ property, onClose }: PropertyModalProps) {
  const risk = getRiskLabel(property.riskScore);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative modal-enter w-[480px] max-h-[85vh] overflow-y-auto rounded-sm"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}>

        {/* Hero */}
        <div className="relative h-[180px] overflow-hidden">
          <img src={property.image} alt={property.address} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 50%)' }} />

          <button onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center cursor-pointer rounded-sm"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.7)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>

          <div className="absolute bottom-3 left-4">
            <span className="font-mono text-[24px] font-semibold text-white leading-none" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
              {formatPrice(property.price)}
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="mb-4">
            <h2 className="text-[20px] font-bold text-text-primary leading-tight">{property.address}</h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              {property.city}, CA &middot; {property.type} &middot; Built {property.yearBuilt}
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-1 mb-5">
            {[
              { label: 'Beds', value: property.beds },
              { label: 'Baths', value: property.baths },
              { label: 'Sq Ft', value: property.sqft.toLocaleString() },
              { label: 'ROI', value: `+${property.roi}%`, color: 'var(--green)' },
            ].map(s => (
              <div key={s.label} className="text-center py-3 rounded-sm" style={{ background: 'var(--bg-muted)' }}>
                <div className="font-mono text-[15px] font-semibold" style={{ color: s.color || 'var(--text-primary)' }}>{s.value}</div>
                <div className="text-[9px] text-text-tertiary mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Risk + Estimate */}
          <div className="grid grid-cols-2 gap-1 mb-5">
            <div className="p-3 rounded-sm" style={{ background: 'var(--bg-muted)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-text-secondary">Risk</span>
                <span className="font-mono text-[14px] font-semibold" style={{ color: risk.color }}>{property.riskScore}</span>
              </div>
              <div className="h-[3px] overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full" style={{ width: `${property.riskScore}%`, background: risk.color }} />
              </div>
            </div>
            <div className="p-3 rounded-sm" style={{ background: 'var(--bg-muted)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-text-secondary">Estimate</span>
                <span className="font-mono text-[14px] font-semibold text-accent">{formatPrice(property.zestimate)}</span>
              </div>
              {property.zestimate > property.price ? (
                <span className="font-mono text-[10px]" style={{ color: 'var(--green)' }}>+{formatPrice(property.zestimate - property.price)} upside</span>
              ) : (
                <span className="font-mono text-[10px]" style={{ color: 'var(--red)' }}>-{formatPrice(property.price - property.zestimate)} over</span>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-px mb-5 rounded-sm overflow-hidden">
            {[
              { label: 'Days on market', value: `${property.daysOnMarket}` },
              { label: 'Price / sf', value: `$${Math.round(property.price / property.sqft)}` },
              { label: 'Coords', value: `${property.coordinates[1].toFixed(4)}°N, ${Math.abs(property.coordinates[0]).toFixed(4)}°W` },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between py-2 px-3" style={{ background: 'var(--bg-muted)' }}>
                <span className="text-[11px] text-text-secondary">{r.label}</span>
                <span className="font-mono text-[11px] text-text-primary font-medium">{r.value}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-1.5">
            <button className="flex-1 py-2.5 text-[12px] font-semibold cursor-pointer transition-opacity hover:opacity-90 rounded-sm"
              style={{ background: 'var(--accent)', color: 'white' }}>
              Add to Portfolio
            </button>
            <button className="flex-1 py-2.5 text-[12px] font-semibold cursor-pointer transition-colors hover:bg-bg-muted rounded-sm"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              Watchlist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
