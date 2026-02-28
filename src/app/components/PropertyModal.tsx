'use client';

import { useState, useCallback, useEffect } from 'react';
import { Property, formatPrice, getRiskLabel } from '../lib/properties';

interface PropertyModalProps {
  property: Property;
  onClose: () => void;
}

type ModalTab = 'overview' | 'ads';
interface SavedAd { url: string; createdAt: number; }

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function PropertyModal({ property, onClose }: PropertyModalProps) {
  const risk = getRiskLabel(property.riskScore);
  const [tab, setTab] = useState<ModalTab>('overview');
  const [adGenerating, setAdGenerating] = useState(false);
  const [savedAds, setSavedAds] = useState<SavedAd[]>([]);
  const [playingAd, setPlayingAd] = useState<SavedAd | null>(null);

  const adsKey = `estateos_ads_${property.id}`;

  // Load saved ads from localStorage
  useEffect(() => {
    try {
      setSavedAds(JSON.parse(localStorage.getItem(adsKey) || '[]'));
    } catch {
      setSavedAds([]);
    }
  }, [adsKey]);

  const persistAds = useCallback((ads: SavedAd[]) => {
    setSavedAds(ads);
    localStorage.setItem(adsKey, JSON.stringify(ads));
  }, [adsKey]);

  const generateAd = useCallback(async () => {
    setAdGenerating(true);
    const adPrompt = `Cinematic real estate advertisement for a ${property.beds}-bedroom ${property.type} at ${property.address} in ${property.city}, CA - listed at ${formatPrice(property.price)}, ${property.sqft.toLocaleString()} sq ft, stunning interiors with modern finishes, aerial drone shots, golden hour lighting`;
    try {
      // Convert property image to base64 for Veo image input
      let imageBase64: string | undefined;
      try {
        imageBase64 = await urlToBase64(property.image);
      } catch {
        // Fall back to prompt-only if image fetch fails
      }

      const body: Record<string, string> = { prompt: adPrompt };
      if (imageBase64) body.imageBase64 = imageBase64;

      const r = await fetch('/api/veo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      const res = await r.json();
      const newAd: SavedAd = { url: res.videoUrl, createdAt: Date.now() };
      persistAds([...savedAds, newAd]);
    } catch (e) {
      console.error(e);
    } finally {
      setAdGenerating(false);
    }
  }, [property, savedAds, persistAds]);

  const deleteAd = useCallback((idx: number) => {
    persistAds(savedAds.filter((_, i) => i !== idx));
  }, [savedAds, persistAds]);

  const formatAdDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        <div className="relative modal-enter w-[480px] max-h-[85vh] overflow-y-auto rounded-sm"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
          onClick={(e) => e.stopPropagation()}>

          {/* Hero */}
          <div className="relative h-[180px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
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

          {/* Header info */}
          <div className="px-5 pt-4 pb-0">
            <h2 className="text-[20px] font-bold text-text-primary leading-tight">{property.address}</h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              {property.city}, CA &middot; {property.type} &middot; Built {property.yearBuilt}
            </p>
          </div>

          {/* Tab Toggle */}
          <div className="px-5 pt-3 pb-0 flex gap-1">
            {(['overview', 'ads'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-4 py-1.5 text-[11px] font-semibold rounded-sm transition-all capitalize flex items-center gap-1.5 cursor-pointer"
                style={{
                  background: tab === t ? 'var(--accent)' : 'var(--bg-muted)',
                  color: tab === t ? 'white' : 'var(--text-secondary)',
                }}>
                {t === 'ads' && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                )}
                {t === 'overview' ? 'Overview' : `Ads${savedAds.length > 0 ? ` (${savedAds.length})` : ''}`}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {tab === 'overview' && (
              <>
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
                  <button
                    onClick={() => setTab('ads')}
                    className="flex-1 py-2.5 text-[12px] font-semibold transition-all rounded-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    {savedAds.length > 0 ? `View Ads (${savedAds.length})` : 'Generate Ad'}
                  </button>
                </div>
              </>
            )}

            {tab === 'ads' && (
              <>
                {/* Generate button */}
                <div className="mb-4">
                  <button
                    onClick={generateAd}
                    disabled={adGenerating}
                    className="w-full py-2.5 text-[12px] font-semibold transition-all rounded-sm flex items-center justify-center gap-2"
                    style={{
                      background: adGenerating ? 'var(--bg-muted)' : '#7c3aed',
                      color: adGenerating ? 'var(--text-tertiary)' : 'white',
                      cursor: adGenerating ? 'not-allowed' : 'pointer',
                      opacity: adGenerating ? 0.7 : 1,
                    }}>
                    {adGenerating ? (
                      <>
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white', animation: 'spin .8s linear infinite' }} />
                        Generating ad — this may take 1–3 minutes…
                      </>
                    ) : (
                      <>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        Generate New Ad with Veo
                      </>
                    )}
                  </button>
                  <p className="mt-1.5 text-[10px] text-text-tertiary text-center">
                    AI-generated cinematic property advertisement via Google Veo
                  </p>
                </div>

                {/* Saved ads list */}
                {savedAds.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div style={{ opacity: 0.15, color: 'var(--accent)' }} className="mb-3">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </div>
                    <p className="text-[12px] text-text-tertiary">No ads generated yet.</p>
                    <p className="text-[10px] text-text-tertiary mt-1">Click the button above to create your first property ad.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedAds.map((ad, idx) => (
                      <div key={idx} className="rounded-sm overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                        {/* Ad header */}
                        <div className="px-3 py-2 flex items-center justify-between" style={{ background: 'var(--bg-muted)' }}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                              Google Veo
                            </span>
                            <span className="text-[10px] text-text-tertiary">{formatAdDate(ad.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setPlayingAd(ad)}
                              className="px-2 py-1 text-[10px] font-semibold rounded-sm transition-all cursor-pointer flex items-center gap-1"
                              style={{ background: '#7c3aed', color: 'white' }}>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                              </svg>
                              Play
                            </button>
                            <button
                              onClick={() => deleteAd(idx)}
                              className="w-6 h-6 flex items-center justify-center rounded-sm transition-all cursor-pointer"
                              style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--red)' }}
                              title="Delete ad">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                            </button>
                          </div>
                        </div>
                        {/* Video thumbnail / preview */}
                        <video
                          src={ad.url}
                          className="w-full block"
                          style={{ maxHeight: 180, background: '#000', display: 'block' }}
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setPlayingAd(null)}>
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
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                  Google Veo
                </span>
              </div>
              <video
                src={playingAd.url}
                controls
                autoPlay
                loop
                className="w-full block"
                style={{ background: '#000', maxHeight: '70vh' }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
