'use client';

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';

/* ═══════════════════════════════════════════════════════════════
   FLOYD-STEINBERG DITHERING
   ═══════════════════════════════════════════════════════════════ */
function floydSteinberg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const spread = (i: number, err: number, f: number) => {
    d[i] = d[i + 1] = d[i + 2] = clamp(d[i] + err * f);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const old = d[i];
      const val = old < 128 ? 0 : 255;
      const err = old - val;
      d[i] = d[i + 1] = d[i + 2] = val;
      if (x + 1 < w) spread(i + 4, err, 7 / 16);
      if (y + 1 < h) {
        if (x > 0) spread(((y + 1) * w + (x - 1)) * 4, err, 3 / 16);
        spread(((y + 1) * w + x) * 4, err, 5 / 16);
        if (x + 1 < w) spread(((y + 1) * w + (x + 1)) * 4, err, 1 / 16);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* ═══════════════════════════════════════════════════════════════
   DITHERED IMAGE CANVAS
   ═══════════════════════════════════════════════════════════════ */
function DitheredCanvas({ src, width, height }: { src: string; width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    c.width = width;
    c.height = height;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      floydSteinberg(ctx, width, height);
    };
  }, [src, width, height]);
  return <canvas ref={ref} style={{ width: '100%', height: 'auto', display: 'block', imageRendering: 'pixelated' }} />;
}

/* ═══════════════════════════════════════════════════════════════
   DOT MATRIX HEADING — Canvas-rendered with wave-in animation
   Renders text to offscreen canvas, samples pixels, draws dots
   ═══════════════════════════════════════════════════════════════ */
function DotMatrixHeading({ lines, maxWidth = 920 }: { lines: string[]; maxWidth?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(2.5);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const mainCtx = cvs.getContext('2d') as CanvasRenderingContext2D;

    let animId = 0;
    let cancelled = false;

    // Wait for fonts
    document.fonts.ready.then(() => {
      if (cancelled) return;

      /* ── Offscreen: render text ── */
      const off = document.createElement('canvas');
      const oc = off.getContext('2d');
      if (!oc) return;

      const fontSize = 58;
      const lh = fontSize * 1.3;
      oc.font = `600 ${fontSize}px "DM Sans", sans-serif`;
      let maxW = 0;
      for (const l of lines) { const w = oc.measureText(l).width; if (w > maxW) maxW = w; }

      off.width = Math.ceil(maxW) + 40;
      off.height = Math.ceil(lines.length * lh) + 30;
      oc.font = `600 ${fontSize}px "DM Sans", sans-serif`;
      oc.fillStyle = 'white';
      oc.textAlign = 'center';
      oc.textBaseline = 'top';
      for (let i = 0; i < lines.length; i++) {
        oc.fillText(lines[i], off.width / 2, i * lh + 15);
      }

      /* ── Sample pixels → dot grid ── */
      const data = oc.getImageData(0, 0, off.width, off.height).data;
      const step = 3;
      const cols = Math.ceil(off.width / step);
      const rows = Math.ceil(off.height / step);
      const dotR = 1.15;
      const gap = step;

      cvs.width = cols * gap;
      cvs.height = rows * gap;
      setRatio(cvs.width / cvs.height);

      interface Dot { x: number; y: number; a: number; delay: number }
      const dots: Dot[] = [];
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const sx = gx * step, sy = gy * step;
          if (sx < off.width && sy < off.height) {
            const alpha = data[(sy * off.width + sx) * 4 + 3];
            if (alpha > 60) {
              dots.push({
                x: gx * gap + gap / 2,
                y: gy * gap + gap / 2,
                a: Math.min(alpha / 255, 1),
                delay: (gx / cols) * 600 + Math.random() * 200,
              });
            }
          }
        }
      }

      /* ── Animate dots appearing left→right wave ── */
      const cw = cvs.width, ch = cvs.height;
      const start = performance.now();
      function draw(now: number) {
        if (cancelled) return;
        const t = now - start;
        mainCtx.clearRect(0, 0, cw, ch);
        let done = true;
        for (const d of dots) {
          const progress = t > d.delay ? Math.min((t - d.delay) / 350, 1) : 0;
          if (progress < 1) done = false;
          if (progress > 0) {
            mainCtx.beginPath();
            mainCtx.arc(d.x, d.y, dotR, 0, Math.PI * 2);
            mainCtx.fillStyle = `rgba(215,215,215,${d.a * progress})`;
            mainCtx.fill();
          }
        }
        if (!done) animId = requestAnimationFrame(draw);
      }
      animId = requestAnimationFrame(draw);
    });

    return () => { cancelled = true; cancelAnimationFrame(animId); };
  }, [lines]);

  return (
    <canvas
      ref={ref}
      className="w-full"
      style={{ maxWidth, height: 'auto', aspectRatio: ratio, display: 'block' }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   PARTICLE NETWORK — Interactive background with mouse repulsion
   ═══════════════════════════════════════════════════════════════ */
function ParticleNetwork() {
  const ref = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const canvas: HTMLCanvasElement = el;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    const N = 70, MAX_D = 160;
    interface P { x: number; y: number; vx: number; vy: number; r: number }
    const ps: P[] = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
    }));

    let id: number;
    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const m = mouse.current;
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        const dx = p.x - m.x, dy = p.y - m.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180 && dist > 0) {
          const f = (180 - dist) / 180 * 0.6;
          p.x += (dx / dist) * f; p.y += (dy / dist) * f;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fill();
      }
      ctx.lineWidth = 0.5;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_D) {
            ctx.strokeStyle = `rgba(255,255,255,${(1 - d / MAX_D) * 0.04})`;
            ctx.beginPath();
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(ps[j].x, ps[j].y);
            ctx.stroke();
          }
        }
      }
      id = requestAnimationFrame(loop);
    }
    id = requestAnimationFrame(loop);

    const onMouse = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 }; };
    canvas.addEventListener('mousemove', onMouse, { passive: true });
    canvas.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouse);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

