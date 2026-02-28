'use client';

import { useState, useEffect, useCallback } from 'react';
import { Property, PROPERTIES, formatPrice, getRiskLabel } from '../lib/properties';

interface ClientSidebarProps {
  selectedId: string | null;
  onSelect: (property: Property) => void;
}

const WATCHLIST_KEY = 'estateos_watchlist';

interface SavedAd { url: string; createdAt: number; }
type InfoTab = 'details' | 'ads';

function ClientPropertyModal({
  property,
  watchlisted,
  onToggleWatchlist,
  onClose,
}: {
  property: Property;
  watchlisted: boolean;
  onToggleWatchlist: () => void;
  onClose: () => void;
}) {
  const risk = getRiskLabel(property.riskScore);
  const [infoTab, setInfoTab] = useState<InfoTab>('details');
  const [savedAds, setSavedAds] = useState<SavedAd[]>([]);
  const [playingAd, setPlayingAd] = useState<SavedAd | null>(null);

  useEffect(() => {
    try {
      setSavedAds(JSON.parse(localStorage.getItem(`estateos_ads_${property.id}`) || '[]'));
    } catch { setSavedAds([]); }
  }, [property.id]);

  const formatAdDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <>
      <div className="fixed inset-0 z-[55] flex items-center justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />

        <div
          className="relative modal-enter w-[460px] max-h-[85vh] overflow-y-auto rounded-sm"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.55)' }}
          onClick={(e) => e.stopPropagation()}>

          {/* Hero */}
          <div className="relative h-[170px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={property.image} alt={property.address} className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.65) 0%, transparent 55%)' }} />

            {/* Close */}
            <button onClick={onClose}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center cursor-pointer rounded-sm"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.7)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>

            {/* Watchlist toggle */}
            <button
              onClick={onToggleWatchlist}
              className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-semibold transition-all cursor-pointer"
              style={{
                background: watchlisted ? '#7c3aed' : 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)',
                color: 'white',
              }}>
              <svg width="10" height="10" viewBox="0 0 24 24"
                fill={watchlisted ? 'white' : 'none'}
                stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              {watchlisted ? 'Saved' : 'Save'}
            </button>

            <div className="absolute bottom-3 left-4">
              <span className="font-mono text-[22px] font-semibold text-white leading-none" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                {formatPrice(property.price)}
              </span>
            </div>
          </div>

          {/* Header */}
          <div className="px-5 pt-3 pb-0">
            <h2 className="text-[18px] font-bold text-text-primary leading-tight">{property.address}</h2>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {property.city}, CA &middot; {property.type} &middot; Built {property.yearBuilt}
            </p>
          </div>

          {/* Tabs */}
          <div className="px-5 pt-3 pb-0 flex gap-1">
            {(['details', 'ads'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setInfoTab(t)}
                className="px-4 py-1.5 text-[11px] font-semibold rounded-sm transition-all capitalize flex items-center gap-1.5 cursor-pointer"
                style={{
                  background: infoTab === t ? 'var(--accent)' : 'var(--bg-muted)',
                  color: infoTab === t ? 'white' : 'var(--text-secondary)',
                }}>
                {t === 'ads' && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                )}
                {t === 'details' ? 'Details' : `Agent Ads${savedAds.length > 0 ? ` (${savedAds.length})` : ''}`}
              </button>
            ))}
          </div>

          <div className="p-5">
            {infoTab === 'details' && (
              <>
                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-1 mb-4">
                  {[
                    { label: 'Beds', value: property.beds },
                    { label: 'Baths', value: property.baths },
                    { label: 'Sq Ft', value: property.sqft.toLocaleString() },
                    { label: 'ROI', value: `+${property.roi}%`, color: 'var(--green)' },
                  ].map((s) => (
                    <div key={s.label} className="text-center py-3 rounded-sm" style={{ background: 'var(--bg-muted)' }}>
                      <div className="font-mono text-[14px] font-semibold" style={{ color: s.color || 'var(--text-primary)' }}>{s.value}</div>
                      <div className="text-[9px] text-text-tertiary mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Risk + Estimate */}
                <div className="grid grid-cols-2 gap-1 mb-4">
                  <div className="p-3 rounded-sm" style={{ background: 'var(--bg-muted)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-text-secondary">Risk Score</span>
                      <span className="font-mono text-[13px] font-semibold" style={{ color: risk.color }}>{property.riskScore}</span>
                    </div>
                    <div className="h-[3px] overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="h-full rounded-full" style={{ width: `${property.riskScore}%`, background: risk.color }} />
                    </div>
                    <div className="text-[9px] mt-1" style={{ color: risk.color }}>{risk.label} risk</div>
                  </div>
                  <div className="p-3 rounded-sm" style={{ background: 'var(--bg-muted)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-text-secondary">Est. Value</span>
                      <span className="font-mono text-[13px] font-semibold text-accent">{formatPrice(property.zestimate)}</span>
                    </div>
                    {property.zestimate > property.price ? (
                      <span className="font-mono text-[10px]" style={{ color: 'var(--green)' }}>+{formatPrice(property.zestimate - property.price)} upside</span>
                    ) : (
                      <span className="font-mono text-[10px]" style={{ color: 'var(--red)' }}>-{formatPrice(property.price - property.zestimate)} over val.</span>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-px rounded-sm overflow-hidden">
                  {[
                    { label: 'Days on market', value: `${property.daysOnMarket} days` },
                    { label: 'Price per sq ft', value: `$${Math.round(property.price / property.sqft)}` },
                    { label: 'Status', value: property.status.charAt(0).toUpperCase() + property.status.slice(1) },
                    { label: 'Year built', value: `${property.yearBuilt}` },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between py-2 px-3" style={{ background: 'var(--bg-muted)' }}>
                      <span className="text-[11px] text-text-secondary">{r.label}</span>
                      <span className="font-mono text-[11px] text-text-primary font-medium">{r.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {infoTab === 'ads' && (
              <>
                {savedAds.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div style={{ opacity: 0.15, color: 'var(--accent)' }} className="mb-3">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </div>
                    <p className="text-[12px] text-text-tertiary">No ads yet.</p>
                    <p className="text-[10px] text-text-tertiary mt-1 leading-relaxed">
                      Your agent can generate cinematic property ads.<br/>Check back once one is ready.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[10px] text-text-tertiary mb-3">
                      {savedAds.length} ad{savedAds.length !== 1 ? 's' : ''} generated by your agent.
                    </p>
                    {savedAds.map((ad, idx) => (
                      <div key={idx} className="rounded-sm overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                        <div className="px-3 py-2 flex items-center justify-between" style={{ background: 'var(--bg-muted)' }}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                              Google Veo
                            </span>
                            <span className="text-[10px] text-text-tertiary">{formatAdDate(ad.createdAt)}</span>
                          </div>
                          <button
                            onClick={() => setPlayingAd(ad)}
                            className="px-2 py-1 text-[10px] font-semibold rounded-sm cursor-pointer flex items-center gap-1"
                            style={{ background: '#7c3aed', color: 'white' }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                              <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                            Play
                          </button>
                        </div>
                        <video
                          src={ad.url}
                          className="w-full block"
                          style={{ maxHeight: 160, background: '#000' }}
                          muted
                          preload="metadata"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Full-screen video player */}
      {playingAd && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center" onClick={() => setPlayingAd(null)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative w-[92vw] max-w-[960px]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPlayingAd(null)}
              className="absolute -top-9 right-0 flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white transition-colors cursor-pointer">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              Close
            </button>
            <div className="rounded-sm overflow-hidden" style={{ border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center rounded-sm" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  </div>
                  <span className="text-[12px] font-semibold text-text-primary">{property.address} — Property Ad</span>
                </div>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>Google Veo</span>
              </div>
              <video src={playingAd.url} controls autoPlay loop className="w-full block" style={{ background: '#000', maxHeight: '70vh' }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ClientSidebar({ selectedId, onSelect }: ClientSidebarProps) {
  const [tab, setTab] = useState<'properties' | 'watchlist'>('properties');
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [viewingProperty, setViewingProperty] = useState<Property | null>(null);

  useEffect(() => {
    try {
      setWatchlistIds(JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]'));
    } catch {
      setWatchlistIds([]);
    }
  }, []);

  const isWatchlisted = (id: string) => watchlistIds.includes(id);

  const toggleWatchlist = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = watchlistIds.includes(id)
      ? watchlistIds.filter((wid) => wid !== id)
      : [...watchlistIds, id];
    setWatchlistIds(updated);
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
  }, [watchlistIds]);

  const openInfo = useCallback((property: Property, e: React.MouseEvent) => {
    e.stopPropagation();
    setViewingProperty(property);
  }, []);

  const displayed = tab === 'properties'
    ? PROPERTIES
    : PROPERTIES.filter((p) => watchlistIds.includes(p.id));

  return (
    <>
      <div className="w-[260px] min-w-[260px] flex flex-col border-r overflow-hidden relative z-10"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>

        {/* Tab toggle */}
        <div className="px-2 pt-3 pb-2 flex gap-1">
          <button
            onClick={() => setTab('properties')}
            className="flex-1 py-1.5 text-[11px] font-semibold rounded-sm transition-all cursor-pointer"
            style={{
              background: tab === 'properties' ? 'var(--accent)' : 'var(--bg-muted)',
              color: tab === 'properties' ? 'white' : 'var(--text-tertiary)',
            }}>
            Properties
          </button>
          <button
            onClick={() => setTab('watchlist')}
            className="flex-1 py-1.5 text-[11px] font-semibold rounded-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
            style={{
              background: tab === 'watchlist' ? 'var(--accent)' : 'var(--bg-muted)',
              color: tab === 'watchlist' ? 'white' : 'var(--text-tertiary)',
            }}>
            Watchlist
            {watchlistIds.length > 0 && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: tab === 'watchlist' ? 'rgba(255,255,255,0.25)' : 'var(--accent-dim)',
                  color: tab === 'watchlist' ? 'white' : 'var(--accent)',
                }}>
                {watchlistIds.length}
              </span>
            )}
          </button>
        </div>

        {/* Count */}
        <div className="px-3 pb-1 flex items-center justify-between">
          <span className="text-[10px] text-text-tertiary tracking-widest uppercase">
            {tab === 'properties' ? 'All Listings' : 'Saved'}
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            {displayed.length}
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center px-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'var(--text-tertiary)', opacity: 0.4, marginBottom: 8 }}>
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              <p className="text-[11px] text-text-tertiary leading-relaxed">
                No saved properties yet.<br/>
                Click the bookmark icon on any listing to add it to your watchlist.
              </p>
            </div>
          ) : (
            displayed.map((property, i) => (
              <div key={property.id}
                className={`prop-card cursor-pointer fade-in d${Math.min(i + 1, 10)} rounded-sm overflow-hidden ${selectedId === property.id ? 'active' : ''}`}
                onClick={() => onSelect(property)}>

                {/* Image */}
                <div className="w-full h-[100px] overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={property.image} alt={property.address} className="w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.55) 0%, transparent 50%)' }} />
                  <span className="absolute bottom-1.5 left-2 font-mono text-[14px] font-semibold text-white"
                    style={{ textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>
                    {formatPrice(property.price)}
                  </span>

                  {/* Info button (top-left) */}
                  <button
                    onClick={(e) => openInfo(property, e)}
                    className="absolute top-1.5 left-1.5 w-6 h-6 flex items-center justify-center rounded-sm transition-all cursor-pointer"
                    style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', color: 'rgba(255,255,255,0.85)' }}
                    title="View property details">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="8.01"/>
                      <line x1="12" y1="12" x2="12" y2="16"/>
                    </svg>
                  </button>

                  {/* Watchlist bookmark (top-right) */}
                  <button
                    onClick={(e) => toggleWatchlist(property.id, e)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-sm transition-all cursor-pointer"
                    style={{
                      background: isWatchlisted(property.id) ? '#7c3aed' : 'rgba(0,0,0,0.45)',
                      backdropFilter: 'blur(4px)',
                    }}
                    title={isWatchlisted(property.id) ? 'Remove from watchlist' : 'Add to watchlist'}>
                    <svg width="10" height="10" viewBox="0 0 24 24"
                      fill={isWatchlisted(property.id) ? 'white' : 'none'}
                      stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                  </button>
                </div>

                {/* Info row */}
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
            ))
          )}
        </div>
      </div>

      {/* Property info modal */}
      {viewingProperty && (
        <ClientPropertyModal
          property={viewingProperty}
          watchlisted={isWatchlisted(viewingProperty.id)}
          onToggleWatchlist={() => toggleWatchlist(viewingProperty.id)}
          onClose={() => setViewingProperty(null)}
        />
      )}
    </>
  );
}
