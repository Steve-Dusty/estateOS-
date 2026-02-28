'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, ComposedChart, Line,
} from 'recharts';
import NavBar from '../components/NavBar';
import StatusBar from '../components/StatusBar';

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Data ───────────────────────────────────────────────────────────────────

const SOLD_PROPERTIES: SoldProperty[] = [
  { id: 'SOLD-001', address: '15 Avendale', city: 'Irvine', type: 'Single Family', beds: 4, baths: 3, sqft: 2450, listPrice: 1285000, soldPrice: 1342000, soldDate: 'Nov 2024', clientName: 'Marcus & Elena Reyes', commission: 40260, daysOnMarket: 9, image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop&q=80', notes: 'Multiple offers. Sold 4.4% over asking.' },
  { id: 'SOLD-002', address: '88 Canopy Ln', city: 'Lake Forest', type: 'Single Family', beds: 5, baths: 4, sqft: 3200, listPrice: 1520000, soldPrice: 1572000, soldDate: 'Oct 2024', clientName: 'David & Priya Thornton', commission: 47160, daysOnMarket: 6, image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop&q=80', notes: '6 offers in 72 hrs. Top-matched buyer via EstateOS.' },
  { id: 'SOLD-003', address: '330 Bayside Dr', city: 'Newport Beach', type: 'Single Family', beds: 4, baths: 4, sqft: 3600, listPrice: 2800000, soldPrice: 2865000, soldDate: 'Sep 2024', clientName: 'James Whitfield', commission: 85950, daysOnMarket: 14, image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&h=400&fit=crop&q=80', notes: 'Waterfront property. Sold above zestimate.' },
  { id: 'SOLD-004', address: '8 Monarch Bay', city: 'Laguna Niguel', type: 'Single Family', beds: 5, baths: 4, sqft: 3400, listPrice: 1850000, soldPrice: 1905000, soldDate: 'Sep 2024', clientName: 'Sandra & Cole Merritt', commission: 57150, daysOnMarket: 5, image: 'https://images.unsplash.com/photo-1600566753376-12c8ab7a3de6?w=600&h=400&fit=crop&q=80', notes: 'Fastest close of the quarter at 5 days.' },
  { id: 'SOLD-005', address: '44 Ridgeline', city: 'Lake Forest', type: 'Single Family', beds: 4, baths: 3, sqft: 2750, listPrice: 1350000, soldPrice: 1389000, soldDate: 'Aug 2024', clientName: 'Tyler & Mia Chen', commission: 41670, daysOnMarket: 11, image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop&q=80', notes: 'AI-matched buyer from intelligence graph.' },
  { id: 'SOLD-006', address: '115 Paseo Real', city: 'San Juan Cap.', type: 'Single Family', beds: 5, baths: 4, sqft: 3300, listPrice: 1680000, soldPrice: 1710000, soldDate: 'Aug 2024', clientName: 'Robert & Anya Kowalski', commission: 51300, daysOnMarket: 8, image: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=600&h=400&fit=crop&q=80', notes: 'Seller received 1.8% over asking in a cooling market.' },
  { id: 'SOLD-007', address: '915 Baker St', city: 'Costa Mesa', type: 'Single Family', beds: 3, baths: 2, sqft: 1800, listPrice: 1080000, soldPrice: 1095000, soldDate: 'Jul 2024', clientName: 'Leo & Grace Navarro', commission: 32850, daysOnMarket: 7, image: 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=600&h=400&fit=crop&q=80', notes: 'Clean all-cash offer. Zero contingencies.' },
  { id: 'SOLD-008', address: '9 Silverleaf', city: 'Irvine', type: 'Single Family', beds: 5, baths: 4, sqft: 3100, listPrice: 1620000, soldPrice: 1675000, soldDate: 'Jul 2024', clientName: 'Amir & Sophie Khalil', commission: 50250, daysOnMarket: 4, image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&h=400&fit=crop&q=80', notes: 'Record low DOM for Irvine. Top ROI property.' },
  { id: 'SOLD-009', address: '805 Valencia Dr', city: 'Fullerton', type: 'Single Family', beds: 4, baths: 2, sqft: 2100, listPrice: 920000, soldPrice: 945000, soldDate: 'Jun 2024', clientName: 'Hannah & Paul Ostrowski', commission: 28350, daysOnMarket: 13, image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop&q=80', notes: 'First-time buyer matched via EstateOS risk scoring.' },
  { id: 'SOLD-010', address: '610 Pacific Coast', city: 'Huntington Bch', type: 'Single Family', beds: 4, baths: 3, sqft: 2600, listPrice: 1950000, soldPrice: 2020000, soldDate: 'May 2024', clientName: 'Noah & Isabel Castillo', commission: 60600, daysOnMarket: 10, image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=400&fit=crop&q=80', notes: 'Beachside property. Highest single commission of H1.' },
  { id: 'SOLD-011', address: '19 La Paz', city: 'Mission Viejo', type: 'Single Family', beds: 4, baths: 3, sqft: 2300, listPrice: 980000, soldPrice: 992000, soldDate: 'Apr 2024', clientName: 'Claire & Ben Sutton', commission: 29760, daysOnMarket: 18, image: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=600&h=400&fit=crop&q=80', notes: 'Well-priced family home. Steady neighborhood comps.' },
  { id: 'SOLD-012', address: '42 Pacific Park', city: 'Aliso Viejo', type: 'Townhome', beds: 3, baths: 2, sqft: 1580, listPrice: 820000, soldPrice: 838000, soldDate: 'Mar 2024', clientName: 'Diana & Ethan Fox', commission: 25140, daysOnMarket: 15, image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&h=400&fit=crop&q=80', notes: 'Townhome with strong HOA amenities. Smooth escrow.' },
];

// ─── Chart colour palette (dark theme) ──────────────────────────────────────

const C = {
  grid: 'rgba(255,255,255,0.04)',
  text: '#6b7a90',
  accent: '#06b6d4',
  green: '#059669',
  red: '#dc2626',
  amber: '#d97706',
  purple: '#7c3aed',
  listBar: '#334155',   // muted slate for list price
};

// ─── Pre-computed chart datasets ────────────────────────────────────────────

const DATE_ORDER = ['Mar 2024','Apr 2024','May 2024','Jun 2024','Jul 2024','Aug 2024','Sep 2024','Oct 2024','Nov 2024'];

const timelineData = DATE_ORDER
  .map((month) => {
    const props = SOLD_PROPERTIES.filter((p) => p.soldDate === month);
    if (!props.length) return null;
    return {
      month: month.split(' ')[0],
      revenue: Math.round(props.reduce((a, p) => a + p.soldPrice, 0) / 1000),
      commission: Math.round(props.reduce((a, p) => a + p.commission, 0) / 1000),
      count: props.length,
    };
  })
  .filter(Boolean) as { month: string; revenue: number; commission: number; count: number }[];

const priceCompData = SOLD_PROPERTIES.map((p) => ({
  name: p.address.split(' ').slice(0, 2).join(' '),
  list: Math.round(p.listPrice / 1000),
  sold: Math.round(p.soldPrice / 1000),
  profit: +((p.soldPrice - p.listPrice) / p.listPrice * 100).toFixed(1),
}));

const domData = [...SOLD_PROPERTIES]
  .sort((a, b) => a.daysOnMarket - b.daysOnMarket)
  .map((p) => ({
    name: p.address.split(' ').slice(0, 2).join(' '),
    dom: p.daysOnMarket,
  }));

const cityMap: Record<string, { profit: number; dom: number; count: number }> = {};
SOLD_PROPERTIES.forEach((p) => {
  if (!cityMap[p.city]) cityMap[p.city] = { profit: 0, dom: 0, count: 0 };
  cityMap[p.city].profit += (p.soldPrice - p.listPrice) / p.listPrice * 100;
  cityMap[p.city].dom += p.daysOnMarket;
  cityMap[p.city].count++;
});
const cityData = Object.entries(cityMap)
  .map(([city, d]) => ({
    city: city.length > 11 ? city.slice(0, 10) + '…' : city,
    avgProfit: +(d.profit / d.count).toFixed(2),
    avgDOM: Math.round(d.dom / d.count),
  }))
  .sort((a, b) => b.avgProfit - a.avgProfit);

const AVG_DOM = Math.round(SOLD_PROPERTIES.reduce((a, p) => a + p.daysOnMarket, 0) / SOLD_PROPERTIES.length);
const AVG_PSF = Math.round(SOLD_PROPERTIES.reduce((a, p) => a + p.soldPrice / p.sqft, 0) / SOLD_PROPERTIES.length);

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function domColor(d: number) {
  if (d <= 7) return C.green;
  if (d <= 12) return C.amber;
  return C.red;
}

// ─── Custom tooltip ──────────────────────────────────────────────────────────

function ChartTip({ active, payload, label, suffix = '' }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0f1623', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '8px 12px', fontSize: 11 }}>
      {label && <div style={{ color: '#6b7a90', marginBottom: 5, fontSize: 10, letterSpacing: '0.04em' }}>{label}</div>}
      {payload.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: i > 0 ? 3 : 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
          <span style={{ color: '#8b9ab0', marginRight: 4 }}>{e.name}</span>
          <span style={{ color: e.color, fontFamily: 'monospace', fontWeight: 600 }}>
            {suffix === '%' ? '' : '$'}{e.value.toLocaleString()}{suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Chart section label ─────────────────────────────────────────────────────

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-[11px] font-semibold text-text-tertiary tracking-widest uppercase">{title}</span>
        {sub && <span className="text-[10px] text-text-tertiary opacity-60">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Per-property benchmark chart ────────────────────────────────────────────

function PropertyCharts({ p }: { p: SoldProperty }) {
  const priceData = [
    { name: 'List Price', value: Math.round(p.listPrice / 1000), fill: C.listBar },
    { name: 'Sold Price', value: Math.round(p.soldPrice / 1000), fill: C.green },
  ];
  const benchData = [
    { metric: 'DOM', this: p.daysOnMarket, avg: AVG_DOM },
    { metric: '$/sqft', this: Math.round(p.soldPrice / p.sqft), avg: AVG_PSF },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      {/* List vs Sold */}
      <div className="rounded-sm p-3" style={{ background: '#0c1219', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 10, color: C.text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Price Breakdown
        </div>
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={priceData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="name" tick={{ fill: C.text, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: C.text, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}M`} />
            <Tooltip content={(props) => <ChartTip {...props} suffix="K" />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {priceData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* This vs Portfolio avg */}
      <div className="rounded-sm p-3" style={{ background: '#0c1219', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 10, color: C.text, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          vs Portfolio Avg
        </div>
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={benchData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="metric" tick={{ fill: C.text, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: C.text, fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip content={(props) => <ChartTip {...props} suffix="" />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="this" name="This property" fill={C.accent} radius={[3, 3, 0, 0]} />
            <Bar dataKey="avg" name="Portfolio avg" fill={C.listBar} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          {[{ color: C.accent, label: 'This property' }, { color: C.listBar, label: 'Portfolio avg' }].map((l) => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
              <span style={{ fontSize: 9, color: C.text }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [selected, setSelected] = useState<SoldProperty | null>(null);
  const [graphStats, setGraphStats] = useState<{ nodes: number; edges: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const stats = calcStats(SOLD_PROPERTIES);

  useEffect(() => {
    setMounted(true);
    fetch('/api/graph')
      .then((r) => r.json())
      .then((data) => {
        if (data.stats || data.graph) {
          setGraphStats({
            nodes: data.stats?.totalNodes ?? data.graph?.nodes?.length ?? 0,
            edges: data.stats?.totalEdges ?? data.graph?.links?.length ?? 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-body)' }}>
      <NavBar />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-6">

          {/* Header + KPI strip */}
          <div className="flex items-end justify-between mb-6">
            <div>
              <h1 className="text-[22px] font-bold text-text-primary tracking-tight">Portfolio</h1>
              <p className="text-[12px] text-text-secondary mt-0.5">Closed transactions · Orange County, CA</p>
            </div>
            {/* Compact KPI strip */}
            <div className="flex items-center gap-1">
              {[
                { label: 'Avg DOM', value: `${stats.avgDOM}d`, color: 'var(--accent)' },
                { label: 'Avg Profit', value: `+${stats.avgProfit}%`, color: 'var(--green)' },
                { label: 'Match Rate', value: '94%', color: '#a78bfa' },
                { label: 'Volume', value: formatPrice(stats.totalVolume), color: 'var(--accent)' },
                { label: 'Commission', value: formatPrice(stats.totalCommission), color: 'var(--green)' },
                ...(graphStats ? [{ label: 'Graph', value: `${graphStats.nodes} nodes`, color: 'var(--green)' }] : []),
              ].map((k, i, arr) => (
                <div key={k.label} className="flex items-center gap-1">
                  <div className="px-3 py-1.5 rounded-sm text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <div className="font-mono text-[13px] font-bold leading-none" style={{ color: k.color }}>{k.value}</div>
                    <div className="text-[9px] text-text-tertiary mt-0.5 tracking-wide">{k.label}</div>
                  </div>
                  {i < arr.length - 1 && <div className="w-px h-6" style={{ background: 'var(--border)' }} />}
                </div>
              ))}
            </div>
          </div>

          {/* ── Analytics section ───────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-text-tertiary tracking-widest uppercase">Analytics</span>
          </div>

          {mounted && (
            <>
              {/* Row 1: Revenue Timeline + City Performance */}
              <div className="grid grid-cols-3 gap-3 mb-3">

                {/* Revenue Timeline — spans 2 cols */}
                <div className="col-span-2">
                  <ChartCard title="Monthly Sales Revenue" sub="Mar – Nov 2024">
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={timelineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={C.accent} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={C.green} stopOpacity={0.15} />
                            <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: C.text, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: C.text, fontSize: 10 }} axisLine={false} tickLine={false}
                          tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}M` : `$${v}K`} />
                        <Tooltip content={(props) => <ChartTip {...props} suffix="K" />} cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }} />
                        <Area type="monotone" dataKey="revenue" name="Revenue" stroke={C.accent} strokeWidth={2} fill="url(#revGrad)" dot={{ fill: C.accent, r: 3 }} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="commission" name="Commission" stroke={C.green} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                      {[{ color: C.accent, label: 'Revenue ($K)' }, { color: C.green, label: 'Commission ($K)', dashed: true }].map((l) => (
                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 16, height: 2, borderRadius: 1, background: l.dashed ? 'transparent' : l.color, borderTop: l.dashed ? `2px dashed ${l.color}` : undefined }} />
                          <span style={{ fontSize: 10, color: C.text }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                </div>

                {/* City Performance — 1 col */}
                <ChartCard title="Avg. Profit % by City" sub="over list price">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={cityData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid horizontal={false} stroke={C.grid} />
                      <XAxis type="number" tick={{ fill: C.text, fontSize: 9 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
                      <YAxis type="category" dataKey="city" tick={{ fill: C.text, fontSize: 9 }} axisLine={false} tickLine={false} width={72} />
                      <Tooltip content={(props) => <ChartTip {...props} suffix="%" />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="avgProfit" name="Avg profit %" radius={[0, 3, 3, 0]}>
                        {cityData.map((_, i) => (
                          <Cell key={i} fill={C.green} fillOpacity={1 - i * 0.06} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* Row 2: List vs Sold + DOM */}
              <div className="grid grid-cols-2 gap-3 mb-8">

                {/* List vs Sold */}
                <ChartCard title="List vs. Sold Price" sub="all properties ($K)">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={priceCompData} margin={{ top: 4, right: 4, left: 0, bottom: 24 }}>
                      <CartesianGrid vertical={false} stroke={C.grid} />
                      <XAxis dataKey="name" tick={{ fill: C.text, fontSize: 8 }} axisLine={false} tickLine={false}
                        angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: C.text, fontSize: 9 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}M` : `$${v}K`} />
                      <Tooltip content={(props) => <ChartTip {...props} suffix="K" />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="list" name="List price" fill={C.listBar} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="sold" name="Sold price" fill={C.green} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                    {[{ color: C.listBar, label: 'List price' }, { color: C.green, label: 'Sold price' }].map((l) => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                        <span style={{ fontSize: 10, color: C.text }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </ChartCard>

                {/* Days on Market */}
                <ChartCard title="Days on Market" sub={`avg ${AVG_DOM} days · sorted fastest → slowest`}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={domData} margin={{ top: 4, right: 4, left: 0, bottom: 24 }}>
                      <CartesianGrid vertical={false} stroke={C.grid} />
                      <XAxis dataKey="name" tick={{ fill: C.text, fontSize: 8 }} axisLine={false} tickLine={false}
                        angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: C.text, fontSize: 9 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `${v}d`} />
                      <Tooltip content={(props) => <ChartTip {...props} suffix=" days" />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <ReferenceLine y={AVG_DOM} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 3"
                        label={{ value: `Avg ${AVG_DOM}d`, fill: 'rgba(255,255,255,0.35)', fontSize: 9, position: 'insideTopRight' }} />
                      <Bar dataKey="dom" name="Days on market" radius={[2, 2, 0, 0]}>
                        {domData.map((d, i) => (
                          <Cell key={i} fill={domColor(d.dom)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                    {[{ color: C.green, label: '≤7 days' }, { color: C.amber, label: '8–12 days' }, { color: C.red, label: '>12 days' }].map((l) => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                        <span style={{ fontSize: 10, color: C.text }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              </div>
            </>
          )}

          {/* ── Property grid ───────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-text-tertiary tracking-widest uppercase">Closed Sales</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              {SOLD_PROPERTIES.length} properties
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 xl:grid-cols-4">
            {SOLD_PROPERTIES.map((p) => {
              const profitPct = ((p.soldPrice - p.listPrice) / p.listPrice * 100).toFixed(1);
              return (
                <div key={p.id}
                  className="rounded-sm overflow-hidden cursor-pointer transition-all hover:scale-[1.01]"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }}
                  onClick={() => setSelected(p)}>
                  <div className="relative h-[130px] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt={p.address} className="w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 55%)' }} />
                    <span className="absolute top-2 left-2 font-mono text-[9px] font-bold px-2 py-0.5 rounded-sm"
                      style={{ background: 'rgba(5,150,105,0.9)', color: 'white', backdropFilter: 'blur(4px)' }}>
                      SOLD · {p.soldDate}
                    </span>
                    <span className="absolute bottom-2 left-2.5 font-mono text-[15px] font-bold text-white"
                      style={{ textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>
                      {formatPrice(p.soldPrice)}
                    </span>
                    <span className="absolute bottom-2 right-2 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-sm"
                      style={{ background: 'rgba(5,150,105,0.85)', color: 'white' }}>
                      +{profitPct}%
                    </span>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="text-[12px] font-semibold text-text-primary truncate">{p.address}</div>
                    <div className="text-[10px] text-text-tertiary mb-2">{p.city} · {p.beds}bd {p.baths}ba · {p.sqft.toLocaleString()} sf</div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] text-text-tertiary">{p.daysOnMarket}d DOM</span>
                      <span className="text-[9px] text-text-tertiary truncate max-w-[100px]">
                        {p.clientName.split(' ')[0]} {p.clientName.split(' ').at(-1)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <StatusBar />

      {/* ── Detail modal ─────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-[560px] max-h-[90vh] overflow-y-auto rounded-sm"
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
                {selected.city}, CA · {selected.type} · {selected.beds}bd {selected.baths}ba · {selected.sqft.toLocaleString()} sf
              </p>

              {/* Key stats */}
              <div className="grid grid-cols-3 gap-1 mb-4">
                {[
                  { label: 'List Price', value: formatPrice(selected.listPrice), color: 'var(--text-primary)' },
                  { label: 'Sold Price', value: formatPrice(selected.soldPrice), color: 'var(--green)' },
                  { label: 'Over Asking', value: `+${(((selected.soldPrice - selected.listPrice) / selected.listPrice) * 100).toFixed(1)}%`, color: 'var(--green)' },
                ].map((s) => (
                  <div key={s.label} className="text-center py-3 rounded-sm" style={{ background: 'var(--bg-muted)' }}>
                    <div className="font-mono text-[15px] font-semibold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[9px] text-text-tertiary mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Details */}
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
                <div className="px-3 py-2.5 rounded-sm mb-4" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
                  <p className="text-[10px] text-text-tertiary leading-relaxed italic">&ldquo;{selected.notes}&rdquo;</p>
                </div>
              )}

              {/* Per-property charts */}
              <div className="text-[10px] font-semibold text-text-tertiary tracking-widest uppercase mb-2">
                Performance Charts
              </div>
              {mounted && <PropertyCharts p={selected} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
