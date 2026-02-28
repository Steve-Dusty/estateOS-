'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import type * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GLTFLoader as GLTFLoaderType } from 'three/examples/jsm/loaders/GLTFLoader.js';
import NavBar from '../components/NavBar';
import StatusBar from '../components/StatusBar';
import { PROPERTIES, formatPrice } from '../lib/properties';

/* eslint-disable @typescript-eslint/no-explicit-any */
type OdysseyClient = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ── Types ──────────────────────────────────────────────────────────── */

type Mode = 'world' | 'advert' | 'odyssey';
type StageStatus = 'pending' | 'running' | 'done' | 'error';

interface StageState {
  upload: StageStatus;
  world: StageStatus;
}

/* ── Mode config ────────────────────────────────────────────────────── */

const MODES: { key: Mode; label: string; badge: string; icon: React.ReactNode }[] = [
  {
    key: 'world',
    label: 'World Builder',
    badge: 'Hunyuan',
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    key: 'advert',
    label: 'Ad Generator',
    badge: 'Google Veo',
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    ),
  },
  {
    key: 'odyssey',
    label: 'Odyssey',
    badge: 'Odyssey.ml',
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
        <path d="M2 12h20"/>
      </svg>
    ),
  },
];

const AD_EXAMPLES: { label: string; prompt: string }[] = [
  { label: 'Luxury Condo Tour',       prompt: 'Cinematic aerial flythrough of a luxury high-rise condo with panoramic ocean views, modern interiors, and golden hour lighting' },
  { label: 'Suburban Family Home',     prompt: 'Warm walkthrough of a suburban family home with a manicured lawn, open-concept kitchen, and kids playing in the backyard' },
  { label: 'Downtown Loft',           prompt: 'Stylish real estate ad for an industrial downtown loft with exposed brick, large windows, and city skyline views at night' },
  { label: 'Beachfront Villa',        prompt: 'Drone shot of a beachfront villa with infinity pool, tropical gardens, and turquoise ocean, cinematic color grading' },
];

const STAGE_META: Record<string, { label: string; icon: Record<StageStatus, string> }> = {
  upload:   { label: 'Uploading image',   icon: { pending: '○', running: '●', done: '✓', error: '✗' } },
  world:    { label: 'Building 3D world', icon: { pending: '○', running: '●', done: '✓', error: '✗' } },
};

/* ── Helper: URL → base64 data URL ── */
async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ── Component ──────────────────────────────────────────────────────── */

