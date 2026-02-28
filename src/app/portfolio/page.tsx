'use client';

import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import StatusBar from '../components/StatusBar';

interface SoldProperty {
  id: string;
  address: string;
  city: string;
  type: string;
  beds: number;
  baths: number;
  sqft: number;
  listPrice: number;
  soldPrice: number;
  soldDate: string;
  clientName: string;
  commission: number;
  daysOnMarket: number;
  image: string;
  notes: string;
}

const SOLD_PROPERTIES: SoldProperty[] = [
  {
    id: 'SOLD-001', address: '15 Avendale', city: 'Irvine', type: 'Single Family',
    beds: 4, baths: 3, sqft: 2450, listPrice: 1285000, soldPrice: 1342000,
    soldDate: 'Nov 2024', clientName: 'Marcus & Elena Reyes', commission: 40260,
    daysOnMarket: 9, image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop&q=80',
    notes: 'Multiple offers. Sold 4.4% over asking.',
  },
  {
    id: 'SOLD-002', address: '88 Canopy Ln', city: 'Lake Forest', type: 'Single Family',
    beds: 5, baths: 4, sqft: 3200, listPrice: 1520000, soldPrice: 1572000,
    soldDate: 'Oct 2024', clientName: 'David & Priya Thornton', commission: 47160,
    daysOnMarket: 6, image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop&q=80',
    notes: '6 offers in 72 hrs. Top-matched buyer via EstateOS.',
  },
  {
    id: 'SOLD-003', address: '330 Bayside Dr', city: 'Newport Beach', type: 'Single Family',
    beds: 4, baths: 4, sqft: 3600, listPrice: 2800000, soldPrice: 2865000,
    soldDate: 'Sep 2024', clientName: 'James Whitfield', commission: 85950,
    daysOnMarket: 14, image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&h=400&fit=crop&q=80',
    notes: 'Waterfront property. Sold above zestimate.',
  },
  {
    id: 'SOLD-004', address: '8 Monarch Bay', city: 'Laguna Niguel', type: 'Single Family',
    beds: 5, baths: 4, sqft: 3400, listPrice: 1850000, soldPrice: 1905000,
    soldDate: 'Sep 2024', clientName: 'Sandra & Cole Merritt', commission: 57150,
    daysOnMarket: 5, image: 'https://images.unsplash.com/photo-1600566753376-12c8ab7a3de6?w=600&h=400&fit=crop&q=80',
    notes: 'Fastest close of the quarter at 5 days.',
  },
  {
    id: 'SOLD-005', address: '44 Ridgeline', city: 'Lake Forest', type: 'Single Family',
    beds: 4, baths: 3, sqft: 2750, listPrice: 1350000, soldPrice: 1389000,
    soldDate: 'Aug 2024', clientName: 'Tyler & Mia Chen', commission: 41670,
    daysOnMarket: 11, image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop&q=80',
    notes: 'AI-matched buyer from intelligence graph.',
  },
  {
    id: 'SOLD-006', address: '115 Paseo Real', city: 'San Juan Cap.', type: 'Single Family',
    beds: 5, baths: 4, sqft: 3300, listPrice: 1680000, soldPrice: 1710000,
    soldDate: 'Aug 2024', clientName: 'Robert & Anya Kowalski', commission: 51300,
    daysOnMarket: 8, image: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=600&h=400&fit=crop&q=80',
    notes: 'Seller received 1.8% over asking in a cooling market.',
  },
  {
    id: 'SOLD-007', address: '915 Baker St', city: 'Costa Mesa', type: 'Single Family',
    beds: 3, baths: 2, sqft: 1800, listPrice: 1080000, soldPrice: 1095000,
    soldDate: 'Jul 2024', clientName: 'Leo & Grace Navarro', commission: 32850,
    daysOnMarket: 7, image: 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=600&h=400&fit=crop&q=80',
    notes: 'Clean all-cash offer. Zero contingencies.',
  },
  {
    id: 'SOLD-008', address: '9 Silverleaf', city: 'Irvine', type: 'Single Family',
    beds: 5, baths: 4, sqft: 3100, listPrice: 1620000, soldPrice: 1675000,
    soldDate: 'Jul 2024', clientName: 'Amir & Sophie Khalil', commission: 50250,
    daysOnMarket: 4, image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&h=400&fit=crop&q=80',
    notes: 'Record low DOM for Irvine. Top ROI property.',
  },
  {
    id: 'SOLD-009', address: '805 Valencia Dr', city: 'Fullerton', type: 'Single Family',
    beds: 4, baths: 2, sqft: 2100, listPrice: 920000, soldPrice: 945000,
    soldDate: 'Jun 2024', clientName: 'Hannah & Paul Ostrowski', commission: 28350,
    daysOnMarket: 13, image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop&q=80',
    notes: 'First-time buyer matched via EstateOS risk scoring.',
  },
  {
    id: 'SOLD-010', address: '610 Pacific Coast', city: 'Huntington Bch', type: 'Single Family',
    beds: 4, baths: 3, sqft: 2600, listPrice: 1950000, soldPrice: 2020000,
    soldDate: 'May 2024', clientName: 'Noah & Isabel Castillo', commission: 60600,
    daysOnMarket: 10, image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=400&fit=crop&q=80',
    notes: 'Beachside property. Highest single commission of H1.',
  },
  {
    id: 'SOLD-011', address: '19 La Paz', city: 'Mission Viejo', type: 'Single Family',
    beds: 4, baths: 3, sqft: 2300, listPrice: 980000, soldPrice: 992000,
    soldDate: 'Apr 2024', clientName: 'Claire & Ben Sutton', commission: 29760,
    daysOnMarket: 18, image: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=600&h=400&fit=crop&q=80',
    notes: 'Well-priced family home. Steady neighborhood comps.',
  },
  {
    id: 'SOLD-012', address: '42 Pacific Park', city: 'Aliso Viejo', type: 'Townhome',
    beds: 3, baths: 2, sqft: 1580, listPrice: 820000, soldPrice: 838000,
    soldDate: 'Mar 2024', clientName: 'Diana & Ethan Fox', commission: 25140,
    daysOnMarket: 15, image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&h=400&fit=crop&q=80',
    notes: 'Townhome with strong HOA amenities. Smooth escrow.',
  },
];

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${(n / 1_000).toFixed(0)}K`;
}

function calcStats(props: SoldProperty[]) {
  const avgDOM = Math.round(props.reduce((a, p) => a + p.daysOnMarket, 0) / props.length);
  const avgProfit = +(props.reduce((a, p) => a + ((p.soldPrice - p.listPrice) / p.listPrice) * 100, 0) / props.length).toFixed(1);
  const totalVolume = props.reduce((a, p) => a + p.soldPrice, 0);
  const totalCommission = props.reduce((a, p) => a + p.commission, 0);
  return { avgDOM, avgProfit, totalVolume, totalCommission };
}

export default function PortfolioPage() {
  const [selected, setSelected] = useState<SoldProperty | null>(null);
  const [graphStats, setGraphStats] = useState<{ nodes: number; edges: number; avgConnections: number } | null>(null);

  const stats = calcStats(SOLD_PROPERTIES);

  // Fetch knowledge graph stats for additional intelligence metrics
  useEffect(() => {
    fetch('/api/graph')
      .then((r) => r.json())
      .then((data) => {
        if (data.stats) {
          setGraphStats({
            nodes: data.stats.totalNodes ?? data.graph?.nodes?.length ?? 0,
            edges: data.stats.totalEdges ?? data.graph?.links?.length ?? 0,
            avgConnections: data.stats.avgConnections ? +data.stats.avgConnections.toFixed(1) : 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  const STAT_CARDS = [
    {
      label: 'Avg. Days on Market',
      value: `${stats.avgDOM}`,
      sub: 'days to close',
      color: 'var(--accent)',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
    },
    {
      label: '% Profit vs. List',
      value: `+${stats.avgProfit}%`,
      sub: 'avg over asking',
      color: 'var(--green)',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
        </svg>
      ),
    },
    {
      label: 'Buyer Match Rate',
      value: '94%',
      sub: 'via EstateOS AI',
      color: '#a78bfa',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      label: 'Total Volume Sold',
      value: formatPrice(stats.totalVolume),
      sub: `${SOLD_PROPERTIES.length} properties closed`,
      color: 'var(--accent)',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
    },
    ...(graphStats ? [
      {
        label: 'Intelligence Graph',
        value: `${graphStats.nodes}`,
        sub: `nodes · ${graphStats.edges} connections`,
        color: 'var(--green)',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="3"/><circle cx="4" cy="19" r="3"/><circle cx="20" cy="19" r="3"/>
            <line x1="12" y1="8" x2="4" y2="16"/><line x1="12" y1="8" x2="20" y2="16"/>
          </svg>
        ),
      },
    ] : []),
  ];

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-body)' }}>
      <NavBar />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-6">

          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-[22px] font-bold text-text-primary tracking-tight">Portfolio</h1>
            <p className="text-[12px] text-text-secondary mt-0.5">
              Closed transactions · Orange County, CA
            </p>
          </div>

          {/* Stats banner */}
          <div className="grid gap-3 mb-8" style={{ gridTemplateColumns: `repeat(${STAT_CARDS.length}, 1fr)` }}>
            {STAT_CARDS.map((s) => (
              <div key={s.label} className="p-4 rounded-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-3" style={{ color: s.color, opacity: 0.7 }}>
                  {s.icon}
                  <span className="text-[10px] font-medium text-text-tertiary tracking-wide uppercase">{s.label}</span>
                </div>
                <div className="font-mono text-[26px] font-bold leading-none" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] text-text-tertiary mt-1">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Commission highlight */}
          <div className="mb-6 px-4 py-3 rounded-sm flex items-center justify-between"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <span className="text-[12px] text-text-secondary">Total commissions earned</span>
            <span className="font-mono text-[18px] font-bold" style={{ color: 'var(--green)' }}>
              {formatPrice(stats.totalCommission)}
            </span>
          </div>

          {/* Grid header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-text-tertiary tracking-widest uppercase">
              Closed Sales
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              {SOLD_PROPERTIES.length} properties
            </span>
          </div>

          {/* Property grid */}
          <div className="grid grid-cols-3 gap-3 xl:grid-cols-4">
            {SOLD_PROPERTIES.map((p) => {
              const profit = p.soldPrice - p.listPrice;
              const profitPct = ((profit / p.listPrice) * 100).toFixed(1);
              return (
                <div key={p.id}
                  className="rounded-sm overflow-hidden cursor-pointer transition-all hover:scale-[1.01]"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }}
                  onClick={() => setSelected(p)}>

                  {/* Image */}
                  <div className="relative h-[130px] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt={p.address} className="w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 55%)' }} />

                    {/* Sold badge */}
                    <span className="absolute top-2 left-2 font-mono text-[9px] font-bold px-2 py-0.5 rounded-sm"
                      style={{ background: 'rgba(5,150,105,0.9)', color: 'white', backdropFilter: 'blur(4px)' }}>
                      SOLD · {p.soldDate}
                    </span>

                    {/* Sold price */}
                    <span className="absolute bottom-2 left-2.5 font-mono text-[15px] font-bold text-white"
                      style={{ textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>
                      {formatPrice(p.soldPrice)}
                    </span>

                    {/* Profit badge */}
                    <span className="absolute bottom-2 right-2 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-sm"
                      style={{ background: 'rgba(5,150,105,0.85)', color: 'white' }}>
                      +{profitPct}%
                    </span>
                  </div>

                  {/* Info */}
                  <div className="px-3 py-2.5">
                    <div className="text-[12px] font-semibold text-text-primary truncate">{p.address}</div>
                    <div className="text-[10px] text-text-tertiary mb-2">
                      {p.city} &middot; {p.beds}bd {p.baths}ba &middot; {p.sqft.toLocaleString()} sf
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ color: 'var(--text-tertiary)' }}>
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span className="font-mono text-[9px] text-text-tertiary">{p.daysOnMarket}d DOM</span>
                      </div>
                      <span className="text-[9px] text-text-tertiary truncate max-w-[100px]">{p.clientName.split(' ')[0]} {p.clientName.split(' ').at(-1)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <StatusBar />

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-[480px] max-h-[85vh] overflow-y-auto rounded-sm"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}>

            {/* Hero */}
            <div className="relative h-[180px] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.image} alt={selected.address} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.65) 0%, transparent 50%)' }} />

              <button onClick={() => setSelected(null)}
                className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center cursor-pointer rounded-sm"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.7)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>

              <span className="absolute top-3 left-3 font-mono text-[9px] font-bold px-2 py-0.5 rounded-sm"
                style={{ background: 'rgba(5,150,105,0.9)', color: 'white' }}>
                CLOSED · {selected.soldDate}
              </span>

              <div className="absolute bottom-3 left-4">
                <span className="font-mono text-[26px] font-semibold text-white leading-none" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                  {formatPrice(selected.soldPrice)}
                </span>
              </div>
            </div>

            <div className="p-5">
              <h2 className="text-[20px] font-bold text-text-primary leading-tight">{selected.address}</h2>
              <p className="text-[12px] text-text-secondary mt-0.5 mb-4">
                {selected.city}, CA &middot; {selected.type} &middot; {selected.beds}bd {selected.baths}ba &middot; {selected.sqft.toLocaleString()} sf
              </p>

              {/* Key stats */}
              <div className="grid grid-cols-3 gap-1 mb-4">
                {[
                  { label: 'List Price', value: formatPrice(selected.listPrice), color: 'var(--text-primary)' },
                  { label: 'Sold Price', value: formatPrice(selected.soldPrice), color: 'var(--green)' },
                  {
                    label: 'Over Asking',
                    value: `+${(((selected.soldPrice - selected.listPrice) / selected.listPrice) * 100).toFixed(1)}%`,
                    color: 'var(--green)',
                  },
                ].map((s) => (
                  <div key={s.label} className="text-center py-3 rounded-sm" style={{ background: 'var(--bg-muted)' }}>
                    <div className="font-mono text-[15px] font-semibold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[9px] text-text-tertiary mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Details rows */}
              <div className="space-y-px rounded-sm overflow-hidden mb-4">
                {[
                  { label: 'Client', value: selected.clientName },
                  { label: 'Days on Market', value: `${selected.daysOnMarket} days` },
                  { label: 'Commission Earned', value: `$${selected.commission.toLocaleString()}` },
                  { label: 'Price per Sq Ft', value: `$${Math.round(selected.soldPrice / selected.sqft)}/sf` },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between py-2 px-3" style={{ background: 'var(--bg-muted)' }}>
                    <span className="text-[11px] text-text-secondary">{r.label}</span>
                    <span className="font-mono text-[11px] text-text-primary font-medium">{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {selected.notes && (
                <div className="px-3 py-2.5 rounded-sm" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
                  <p className="text-[10px] text-text-tertiary leading-relaxed italic">&ldquo;{selected.notes}&rdquo;</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
