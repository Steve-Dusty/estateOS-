'use client';

import React, { useRef, useState, useEffect, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import type * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GLTFLoader as GLTFLoaderType } from 'three/examples/jsm/loaders/GLTFLoader.js';
import NavBar from '../components/NavBar';
import ClientSidebar from '../components/ClientSidebar';
import StatusBar from '../components/StatusBar';
import { Property } from '../lib/properties';

/* eslint-disable @typescript-eslint/no-explicit-any */
type OdysseyClient = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

type ClientMode = 'world' | 'odyssey';
type StageStatus = 'pending' | 'running' | 'done' | 'error';

interface StageState {
  panorama: StageStatus;
  world: StageStatus;
}

const PLACEHOLDERS: Record<ClientMode, string> = {
  world: 'A cozy living room with a stone fireplace, bookshelves, and large windows overlooking a garden…',
  odyssey: 'Walking through a serene Japanese garden courtyard with koi ponds and cherry blossoms…',
};

const EXAMPLES: Record<ClientMode, { label: string; prompt: string }[]> = {
  world: [
    { label: 'Modern Living Room', prompt: 'A modern minimalist living room with white walls, hardwood floors, a large sectional sofa, and floor-to-ceiling windows' },
    { label: 'Rustic Kitchen', prompt: 'A rustic kitchen with exposed brick, hanging copper pots, a butcher-block island, and natural light streaming through a skylight' },
    { label: 'Cozy Bedroom', prompt: 'A cozy bedroom with a canopy bed, warm amber lighting, built-in bookshelves, and a window seat overlooking a snowy garden' },
    { label: 'Victorian Study', prompt: 'A Victorian-era study with mahogany furniture, a globe, oil paintings, Persian rugs, and a crackling fireplace' },
  ],
  odyssey: [
    { label: 'Neighborhood Walk', prompt: 'Walking through a quiet suburban neighborhood with tree-lined streets, craftsman-style homes, and warm afternoon light' },
    { label: 'Penthouse Rooftop', prompt: 'Standing on a modern penthouse rooftop terrace overlooking a sprawling city at sunset, with sleek furniture and ambient lighting' },
    { label: 'Historic District', prompt: 'Exploring a charming historic district with cobblestone streets, Victorian row houses, and autumn foliage' },
    { label: 'Future Smart City', prompt: 'Walking through a futuristic smart city with autonomous vehicles, vertical gardens, and holographic signage' },
  ],
};

const STAGE_META: Record<string, { label: string; icon: Record<StageStatus, string> }> = {
  panorama: { label: 'Generating panorama', icon: { pending: '○', running: '●', done: '✓', error: '✗' } },
  world:    { label: 'Building 3D world',   icon: { pending: '○', running: '●', done: '✓', error: '✗' } },
};

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