export default function WorldBuilderPage() {
  // Mode
  const [mode, setMode] = useState<Mode>('world');

  // Three.js refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const logBoxRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControlsType | null>(null);
  const loadedGroupRef = useRef<THREE.Object3D | null>(null);
  const gltfLoaderRef = useRef<GLTFLoaderType | null>(null);
  const animFrameRef = useRef<number>(0);

  // Shared UI state
  const [prompt, setPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [emptyState, setEmptyState] = useState(true);
  const [viewerOverlay, setViewerOverlay] = useState<string | null>(null);

  // World builder state
  const [showProgress, setShowProgress] = useState(false);
  const [stages, setStages] = useState<StageState>({ upload: 'pending', world: 'pending' } as StageState);
  const [logs, setLogs] = useState<string[]>([]);
  const [panoramaUrl, setPanoramaUrl] = useState<string | null>(null);
  const [sceneInfo, setSceneInfo] = useState<string | null>(null);
  const [fp8, setFp8] = useState(false);
  const [deepCache, setDeepCache] = useState(false);

  // Video state (advert)
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // (Veo sends default options server-side)

  // Odyssey interactive stream state
  const odysseyVideoRef = useRef<HTMLVideoElement>(null);
  const odysseyClientRef = useRef<OdysseyClient | null>(null);
  const [odysseyStatus, setOdysseyStatus] = useState<'idle' | 'connecting' | 'connected' | 'streaming' | 'error'>('idle');
  const [odysseyInteraction, setOdysseyInteraction] = useState('');

  // ── Three.js setup ──────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;

    let animId = 0;
    let ctrl: OrbitControlsType | null = null;
    let renderer: THREE.WebGLRenderer | null = null;

    (async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.shadowMap.enabled = true;
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 1000);
      camera.position.set(0, 1.6, 5);
      cameraRef.current = camera;

      const pmremGen = new THREE.PMREMGenerator(renderer);
      pmremGen.compileEquirectangularShader();
      const envTex = pmremGen.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      scene.background = new THREE.Color(0x080c14);

      scene.add(new THREE.AmbientLight(0xffffff, 0.3));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
      dirLight.position.set(5, 10, 5);
      dirLight.castShadow = true;
      scene.add(dirLight);

      ctrl = new OrbitControls(camera, renderer.domElement);
      ctrl.enableDamping = true;
      ctrl.dampingFactor = 0.07;
      ctrl.minDistance = 0.5;
      ctrl.maxDistance = 50;
      ctrl.target.set(0, 1, 0);
      controlsRef.current = ctrl;

      const draco = new DRACOLoader();
      draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/libs/draco/');
      const gltf = new GLTFLoader();
      gltf.setDRACOLoader(draco);
      gltfLoaderRef.current = gltf;

      function resize() {
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;
        renderer!.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      const ro = new ResizeObserver(resize);
      ro.observe(wrap);
      resize();

      function animate() {
        animId = requestAnimationFrame(animate);
        ctrl!.update();
        renderer!.render(scene, camera);
      }
      animate();
      animFrameRef.current = animId;
    })();

    return () => {
      cancelAnimationFrame(animFrameRef.current || animId);
      ctrl?.dispose();
      renderer?.dispose();
    };
  }, []);

  // Auto-scroll log box
  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logs]);

  // Reset state on mode change
  const handleModeChange = useCallback((m: Mode) => {
    if (generating) return;
    // Disconnect Odyssey if leaving that mode
    if (mode === 'odyssey' && odysseyClientRef.current) {
      odysseyClientRef.current.endStream();
      odysseyClientRef.current.disconnect();
      odysseyClientRef.current = null;
      setOdysseyStatus('idle');
      if (odysseyVideoRef.current) odysseyVideoRef.current.srcObject = null;
    }
    setMode(m);
    setPrompt('');
    setSelectedImage(null);
    setGenerating(false);
    setEmptyState(true);
    setViewerOverlay(null);
    setShowProgress(false);
    setLogs([]);
    setStages({ upload: 'pending', world: 'pending' } as StageState);
    setPanoramaUrl(null);
    setSceneInfo(null);
    setVideoUrl(null);
  }, [generating, mode]);

  // ── Helpers ─────────────────────────────────────────────────────────

  const clearScene = useCallback(() => {
    if (!sceneRef.current || !loadedGroupRef.current) return;
    sceneRef.current.remove(loadedGroupRef.current);
    loadedGroupRef.current.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m: THREE.Material) => m.dispose());
      }
    });
    loadedGroupRef.current = null;
  }, []);

  const loadGLB = useCallback((url: string) => {
    if (!gltfLoaderRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) return;
    clearScene();
    setViewerOverlay('Loading 3D world…');

    gltfLoaderRef.current.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        const camera = cameraRef.current!;
        const controls = controlsRef.current!;
        const scene = sceneRef.current!;

        model.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
        });

        scene.add(model);
        loadedGroupRef.current = model;

        import('three').then((T) => {
          const box = new T.Box3().setFromObject(model);
          const center = box.getCenter(new T.Vector3());
          const size = box.getSize(new T.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = camera.fov * (Math.PI / 180);
          let dist = Math.abs(maxDim / 2 / Math.tan(fov / 2));
          dist *= 1.6;
          camera.position.set(center.x, center.y + size.y * 0.2, center.z + dist);
          controls.target.copy(center);
          controls.update();
        });

        setViewerOverlay(null);
        setEmptyState(false);
      },
      (xhr) => {
        if (xhr.total) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          setViewerOverlay(`Loading 3D world… ${pct}%`);
        }
      },
      () => { setViewerOverlay(null); },
    );
  }, [clearScene]);

  // ── SSE (World Builder) ─────────────────────────────────────────────

  const connectSSE = useCallback((jobId: string) => {
    fetch(`/api/generate/${jobId}/stream`).then(async (res) => {
      if (!res.ok || !res.body) return;
      const rdr = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await rdr.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let ev: Record<string, unknown>;
          try { ev = JSON.parse(raw); } catch { continue; }

          if (ev.type === 'log') setLogs(p => [...p, `[${ev.stage}] ${ev.message}`]);
          if (ev.type === 'info') setLogs(p => [...p, ev.message as string]);
          if (ev.type === 'stage') setStages(p => ({ ...p, [ev.stage as string]: 'running' as StageStatus }));
          if (ev.type === 'stage_done') {
            setStages(p => ({ ...p, [ev.stage as string]: 'done' as StageStatus }));
            if (ev.stage === 'upload' && ev.panorama_url) setPanoramaUrl(ev.panorama_url as string);
          }
          if (ev.type === 'error') {
            setLogs(p => [...p, 'ERROR: ' + ev.message]);
            setStages({ upload: 'error', world: 'error' });
            setGenerating(false);
            setViewerOverlay(null);
            setEmptyState(true);
          }
          if (ev.type === 'done') {
            setStages(p => ({ ...p, world: 'done' as StageStatus }));
            setSceneInfo(`Scene: ${ev.scene_class} · Job: ${ev.job_id}`);
            if (ev.model_url) loadGLB(ev.model_url as string);
            else setViewerOverlay(null);
            setGenerating(false);
          }
        }
      }
    });
  }, [loadGLB]);

  // ── Generation handlers ─────────────────────────────────────────────

  const startWorldGen = useCallback(async () => {
    if (!selectedImage) return;
    setGenerating(true);
    setShowProgress(true);
    setLogs([]);
    setStages({ upload: 'pending', world: 'pending' } as StageState);
    setPanoramaUrl(null);
    setSceneInfo(null);
    setEmptyState(false);
    setViewerOverlay('Preparing image…');
    try {
      const imageBase64 = await urlToBase64(selectedImage);
      setViewerOverlay('Waiting for pipeline…');
      const r = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64 }) });
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      const res = await r.json();
      connectSSE(res.job_id as string);
    } catch {
      setGenerating(false); setViewerOverlay(null); setEmptyState(true);
    }
  }, [selectedImage, connectSSE]);

  const startVeoGen = useCallback(async () => {
    if (!selectedImage) return;
    setGenerating(true);
    setEmptyState(false);
    setVideoUrl(null);
    setViewerOverlay('Preparing image…');
    try {
      const imageBase64 = await urlToBase64(selectedImage);
      setViewerOverlay('Generating advertisement video… This may take 1–3 minutes.');
      const r = await fetch('/api/veo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() || undefined, imageBase64 }),
      });
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      const res = await r.json();
      setVideoUrl(res.videoUrl);
      setViewerOverlay(null);
    } catch (e) {
      setViewerOverlay(null);
      setEmptyState(true);
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }, [selectedImage, prompt]);

  // ── Odyssey interactive stream ──────────────────────────────────────

  const odysseyConnect = useCallback(async () => {
    if (!selectedImage) return;

    setGenerating(true);
    setEmptyState(false);
    setOdysseyStatus('connecting');
    setViewerOverlay('Preparing image…');

    try {
      // Convert image URL to a Blob/File for the Odyssey SDK
      const imgRes = await fetch(selectedImage);
      const imgBlob = await imgRes.blob();
      const imgFile = new File([imgBlob], 'property.jpg', { type: imgBlob.type });

      setViewerOverlay('Connecting to Odyssey…');

      const { Odyssey } = await import('@odysseyml/odyssey');
      const client = new Odyssey({ apiKey: process.env.NEXT_PUBLIC_ODYSSEY_API_KEY || '' });
      odysseyClientRef.current = client;

      await client.connect({
        onConnected: (mediaStream: MediaStream) => {
          if (odysseyVideoRef.current) {
            odysseyVideoRef.current.srcObject = mediaStream;
            odysseyVideoRef.current.play();
          }
          setOdysseyStatus('connected');
          setViewerOverlay(null);

          // Start stream with the property image
          client.startStream({ prompt: 'Explore this property', portrait: false, image: imgFile }).then(() => {
            setOdysseyStatus('streaming');
            setGenerating(false);
          });
        },
        onStreamStarted: () => {
          setOdysseyStatus('streaming');
          setGenerating(false);
        },
        onStreamEnded: () => {
          setOdysseyStatus('connected');
        },
        onDisconnected: () => {
          setOdysseyStatus('idle');
          setEmptyState(true);
          if (odysseyVideoRef.current) odysseyVideoRef.current.srcObject = null;
        },
        onError: (error: Error, fatal: boolean) => {
          console.error('Odyssey error:', error.message);
          if (fatal) {
            setOdysseyStatus('error');
            setViewerOverlay(null);
            setEmptyState(true);
            setGenerating(false);
          }
        },
      });
    } catch (e) {
      console.error(e);
      setOdysseyStatus('error');
      setViewerOverlay(null);
      setEmptyState(true);
      setGenerating(false);
    }
  }, [selectedImage]);

  const odysseyInteract = useCallback(async () => {
    const text = odysseyInteraction.trim();
    if (!text || !odysseyClientRef.current) return;
    setOdysseyInteraction('');
    await odysseyClientRef.current.interact({ prompt: text });
  }, [odysseyInteraction]);

  const odysseyEnd = useCallback(() => {
    if (odysseyClientRef.current) {
      odysseyClientRef.current.endStream();
      odysseyClientRef.current.disconnect();
      odysseyClientRef.current = null;
    }
    setOdysseyStatus('idle');
    setEmptyState(true);
    if (odysseyVideoRef.current) odysseyVideoRef.current.srcObject = null;
  }, []);

  const handleGenerate = useCallback(() => {
    if (mode === 'world') startWorldGen();
    else if (mode === 'advert') startVeoGen();
    else odysseyConnect();
  }, [mode, startWorldGen, startVeoGen, odysseyConnect]);

  // ── Helpers ─────────────────────────────────────────────────────────

  const stageColor = (s: StageStatus) =>
    s === 'done' ? 'var(--green)' : s === 'running' ? 'var(--accent)' : s === 'error' ? 'var(--red)' : 'var(--text-tertiary)';

  const currentMode = MODES.find(m => m.key === mode)!;
  const odysseyLive = mode === 'odyssey' && (odysseyStatus === 'connected' || odysseyStatus === 'streaming');
  const btnLabel = mode === 'world' ? 'Generate World' : mode === 'advert' ? 'Generate Ad' : odysseyLive ? 'End Stream' : 'Start Stream';
  const btnLabelActive = mode === 'world' ? 'Generating…' : mode === 'advert' ? 'Generating…' : 'Connecting…';
  const canGenerate = !!selectedImage;

  // Should we show the 3D canvas or a video player?
  const showVideo = mode === 'advert' && videoUrl;

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-body)' }}>
      <NavBar />

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left Sidebar ──────────────────────────────────────── */}
        <div className="w-[260px] min-w-[260px] flex flex-col border-r overflow-hidden relative z-10"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>

          {/* Mode toggle */}
          <div className="px-3 pt-3 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex rounded-sm overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-body)' }}>
              {MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => handleModeChange(m.key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold transition-all cursor-pointer"
                  style={{
                    background: mode === m.key ? 'var(--accent)' : 'transparent',
                    color: mode === m.key ? 'white' : 'var(--text-tertiary)',
                  }}>
                  {m.icon}
                  <span className="truncate">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Header */}
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center rounded-sm" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                {currentMode.icon}
              </div>
              <span className="text-[11px] font-semibold text-text-tertiary tracking-widest uppercase">{currentMode.label}</span>
            </div>
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              {currentMode.badge}
            </span>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">

            {/* Property image selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-text-tertiary tracking-wider uppercase">
                Select Property Image
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {PROPERTIES.slice(0, 12).map((prop) => (
                  <button
                    key={prop.id}
                    onClick={() => setSelectedImage(selectedImage === prop.image ? null : prop.image)}
                    className="relative rounded-sm overflow-hidden cursor-pointer transition-all group"
                    style={{
                      border: selectedImage === prop.image ? '2px solid var(--accent)' : '1px solid var(--border)',
                      boxShadow: selectedImage === prop.image ? '0 0 12px rgba(6,182,212,0.25)' : 'none',
                    }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={prop.image}
                      alt={prop.address}
                      className="w-full h-[60px] object-cover transition-all"
                      style={{ opacity: selectedImage && selectedImage !== prop.image ? 0.4 : 1 }}
                    />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
                    <div className="absolute bottom-0.5 left-1 right-1">
                      <p className="text-[8px] font-semibold text-white truncate leading-tight">{prop.address}</p>
                      <p className="text-[7px] text-white/60 font-mono">{formatPrice(prop.price)}</p>
                    </div>
                    {selectedImage === prop.image && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--accent)' }}>
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Ad Generator: text prompt (optional) */}
            {mode === 'advert' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-text-tertiary tracking-wider uppercase">
                  Direction <span className="opacity-50">(optional)</span>
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate(); }}
                  placeholder="Cinematic drone shot, golden hour lighting, slow pan across the front…"
                  className="w-full min-h-[70px] text-[12px] leading-relaxed resize-vertical rounded-sm px-3 py-2.5 transition-colors focus:outline-none"
                  style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            )}

            {/* Mode-specific options */}
            {mode === 'world' && (
              <div className="flex gap-2">
                {[{ val: fp8, set: () => setFp8(!fp8), label: 'FP8 Quantization' }, { val: deepCache, set: () => setDeepCache(!deepCache), label: 'DeepCache' }].map(opt => (
                  <button key={opt.label} onClick={opt.set}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded-sm transition-all cursor-pointer"
                    style={{
                      background: opt.val ? 'var(--accent-dim)' : 'transparent',
                      border: `1px solid ${opt.val ? 'var(--accent)' : 'var(--border)'}`,
                      color: opt.val ? 'var(--accent)' : 'var(--text-tertiary)',
                    }}>
                    <div className="w-[6px] h-[6px] rounded-full" style={{ background: opt.val ? 'var(--accent)' : 'var(--text-tertiary)', opacity: opt.val ? 1 : 0.4 }} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {mode === 'odyssey' && (
              <div className="rounded-sm px-3 py-2" style={{ background: 'var(--bg-body)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] text-text-tertiary leading-relaxed">
                  Odyssey opens a <span className="text-text-secondary font-medium">live interactive stream</span> from the selected property image. Explore and direct in real-time.
                </p>
              </div>
            )}

            {/* Generate / End Stream button */}
            <button
              onClick={odysseyLive ? odysseyEnd : handleGenerate}
              disabled={!odysseyLive && (generating || !canGenerate)}
              className="w-full py-2.5 text-[12px] font-semibold cursor-pointer transition-all rounded-sm flex items-center justify-center gap-2"
              style={{
                background: odysseyLive ? 'var(--red, #ef4444)' : (generating || !canGenerate ? 'var(--bg-muted)' : 'var(--accent)'),
                color: odysseyLive ? 'white' : (generating || !canGenerate ? 'var(--text-tertiary)' : 'white'),
                opacity: generating ? 0.6 : 1,
                cursor: (!odysseyLive && generating) ? 'not-allowed' : 'pointer',
              }}>
              {generating && (
                <div className="w-3 h-3 rounded-full" style={{ border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white', animation: 'spin .8s linear infinite' }} />
              )}
              {generating ? btnLabelActive : btnLabel}
            </button>

            {/* World builder progress */}
            {mode === 'world' && showProgress && (
              <div className="space-y-2 fade-in">
                <div className="text-[10px] font-medium text-text-tertiary tracking-wider uppercase">Pipeline</div>
                {(['upload', 'world'] as const).map((key) => (
                  <div key={key} className="flex items-center gap-2.5 py-1">
                    <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                      style={{
                        background: stages[key as keyof StageState] === 'running' ? 'var(--accent)' : stages[key as keyof StageState] === 'done' ? 'var(--green)' : stages[key as keyof StageState] === 'error' ? 'var(--red)' : 'var(--bg-muted)',
                        color: stages[key as keyof StageState] === 'pending' ? 'var(--text-tertiary)' : 'white',
                        boxShadow: stages[key as keyof StageState] === 'running' ? '0 0 8px rgba(6,182,212,0.4)' : 'none',
                        animation: stages[key as keyof StageState] === 'running' ? 'soft-pulse 2.5s ease-in-out infinite' : 'none',
                      }}>
                      {STAGE_META[key].icon[stages[key as keyof StageState]]}
                    </div>
                    <span className="text-[11px]" style={{ color: stageColor(stages[key as keyof StageState]) }}>{STAGE_META[key].label}</span>
                  </div>
                ))}
                {logs.length > 0 && (
                  <div ref={logBoxRef}
                    className="font-mono text-[10px] leading-[1.6] max-h-[100px] overflow-y-auto rounded-sm px-3 py-2"
                    style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>
                    {logs.map((l, i) => <div key={i}>{l}</div>)}
                  </div>
                )}
              </div>
            )}

            {/* Panorama preview */}
            {mode === 'world' && panoramaUrl && (
              <div className="space-y-1.5 fade-in">
                <div className="text-[10px] font-medium text-text-tertiary tracking-wider uppercase">Panorama Preview</div>
                <div className="rounded-sm overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={panoramaUrl} alt="Generated panorama" className="w-full h-auto block" />
                </div>
              </div>
            )}

            {/* Divider + ad example prompts */}
            {mode === 'advert' && (
              <>
                <div className="h-px" style={{ background: 'var(--border)' }} />
                <div className="space-y-2">
                  <div className="text-[10px] font-medium text-text-tertiary tracking-wider uppercase">Example Directions</div>
                  <div className="space-y-1">
                    {AD_EXAMPLES.map((ex) => (
                      <button key={ex.label} onClick={() => setPrompt(ex.prompt)}
                        className="w-full text-left px-3 py-2 text-[11px] rounded-sm transition-all cursor-pointer"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Main Viewer ──────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden" ref={wrapRef}
          style={{ background: 'radial-gradient(ellipse at 50% 60%, #0f1729 0%, var(--bg-body) 70%)' }}>

          <div className="absolute inset-0 pointer-events-none graph-grid" />

          {/* 3D Canvas (World Builder) */}
          <canvas ref={canvasRef}
            className="w-full h-full block relative z-[1]"
            style={{ display: mode === 'world' ? 'block' : 'none' }}
          />

          {/* Video Player (Ad Generator) */}
          {showVideo && (
            <div className="absolute inset-0 z-[2] flex items-center justify-center">
              <video
                src={videoUrl!}
                controls
                autoPlay
                loop
                className="max-w-full max-h-full rounded-sm"
                style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6)', border: '1px solid var(--border)' }}
              />
            </div>
          )}

          {/* Odyssey Live Stream */}
          {mode === 'odyssey' && (
            <div className="absolute inset-0 z-[2] flex items-center justify-center"
              style={{ display: odysseyStatus === 'idle' && emptyState ? 'none' : 'flex' }}>
              <video
                ref={odysseyVideoRef}
                autoPlay
                playsInline
                muted={false}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Odyssey Interaction Bar */}
          {mode === 'odyssey' && odysseyStatus === 'streaming' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[5] w-[90%] max-w-[600px]">
              <div className="flex gap-2 glass rounded-sm px-3 py-2" style={{ border: '1px solid var(--border)' }}>
                <input
                  type="text"
                  value={odysseyInteraction}
                  onChange={(e) => setOdysseyInteraction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') odysseyInteract(); }}
                  placeholder="Interact with the world… (e.g. turn left, look at the sky)"
                  className="flex-1 bg-transparent text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
                />
                <button
                  onClick={odysseyInteract}
                  disabled={!odysseyInteraction.trim()}
                  className="px-3 py-1 text-[10px] font-semibold rounded-sm transition-all cursor-pointer"
                  style={{
                    background: odysseyInteraction.trim() ? 'var(--accent)' : 'var(--bg-muted)',
                    color: odysseyInteraction.trim() ? 'white' : 'var(--text-tertiary)',
                  }}>
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Odyssey status badge */}
          {mode === 'odyssey' && odysseyStatus !== 'idle' && (
            <div className="absolute top-3 left-3 z-[4] glass rounded-sm px-3 py-1.5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{
                background: odysseyStatus === 'streaming' ? '#22c55e' : odysseyStatus === 'error' ? 'var(--red, #ef4444)' : 'var(--accent)',
                animation: odysseyStatus === 'streaming' ? 'soft-pulse 2s ease-in-out infinite' : odysseyStatus === 'connecting' ? 'spin 1s linear infinite' : 'none',
              }} />
              <span className="font-mono text-[10px] text-text-secondary capitalize">{odysseyStatus}</span>
            </div>
          )}

          {/* Empty state */}
          {emptyState && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-[2] pointer-events-none">
              <div className="relative mb-4" style={{ opacity: 0.15, color: 'var(--accent)' }}>
                {mode === 'world' ? (
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                ) : mode === 'advert' ? (
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                ) : (
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                    <path d="M2 12h20"/>
                  </svg>
                )}
              </div>
              <p className="text-[12px] text-text-tertiary text-center leading-relaxed">
                Select a property image and press <span className="font-semibold text-text-secondary">{btnLabel}</span><br />
                {mode === 'world' ? 'to create an interactive 3D environment.' : mode === 'advert' ? 'to generate a property advertisement video.' : 'to start a live interactive world stream.'}
              </p>
            </div>
          )}

          {/* Loading overlay */}
          {viewerOverlay !== null && (
            <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center"
              style={{ background: 'rgba(8,12,20,0.75)', backdropFilter: 'blur(4px)' }}>
              <div className="w-10 h-10 rounded-full mb-3"
                style={{ border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
              <span className="text-[11px] text-text-secondary">{viewerOverlay}</span>
            </div>
          )}

          {/* Scene info badge (world mode) */}
          {mode === 'world' && sceneInfo && (
            <div className="absolute top-3 left-3 z-[4] glass rounded-sm px-3 py-1.5">
              <span className="font-mono text-[10px] text-text-secondary">{sceneInfo}</span>
            </div>
          )}

          {/* Viewer controls hint (world mode, model loaded) */}
          {mode === 'world' && !emptyState && !viewerOverlay && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[4] glass rounded-full px-4 py-1.5 flex items-center gap-4">
              <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                Drag to orbit
              </span>
              <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                Scroll to zoom
              </span>
              <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3"/></svg>
                Shift+Drag to pan
              </span>
            </div>
          )}
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