/* ═══════════════════════════════════════════════════════════════
   SCROLL REVEAL — Intersection-observer fade+slide
   ═══════════════════════════════════════════════════════════════ */
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.8s cubic-bezier(.16,1,.3,1) ${delay}s, transform 0.8s cubic-bezier(.16,1,.3,1) ${delay}s`,
    }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3D TILT CARD — Perspective transform follows cursor
   ═══════════════════════════════════════════════════════════════ */
function TiltCard({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const rx = ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * -4;
    const ry = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * 4;
    el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
  }, []);
  const onLeave = useCallback(() => {
    const el = ref.current; if (!el) return;
    el.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)';
  }, []);
  return (
    <div ref={ref} className={className} onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ transition: 'transform 0.25s ease, box-shadow 0.25s ease', transformStyle: 'preserve-3d', ...style }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATED COUNTER — Counts up when scrolled into view
   ═══════════════════════════════════════════════════════════════ */
function Counter({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const [go, setGo] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setGo(true); obs.disconnect(); } }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!go) return;
    const dur = 2000; const t0 = performance.now();
    let id: number;
    function tick(now: number) {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) id = requestAnimationFrame(tick);
    }
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [go, target]);
  return <span ref={ref}>{prefix}{val}{suffix}</span>;
}

/* ═══════════════════════════════════════════════════════════════
   LIVE FEED — Simulated real-time event stream
   ═══════════════════════════════════════════════════════════════ */
const CITIES = ['Irvine', 'Newport Beach', 'Costa Mesa', 'Laguna Beach', 'Tustin', 'Mission Viejo', 'Lake Forest', 'Aliso Viejo'];
const TEMPLATES = [
  { t: 'New listing detected — $CITY', c: '#06B6D4' },
  { t: 'Price drop alert — $CITY', c: '#F59E0B' },
  { t: 'Market signal — $CITY ROI shift', c: '#06B6D4' },
  { t: 'Risk score updated — $CITY', c: '#EF4444' },
  { t: 'Watchlist match — $CITY', c: '#10B981' },
  { t: 'Entity extracted — $CITY feed', c: '#06B6D4' },
];

function LiveFeed() {
  const [events, setEvents] = useState<{ id: number; text: string; time: string; color: string }[]>([]);
  const idRef = useRef(0);
  useEffect(() => {
    const add = () => {
      const tpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];
      const now = new Date();
      setEvents(prev => [
        { id: idRef.current++, text: tpl.t.replace('$CITY', city), time: now.toLocaleTimeString('en-US', { hour12: false }), color: tpl.c },
        ...prev,
      ].slice(0, 7));
    };
    for (let i = 0; i < 5; i++) add();
    const iv = setInterval(add, 2800);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="space-y-1">
      {events.map((e) => (
        <div key={e.id} className="flex items-start gap-3 py-2 px-3 transition-all"
          style={{ borderLeft: `2px solid ${e.color}40`, animation: 'fadeUp 0.3s ease forwards' }}>
          <span className="text-[10px] text-white/20 shrink-0 mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{e.time}</span>
          <span className="text-[12px] text-white/45 leading-snug">{e.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INTERACTIVE MINI MAP — Canvas with animated pins + hover
   ═══════════════════════════════════════════════════════════════ */
const PINS = [
  { x: 0.42, y: 0.32, label: 'Irvine', c: '#06B6D4', signals: 12 },
  { x: 0.52, y: 0.22, label: 'Tustin', c: '#06B6D4', signals: 5 },
  { x: 0.68, y: 0.40, label: 'Newport Beach', c: '#10B981', signals: 8 },
  { x: 0.32, y: 0.55, label: 'Lake Forest', c: '#06B6D4', signals: 3 },
  { x: 0.75, y: 0.28, label: 'Costa Mesa', c: '#F59E0B', signals: 7 },
  { x: 0.25, y: 0.72, label: 'Mission Viejo', c: '#06B6D4', signals: 4 },
  { x: 0.62, y: 0.68, label: 'Laguna Beach', c: '#EF4444', signals: 6 },
  { x: 0.48, y: 0.48, label: 'HQ', c: '#06B6D4', signals: 32 },
];

function MiniMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -1, y: -1 });

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const W = 600, H = 420;
    c.width = W; c.height = H;
    let time = 0, id: number;

    function draw() {
      time += 0.025;
      ctx.clearRect(0, 0, W, H);

      /* grid */
      ctx.strokeStyle = 'rgba(6,182,212,0.04)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      /* connection lines from HQ */
      const hq = PINS[PINS.length - 1];
      for (let i = 0; i < PINS.length - 1; i++) {
        const p = PINS[i];
        ctx.beginPath();
        ctx.moveTo(hq.x * W, hq.y * H);
        ctx.lineTo(p.x * W, p.y * H);
        ctx.strokeStyle = 'rgba(6,182,212,0.06)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /* pins */
      let hovered: typeof PINS[0] | null = null;
      const mx = mouse.current.x, my = mouse.current.y;

      for (let i = 0; i < PINS.length; i++) {
        const p = PINS[i];
        const px = p.x * W, py = p.y * H;

        /* pulse ring */
        const pulseScale = 1 + Math.sin(time * 2 + i * 0.8) * 0.3;
        const pulseA = 0.25 - Math.sin(time * 2 + i * 0.8) * 0.1;
        ctx.beginPath();
        ctx.arc(px, py, 8 * pulseScale, 0, Math.PI * 2);
        ctx.strokeStyle = p.c;
        ctx.globalAlpha = pulseA;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;

        /* second ring */
        const p2 = 1 + Math.sin(time * 1.5 + i * 0.8 + 1) * 0.4;
        ctx.beginPath();
        ctx.arc(px, py, 14 * p2, 0, Math.PI * 2);
        ctx.strokeStyle = p.c;
        ctx.globalAlpha = 0.08;
        ctx.stroke();
        ctx.globalAlpha = 1;

        /* core */
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = p.c;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;

        /* label */
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.textAlign = 'center';
        ctx.fillText(p.label, px, py - 14);

        /* hover check */
        if (mx >= 0) {
          const dx = mx - px, dy = my - py;
          if (Math.sqrt(dx * dx + dy * dy) < 22) hovered = p;
        }
      }

      /* hover tooltip */
      if (hovered) {
        const px = hovered.x * W + 18, py = hovered.y * H - 16;
        const tw = 130, th = 38;
        ctx.fillStyle = 'rgba(8,12,20,0.92)';
        ctx.strokeStyle = 'rgba(6,182,212,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(px, py, tw, th, 3);
        ctx.fill();
        ctx.stroke();
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillStyle = hovered.c;
        ctx.textAlign = 'left';
        ctx.fillText(hovered.label, px + 8, py + 15);
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(`${hovered.signals} active signals`, px + 8, py + 28);
      }

      id = requestAnimationFrame(draw);
    }
    id = requestAnimationFrame(draw);

    const onMove = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      mouse.current = { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
    };
    const onLeave = () => { mouse.current = { x: -1, y: -1 }; };
    c.addEventListener('mousemove', onMove, { passive: true });
    c.addEventListener('mouseleave', onLeave);
    return () => { cancelAnimationFrame(id); c.removeEventListener('mousemove', onMove); c.removeEventListener('mouseleave', onLeave); };
  }, []);

  return <canvas ref={ref} className="w-full cursor-crosshair" style={{ height: 'auto', aspectRatio: '600/420' }} />;
}

/* ═══════════════════════════════════════════════════════════════
   DATA — features, stats
   ═══════════════════════════════════════════════════════════════ */
const FEATURES = [
  { icon: '◎', label: 'MAP INTELLIGENCE', title: 'Real-time property tracking across 78 metros', desc: 'Live heatmaps, zone overlays, and scan-ring detection pinpoint market signals before they surface.' },
  { icon: '◈', label: 'KNOWLEDGE GRAPH', title: 'Relational intelligence from every conversation', desc: 'Entities, topics, and relationships extracted automatically into a 3D force-directed knowledge graph.' },
  { icon: '▣', label: 'AI REPORTS', title: 'Multimodal analysis from chat to PDF', desc: 'Schematics, property valuations, and risk assessments generated on demand with vision models.' },
  { icon: '◬', label: 'WORLD BUILDER', title: '3D visualization from a single prompt', desc: 'Generate photorealistic 3D environments, video ads, and immersive walkthroughs with AI pipelines.' },
];

/* ═══════════════════════════════════════════════════════════════
   DOT MATRIX SUB-HEADING — smaller version for section titles
   ═══════════════════════════════════════════════════════════════ */
function DotMatrixSubheading({ text, maxWidth = 600 }: { text: string; maxWidth?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(3);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    document.fonts.ready.then(() => {
      const off = document.createElement('canvas');
      const oc = off.getContext('2d'); if (!oc) return;
      const fontSize = 36;
      oc.font = `600 ${fontSize}px "DM Sans", sans-serif`;
      const w = oc.measureText(text).width;
      off.width = Math.ceil(w) + 30;
      off.height = Math.ceil(fontSize * 1.4) + 20;
      oc.font = `600 ${fontSize}px "DM Sans", sans-serif`;
      oc.fillStyle = 'white';
      oc.textAlign = 'center';
      oc.textBaseline = 'top';
      oc.fillText(text, off.width / 2, 10);

      const data = oc.getImageData(0, 0, off.width, off.height).data;
      const step = 3;
      const cols = Math.ceil(off.width / step);
      const rows = Math.ceil(off.height / step);
      canvas.width = cols * step;
      canvas.height = rows * step;
      setRatio(canvas.width / canvas.height);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const sx = gx * step, sy = gy * step;
          if (sx < off.width && sy < off.height) {
            const a = data[(sy * off.width + sx) * 4 + 3];
            if (a > 60) {
              ctx.beginPath();
              ctx.arc(gx * step + step / 2, gy * step + step / 2, 1, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(210,210,210,${Math.min(a / 255, 1)})`;
              ctx.fill();
            }
          }
        }
      }
    });
  }, [text]);

  return <canvas ref={ref} style={{ maxWidth, height: 'auto', aspectRatio: ratio, display: 'block' }} />;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => { document.body.style.overflow = ''; document.documentElement.style.overflow = ''; };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* ── Frame borders ── */}
      <div className="fixed left-6 top-0 bottom-0 w-px bg-white/[0.06] z-0" />
      <div className="fixed right-6 top-0 bottom-0 w-px bg-white/[0.06] z-0" />

      {/* ── Corner hatching ── */}
      {[
        { pos: 'top-0 left-0', angle: -45, mask: '135deg' },
        { pos: 'top-0 right-0', angle: 45, mask: '-135deg' },
      ].map((h) => (
        <div key={h.pos} className={`absolute ${h.pos} w-[140px] h-[90px] z-10 pointer-events-none`}
          style={{
            background: `repeating-linear-gradient(${h.angle}deg, transparent, transparent 5px, rgba(255,255,255,0.04) 5px, rgba(255,255,255,0.04) 6px)`,
            maskImage: `linear-gradient(${h.mask}, black 25%, transparent 100%)`,
            WebkitMaskImage: `linear-gradient(${h.mask}, black 25%, transparent 100%)`,
          }} />
      ))}

      {/* ════════════════════ NAVIGATION ════════════════════ */}
      <nav className="relative z-20 flex items-center justify-between px-10 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Link href="/landing" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center group-hover:border-white/40 transition-colors">
            <span className="text-[11px] font-bold tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>ES</span>
          </div>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {['Architecture', 'Platform', 'Solutions', 'Developers', 'Docs', 'Company'].map((l) => (
            <a key={l} href="#" className="text-[13px] text-white/45 hover:text-white transition-colors tracking-wide">{l}</a>
          ))}
        </div>
        <Link href="/" className="text-[13px] px-5 py-2 border border-white/20 hover:border-white/50 hover:bg-white/[0.04] transition-all tracking-wide">
          Get Started
        </Link>
      </nav>

      {/* ════════════════════ HERO ════════════════════ */}
      <section className="relative z-10 flex flex-col items-center pt-24 pb-16 px-6 overflow-hidden" style={{ minHeight: '70vh' }}>
        {/* Particle background */}
        <ParticleNetwork />

        {/* Dot-matrix heading */}
        <div className="relative z-10 flex flex-col items-center">
          <DotMatrixHeading lines={['The intelligence layer', 'for real estate']} maxWidth={920} />

          <p className="text-center max-w-[640px] text-white/40 text-[15px] leading-relaxed mt-8 mb-14 tracking-wide">
            Our AI aggregates market signals, removes noise, and delivers only
            what&apos;s actionable at scale and in real time.
          </p>

          <div className="flex items-center gap-5">
            <Link href="/"
              className="text-[13px] px-8 py-3 border border-white/20 hover:border-white/50 hover:bg-white/[0.04] text-white tracking-wide transition-all">
              Get started
            </Link>
            <Link href="#features"
              className="text-[13px] px-8 py-3 text-white tracking-wide transition-all hover:brightness-125"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))', border: '1px solid rgba(255,255,255,0.12)' }}>
              Learn more
            </Link>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

      {/* ════════════════════ DITHERED IMAGE ════════════════════ */}
      <section className="relative z-10 mx-6">
        <DitheredCanvas
          src="https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=350&fit=crop&q=80"
          width={800} height={350}
        />
      </section>

      <div className="mx-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

      {/* ════════════════════ STATS — Animated counters ════════════════════ */}
      <Reveal>
        <section className="relative z-10 mx-6 py-20">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { target: 32, suffix: '', label: 'Live property feeds' },
              { target: 78, suffix: '', label: 'Metros covered' },
              { target: 200, prefix: '<', suffix: 'ms', label: 'Signal latency' },
              { target: 99, suffix: '.97%', label: 'Uptime SLA' },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 0.1}>
                <div className="text-center">
                  <div className="text-3xl md:text-4xl mb-2 text-white/90" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {s.prefix || ''}<Counter target={s.target} />{s.suffix}
                  </div>
                  <div className="text-[11px] text-white/30 tracking-[0.2em] uppercase">{s.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      </Reveal>

      <div className="mx-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

      {/* ════════════════════ INTERACTIVE DEMO ════════════════════ */}
      <Reveal>
        <section className="relative z-10 mx-6 py-24">
          <div className="max-w-6xl mx-auto">
            <p className="text-[11px] tracking-[0.25em] text-white/25 uppercase mb-4">Live Demo</p>
            <div className="mb-12">
              <DotMatrixSubheading text="Intelligence in motion" maxWidth={500} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/[0.04]" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
              {/* Live feed */}
              <div className="bg-black p-8">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] tracking-[0.2em] text-white/30 uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Real-time feed
                  </span>
                </div>
                <LiveFeed />
              </div>

              {/* Mini map */}
              <div className="bg-black p-8">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                  <span className="text-[10px] tracking-[0.2em] text-white/30 uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Signal map — Orange County
                  </span>
                </div>
                <MiniMap />
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <div className="mx-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

      {/* ════════════════════ FEATURES — 3D tilt cards ════════════════════ */}
      <section id="features" className="relative z-10 mx-6 py-24">
        <Reveal>
          <div className="max-w-5xl mx-auto mb-16 text-center">
            <p className="text-[11px] tracking-[0.25em] text-white/25 uppercase mb-4">Capabilities</p>
            <DotMatrixSubheading text="Built for operators" maxWidth={440} />
          </div>
        </Reveal>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.label} delay={i * 0.08}>
              <TiltCard className="p-8 cursor-default" style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
              } as React.CSSProperties}>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-xl text-cyan-400/60">{f.icon}</span>
                  <p className="text-[10px] tracking-[0.3em] text-white/25 uppercase"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}>{f.label}</p>
                </div>
                <h3 className="text-[17px] text-white/80 mb-3 leading-snug">{f.title}</h3>
                <p className="text-[13px] text-white/30 leading-relaxed">{f.desc}</p>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      <div className="mx-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

      {/* ════════════════════ ARCHITECTURE PIPELINE ════════════════════ */}
      <Reveal>
        <section className="relative z-10 mx-6 py-24">
          <div className="max-w-5xl mx-auto">
            <p className="text-[11px] tracking-[0.25em] text-white/25 uppercase mb-4">Architecture</p>
            <div className="mb-14">
              <DotMatrixSubheading text="Signal to decision in milliseconds" maxWidth={620} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-0 items-stretch" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
              {[
                { step: '01', title: 'Ingest', desc: 'Multi-source feeds', icon: '⟩' },
                { step: '02', title: 'Extract', desc: 'Entity recognition', icon: '⟩' },
                { step: '03', title: 'Graph', desc: 'Knowledge linking', icon: '⟩' },
                { step: '04', title: 'Analyze', desc: 'AI scoring', icon: '⟩' },
                { step: '05', title: 'Deliver', desc: 'Real-time push', icon: '✓' },
              ].map((s, i) => (
                <Reveal key={s.step} delay={i * 0.1}>
                  <div className="flex flex-col items-center py-10 relative bg-black hover:bg-white/[0.015] transition-colors"
                    style={{ borderRight: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <span className="text-[10px] text-white/15 tracking-widest mb-3"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.step}</span>
                    <span className="text-sm text-white/70 mb-1.5">{s.title}</span>
                    <span className="text-[11px] text-white/25">{s.desc}</span>
                    {i < 4 && (
                      <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-5 h-5 rounded-full bg-black border border-white/[0.08] items-center justify-center">
                        <span className="text-[8px] text-white/20">{s.icon}</span>
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <div className="mx-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

      {/* ════════════════════ CTA ════════════════════ */}
      <Reveal>
        <section className="relative z-10 mx-6 py-32 text-center">
          <DotMatrixSubheading text="Start operating" maxWidth={380} />
          <p className="text-white/35 text-[15px] mt-6 mb-12 max-w-md mx-auto leading-relaxed">
            Deploy the intelligence layer across your portfolio in minutes.
          </p>
          <Link href="/"
            className="inline-block text-[13px] px-10 py-3.5 border border-white/20 hover:border-white/50 hover:bg-white/[0.04] text-white tracking-wide transition-all">
            Enter EstateOS
          </Link>
        </section>
      </Reveal>

      <div className="mx-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

      {/* ════════════════════ FOOTER ════════════════════ */}
      <footer className="relative z-10 mx-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center">
            <span className="text-[9px] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>ES</span>
          </div>
          <span className="text-[12px] text-white/20 tracking-wide">EstateOS</span>
        </div>
        <div className="flex items-center gap-6">
          {['Privacy', 'Terms', 'Status', 'Documentation'].map((l) => (
            <a key={l} href="#" className="text-[11px] text-white/20 hover:text-white/45 tracking-wide transition-colors">{l}</a>
          ))}
        </div>
        <span className="text-[11px] text-white/12 tracking-wide" style={{ fontFamily: "'JetBrains Mono', monospace" }}>v2.4.1</span>
      </footer>

      {/* ── Bottom hatching ── */}
      {[
        { pos: 'bottom-0 left-0', angle: 45, mask: '-45deg' },
        { pos: 'bottom-0 right-0', angle: -45, mask: '45deg' },
      ].map((h) => (
        <div key={h.pos} className={`absolute ${h.pos} w-[120px] h-[70px] pointer-events-none`}
          style={{
            background: `repeating-linear-gradient(${h.angle}deg, transparent, transparent 5px, rgba(255,255,255,0.04) 5px, rgba(255,255,255,0.04) 6px)`,
            maskImage: `linear-gradient(${h.mask}, black 25%, transparent 100%)`,
            WebkitMaskImage: `linear-gradient(${h.mask}, black 25%, transparent 100%)`,
          }} />
      ))}
    </div>
  );
}