export default function ClientPage() {
  const [mode, setMode] = useState<ClientMode>('world');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [useImage, setUseImage] = useState(false);

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
  const [generating, setGenerating] = useState(false);
  const [emptyState, setEmptyState] = useState(true);
  const [viewerOverlay, setViewerOverlay] = useState<string | null>(null);

  // World builder state
  const [showProgress, setShowProgress] = useState(false);
  const [stages, setStages] = useState<StageState>({ panorama: 'pending', world: 'pending' });
  const [logs, setLogs] = useState<string[]>([]);
  const [panoramaUrl, setPanoramaUrl] = useState<string | null>(null);
  const [sceneInfo, setSceneInfo] = useState<string | null>(null);

  // Odyssey state
  const odysseyVideoRef = useRef<HTMLVideoElement>(null);
  const odysseyClientRef = useRef<OdysseyClient | null>(null);
  const [odysseyStatus, setOdysseyStatus] = useState<'idle' | 'connecting' | 'connected' | 'streaming' | 'error'>('idle');
  const [odysseyInteraction, setOdysseyInteraction] = useState('');

  // Config panel resize state
  const [configH, setConfigH] = useState(80);
  const configDragging = useRef(false);
  const configStartY = useRef(0);
  const configStartH = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!configDragging.current) return;
      const delta = e.clientY - configStartY.current;
      setConfigH(Math.max(60, Math.min(300, configStartH.current + delta)));
    };
    const onUp = () => { configDragging.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const onConfigDragStart = useCallback((e: ReactMouseEvent) => {
    configDragging.current = true;
    configStartY.current = e.clientY;
    configStartH.current = configH;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [configH]);

  // ── Auto-populate prompt when a property is selected ────────────────
  useEffect(() => {
    if (!selectedProperty) return;
    if (generating) return;
    const p = selectedProperty;
    if (mode === 'world') {
      setPrompt(`A stunning interior of a ${p.beds}-bedroom ${p.type.toLowerCase()} at ${p.address} in ${p.city} — modern finishes, open layout, ${p.sqft.toLocaleString()} sq ft of living space with natural light and premium materials`);
    } else {
      setPrompt(`Walking through ${p.address} in ${p.city} — a beautiful ${p.beds}-bedroom ${p.type.toLowerCase()}, ${p.sqft.toLocaleString()} sq ft, exploring the neighborhood and curb appeal on a sunny afternoon`);
    }
  }, [selectedProperty, mode]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logs]);

  const handleModeChange = useCallback((m: ClientMode) => {
    if (generating) return;
    if (mode === 'odyssey' && odysseyClientRef.current) {
      odysseyClientRef.current.endStream();
      odysseyClientRef.current.disconnect();
      odysseyClientRef.current = null;
      setOdysseyStatus('idle');
      if (odysseyVideoRef.current) odysseyVideoRef.current.srcObject = null;
    }
    setMode(m);
    setPrompt('');
    setGenerating(false);
    setEmptyState(true);
    setViewerOverlay(null);
    setShowProgress(false);
    setLogs([]);
    setStages({ panorama: 'pending', world: 'pending' });
    setPanoramaUrl(null);
    setSceneInfo(null);
  }, [generating, mode]);

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
            if (ev.stage === 'panorama' && ev.panorama_url) setPanoramaUrl(ev.panorama_url as string);
          }
          if (ev.type === 'error') {
            setLogs(p => [...p, 'ERROR: ' + ev.message]);
            setStages({ panorama: 'error', world: 'error' });
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

  const startWorldGen = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setGenerating(true);
    setShowProgress(true);
    setLogs([]);
    setStages({ panorama: 'pending', world: 'pending' });
    setPanoramaUrl(null);
    setSceneInfo(null);
    setEmptyState(false);
    setViewerOverlay('Waiting for pipeline…');
    try {
      const payload: Record<string, string> = { prompt: trimmed };
      if (useImage && selectedProperty?.image) {
        payload.imageBase64 = await urlToBase64(selectedProperty.image);
      }
      const r = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      const res = await r.json();
      connectSSE(res.job_id as string);
    } catch {
      setGenerating(false); setViewerOverlay(null); setEmptyState(true);
    }
  }, [prompt, connectSSE, useImage, selectedProperty]);

  const odysseyConnect = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setGenerating(true);
    setEmptyState(false);
    setOdysseyStatus('connecting');
    setViewerOverlay('Connecting to Odyssey…');

    try {
      // Optionally fetch property image as Blob for Odyssey SDK
      let imageBlob: Blob | undefined;
      if (useImage && selectedProperty?.image) {
        try {
          const imgRes = await fetch(selectedProperty.image);
          imageBlob = await imgRes.blob();
        } catch { /* fall back to prompt-only */ }
      }

      const { Odyssey } = await import('@odysseyml/odyssey');
      const client = new Odyssey({ apiKey: process.env.NEXT_PUBLIC_ODYSSEY_API_KEY || '' });
      odysseyClientRef.current = client;

      const streamOpts: { prompt: string; portrait: boolean; image?: Blob } = { prompt: trimmed, portrait: false };
      if (imageBlob) streamOpts.image = imageBlob;

      await client.connect({
        onConnected: (mediaStream: MediaStream) => {
          if (odysseyVideoRef.current) {
            odysseyVideoRef.current.srcObject = mediaStream;
            odysseyVideoRef.current.play();
          }
          setOdysseyStatus('connected');
          setViewerOverlay(null);
          client.startStream(streamOpts).then(() => {
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
  }, [prompt, useImage, selectedProperty]);

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
    else odysseyConnect();
  }, [mode, startWorldGen, odysseyConnect]);

  const stageColor = (s: StageStatus) =>
    s === 'done' ? 'var(--green)' : s === 'running' ? 'var(--accent)' : s === 'error' ? 'var(--red)' : 'var(--text-tertiary)';

  const odysseyLive = mode === 'odyssey' && (odysseyStatus === 'connected' || odysseyStatus === 'streaming');
  const btnLabel = mode === 'world' ? 'Generate' : odysseyLive ? 'End Tour' : 'Start Tour';
  const btnLabelActive = mode === 'world' ? 'Generating…' : 'Connecting…';

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-body)' }}>
      <NavBar variant="client" />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Property Listings */}
        <ClientSidebar
          selectedId={selectedProperty?.id ?? null}
          onSelect={setSelectedProperty}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Top Controls Panel — compact, resizable via bottom drag handle */}
          <div className="relative shrink-0 overflow-hidden" style={{ height: configH }}>
            <div className="h-full overflow-y-auto px-4 py-2 flex flex-col gap-2"
              style={{ background: 'var(--bg-elevated)' }}>

              {/* Row 1: Mode buttons + Prompt + Generate — all in one row */}
              <div className="flex items-center gap-2">
                {/* Mode toggle */}
                <div className="flex gap-1 shrink-0">
                  {([['world', '3D', 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'], ['odyssey', 'Tour', 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z']] as const).map(([m, label, path]) => (
                    <button key={m} onClick={() => handleModeChange(m as ClientMode)} disabled={generating}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-semibold transition-all cursor-pointer"
                      style={{
                        background: mode === m ? 'var(--accent)' : 'var(--bg-muted)',
                        color: mode === m ? 'white' : 'var(--text-secondary)',
                        border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`,
                        opacity: generating && mode !== m ? 0.5 : 1,
                      }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={path}/></svg>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Prompt input (single line) */}
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { if (!odysseyLive) handleGenerate(); } }}
                  placeholder={PLACEHOLDERS[mode]}
                  className="flex-1 text-[12px] rounded-sm px-3 py-1.5 transition-colors focus:outline-none"
                  style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />

                {/* Generate / End button */}
                <button
                  onClick={odysseyLive ? odysseyEnd : handleGenerate}
                  disabled={!odysseyLive && (generating || !prompt.trim())}
                  className="px-4 py-1.5 text-[11px] font-semibold transition-all rounded-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
                  style={{
                    background: odysseyLive ? 'var(--red)' : (generating || !prompt.trim() ? 'var(--bg-muted)' : 'var(--accent)'),
                    color: odysseyLive ? 'white' : (generating || !prompt.trim() ? 'var(--text-tertiary)' : 'white'),
                    opacity: (!odysseyLive && generating) ? 0.6 : 1,
                    cursor: (!odysseyLive && generating) ? 'not-allowed' : 'pointer',
                  }}>
                  {generating && (
                    <div className="w-3 h-3 rounded-full" style={{ border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white', animation: 'spin .8s linear infinite' }} />
                  )}
                  {generating ? btnLabelActive : btnLabel}
                </button>
              </div>

              {/* Row 2: Examples + image toggle + progress — compact row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] text-text-tertiary">Try:</span>
                {EXAMPLES[mode].map((ex) => (
                  <button key={ex.label} onClick={() => setPrompt(ex.prompt)}
                    className="px-2 py-0.5 text-[9px] rounded-sm transition-all cursor-pointer"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
                    {ex.label}
                  </button>
                ))}

                {selectedProperty && (
                  <>
                    <div className="w-px h-3" style={{ background: 'var(--border)' }} />
                    <button
                      onClick={() => setUseImage(!useImage)}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[9px] font-medium transition-all cursor-pointer"
                      style={{
                        background: useImage ? 'rgba(6,182,212,0.15)' : 'transparent',
                        border: `1px solid ${useImage ? 'rgba(6,182,212,0.4)' : 'var(--border)'}`,
                        color: useImage ? 'var(--accent)' : 'var(--text-tertiary)',
                      }}>
                      <div className="w-2.5 h-2.5 rounded-sm flex items-center justify-center" style={{
                        background: useImage ? 'var(--accent)' : 'transparent',
                        border: `1.5px solid ${useImage ? 'var(--accent)' : 'var(--text-tertiary)'}`,
                      }}>
                        {useImage && <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      Use image
                    </button>
                  </>
                )}

                {/* Inline pipeline progress (world mode) */}
                {mode === 'world' && showProgress && (
                  <>
                    <div className="w-px h-3" style={{ background: 'var(--border)' }} />
                    {(['panorama', 'world'] as const).map((key) => (
                      <div key={key} className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold"
                          style={{
                            background: stages[key] === 'running' ? 'var(--accent)' : stages[key] === 'done' ? 'var(--green)' : stages[key] === 'error' ? 'var(--red)' : 'var(--bg-muted)',
                            color: stages[key] === 'pending' ? 'var(--text-tertiary)' : 'white',
                            animation: stages[key] === 'running' ? 'soft-pulse 2.5s ease-in-out infinite' : 'none',
                          }}>
                          {STAGE_META[key].icon[stages[key]]}
                        </div>
                        <span className="text-[9px]" style={{ color: stageColor(stages[key]) }}>{STAGE_META[key].label}</span>
                      </div>
                    ))}
                    {logs.length > 0 && (
                      <div ref={logBoxRef}
                        className="font-mono text-[9px] leading-tight max-h-[24px] overflow-y-auto rounded-sm px-1.5 py-0.5 flex-1"
                        style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>
                        {logs.map((l, i) => <div key={i}>{l}</div>)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Drag handle to resize config panel ── */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[5px] cursor-row-resize z-20 hover:bg-accent/30 active:bg-accent/50 transition-colors"
              style={{ borderBottom: '1px solid var(--border)' }}
              onMouseDown={onConfigDragStart}
            />
          </div>

          {/* 3D Viewer / Odyssey Stream Area */}
          <div className="flex-1 relative overflow-hidden" ref={wrapRef}
            style={{ background: 'radial-gradient(ellipse at 50% 60%, #0f1729 0%, var(--bg-body) 70%)' }}>

            <div className="absolute inset-0 pointer-events-none graph-grid" />

            {/* 3D Canvas (World Builder) */}
            <canvas ref={canvasRef}
              className="w-full h-full block relative z-[1]"
              style={{ display: mode === 'world' ? 'block' : 'none' }}
            />

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
                    placeholder="Interact with the tour… (e.g. turn left, look at the sky)"
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
                  background: odysseyStatus === 'streaming' ? '#22c55e' : odysseyStatus === 'error' ? 'var(--red)' : 'var(--accent)',
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
                  ) : (
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                      <path d="M2 12h20"/>
                    </svg>
                  )}
                </div>
                <p className="text-[12px] text-text-tertiary text-center leading-relaxed">
                  Enter a prompt and press <span className="font-semibold text-text-secondary">{btnLabel}</span><br />
                  {mode === 'world' ? 'to create an interactive 3D room environment.' : 'to start a live interactive virtual property tour.'}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>Ctrl</kbd>
                  <span className="text-[9px] text-text-tertiary">+</span>
                  <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>Enter</kbd>
                  <span className="text-[9px] text-text-tertiary ml-1">to generate</span>
                </div>
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

            {/* Panorama preview (world mode) */}
            {mode === 'world' && panoramaUrl && (
              <div className="absolute top-3 right-3 z-[4] glass rounded-sm overflow-hidden" style={{ width: 160, border: '1px solid var(--border)' }}>
                <div className="px-2 py-1 text-[9px] text-text-tertiary uppercase tracking-wider">Panorama</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={panoramaUrl} alt="Generated panorama" className="w-full h-auto block" />
              </div>
            )}

            {/* Viewer controls hint (world mode) */}
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
      </div>

      <StatusBar />
    </div>
  );
}
