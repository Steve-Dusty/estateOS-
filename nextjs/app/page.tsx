'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ── Types ────────────────────────────────────────────────────────────────────

type StageStatus = 'pending' | 'running' | 'done' | 'error';

interface StageState {
  panorama: StageStatus;
  world: StageStatus;
}

interface ToastState {
  message: string;
  type: 'info' | 'success' | 'error';
  show: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXAMPLES = [
  {
    label: 'Modern living room',
    prompt: 'A modern minimalist living room with white walls, hardwood floors, a large sectional sofa, and floor-to-ceiling windows',
  },
  {
    label: 'Rustic kitchen',
    prompt: 'A rustic kitchen with exposed brick, hanging copper pots, a butcher-block island, and natural light streaming through a skylight',
  },
  {
    label: 'Cozy bedroom',
    prompt: 'A cozy bedroom with a canopy bed, warm amber lighting, built-in bookshelves, and a window seat overlooking a snowy garden',
  },
  {
    label: 'Victorian study',
    prompt: 'A Victorian-era study with mahogany furniture, a globe, oil paintings, Persian rugs, and a crackling fireplace',
  },
  {
    label: 'Sunroom with plants',
    prompt: 'A bright sunroom filled with tropical plants, rattan furniture, and panoramic glass walls',
  },
];

const STAGE_ICONS: Record<StageStatus, string> = {
  pending: '○',
  running: '●',
  done: '✓',
  error: '✗',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function Home() {
  // DOM refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const logBoxRef = useRef<HTMLDivElement>(null);

  // Three.js refs (not state — mutations don't need re-render)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const loadedGroupRef = useRef<THREE.Object3D | null>(null);
  const gltfLoaderRef = useRef<GLTFLoader | null>(null);
  const animFrameRef = useRef<number>(0);

  // Misc refs
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [stages, setStages] = useState<StageState>({ panorama: 'pending', world: 'pending' });
  const [logs, setLogs] = useState<string[]>([]);
  const [panoramaUrl, setPanoramaUrl] = useState<string | null>(null);
  const [sceneInfo, setSceneInfo] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'info', show: false });
  const [emptyState, setEmptyState] = useState(true);
  const [viewerOverlay, setViewerOverlay] = useState<string | null>(null);
  const [viewerHint, setViewerHint] = useState(true);

  // ── Three.js scene setup ────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return;

    const canvas = canvasRef.current;
    const wrap = wrapRef.current;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
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

    // Environment / lighting
    const pmremGen = new THREE.PMREMGenerator(renderer);
    pmremGen.compileEquirectangularShader();
    const envTexture = pmremGen.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.background = new THREE.Color(0x0d0f14);

    const ambLight = new THREE.AmbientLight(0xffffff, 0.3);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    scene.add(ambLight, dirLight);

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 0.5;
    controls.maxDistance = 50;
    controls.target.set(0, 1, 0);
    controlsRef.current = controls;

    // Resize handling
    function resizeRenderer() {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resizeRenderer);
    ro.observe(wrap);
    resizeRenderer();

    // Render loop
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // DRACO + GLTF loaders
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/libs/draco/',
    );
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoaderRef.current = gltfLoader;

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Auto-scroll log box when logs change
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type, show: true });
    toastTimerRef.current = setTimeout(() => {
      setToast((t) => ({ ...t, show: false }));
    }, 4000);
  }, []);

  const clearScene = useCallback(() => {
    if (!sceneRef.current || !loadedGroupRef.current) return;
    sceneRef.current.remove(loadedGroupRef.current);
    loadedGroupRef.current.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          (mesh.material as THREE.Material[]).forEach((m) => m.dispose());
        } else {
          (mesh.material as THREE.Material).dispose();
        }
      }
    });
    loadedGroupRef.current = null;
  }, []);

  // ── Load GLB ─────────────────────────────────────────────────────────────────

  const loadGLB = useCallback(
    (url: string) => {
      if (!gltfLoaderRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current)
        return;

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
            if (mesh.isMesh) {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              if (mesh.material) {
                const mats = Array.isArray(mesh.material)
                  ? (mesh.material as THREE.Material[])
                  : [mesh.material as THREE.Material];
                mats.forEach((m) => {
                  (m as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
                });
              }
            }
          });

          scene.add(model);
          loadedGroupRef.current = model;

          // Fit camera to model bounds
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = camera.fov * (Math.PI / 180);
          let dist = Math.abs(maxDim / 2 / Math.tan(fov / 2));
          dist *= 1.6;
          camera.position.set(center.x, center.y + size.y * 0.2, center.z + dist);
          controls.target.copy(center);
          controls.update();

          setViewerOverlay(null);
          setEmptyState(false);
          setViewerHint(true);
          showToast('3D world ready! Drag to explore.', 'success');
        },
        (xhr) => {
          if (xhr.total) {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            setViewerOverlay(`Loading 3D world… ${pct}%`);
          }
        },
        (err) => {
          setViewerOverlay(null);
          showToast('Viewer error: ' + (err as Error).message, 'error');
        },
      );
    },
    [clearScene, showToast],
  );

  // ── WebSocket ─────────────────────────────────────────────────────────────────

  const connectWS = useCallback(
    (jobId: string) => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/${jobId}`);

      ws.onmessage = ({ data }) => {
        const ev = JSON.parse(data as string);

        if (ev.type === 'log') {
          setLogs((prev) => [...prev, `[${ev.stage}] ${ev.message}`]);
        }
        if (ev.type === 'info') {
          setLogs((prev) => [...prev, ev.message]);
        }
        if (ev.type === 'stage') {
          setStages((prev) => ({ ...prev, [ev.stage]: 'running' as StageStatus }));
        }
        if (ev.type === 'stage_done') {
          setStages((prev) => ({ ...prev, [ev.stage]: 'done' as StageStatus }));
          if (ev.stage === 'panorama' && ev.panorama_url) {
            setPanoramaUrl(ev.panorama_url as string);
          }
        }
        if (ev.type === 'error') {
          setLogs((prev) => [...prev, 'ERROR: ' + (ev.message as string)]);
          setStages({ panorama: 'error', world: 'error' });
          showToast('Generation failed: ' + (ev.message as string), 'error');
          setGenerating(false);
          setViewerOverlay(null);
          setEmptyState(true);
        }
        if (ev.type === 'done') {
          setStages((prev) => ({ ...prev, world: 'done' as StageStatus }));
          setSceneInfo(`Scene: ${ev.scene_class as string} · Job: ${ev.job_id as string}`);
          if (ev.model_url) {
            loadGLB(ev.model_url as string);
          } else {
            setViewerOverlay(null);
            showToast('World generated — panorama preview available.', 'success');
          }
          setGenerating(false);
        }
      };

      ws.onerror = () => showToast('WebSocket connection error', 'error');

      return ws;
    },
    [loadGLB, showToast],
  );

  // ── Start generation ──────────────────────────────────────────────────────────

  const startGeneration = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      showToast('Please enter a prompt first.', 'error');
      return;
    }

    // Reset UI
    setGenerating(true);
    setShowProgress(true);
    setLogs([]);
    setStages({ panorama: 'pending', world: 'pending' });
    setPanoramaUrl(null);
    setSceneInfo(null);
    setEmptyState(false);
    setViewerOverlay('Waiting for pipeline to start…');

    try {
      const r = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error((err.error as string) || r.statusText);
      }
      const res = await r.json();
      connectWS(res.job_id as string);
    } catch (e) {
      showToast('Failed to start job: ' + (e as Error).message, 'error');
      setGenerating(false);
      setViewerOverlay(null);
      setEmptyState(true);
    }
  }, [prompt, connectWS, showToast]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <header>
        <div className="logo">
          Hunyuan<span>World</span>
        </div>
        <div className="badge">1.0</div>
        <div className="subtitle">Text → Interactive 3D House World</div>
      </header>

      <main>
        {/* Left panel */}
        <aside className="panel">
          <h2>Describe your house</h2>

          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) startGeneration();
            }}
            placeholder="e.g. A cozy living room with a stone fireplace, bookshelves, and large windows overlooking a garden…"
          />

          <div className="options">
            <label className="toggle-btn">
              <input type="checkbox" /> FP8 quantization (saves VRAM)
            </label>
            <label className="toggle-btn">
              <input type="checkbox" /> DeepCache (faster)
            </label>
          </div>

          <button id="generateBtn" onClick={startGeneration} disabled={generating}>
            Generate World
          </button>

          {/* Progress */}
          {showProgress && (
            <div id="progressSection">
              <h2>Progress</h2>
              <div className="stage-row">
                <div className={`stage-icon ${stages.panorama}`}>
                  {STAGE_ICONS[stages.panorama]}
                </div>
                <span>Generating panorama…</span>
              </div>
              <div className="stage-row">
                <div className={`stage-icon ${stages.world}`}>
                  {STAGE_ICONS[stages.world]}
                </div>
                <span>Building 3D world…</span>
              </div>
              <div className="log-box" ref={logBoxRef}>
                {logs.join('\n')}
              </div>
            </div>
          )}

          {/* Panorama preview */}
          {panoramaUrl && (
            <div id="panoramaSection">
              <h2>Panorama preview</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={panoramaUrl} alt="Generated panorama" />
            </div>
          )}

          {/* Example prompts */}
          <h2>Examples</h2>
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <div
                key={ex.label}
                className="example-chip"
                onClick={() => setPrompt(ex.prompt)}
              >
                {ex.label}
              </div>
            ))}
          </div>
        </aside>

        {/* 3-D Viewer */}
        <div id="viewerWrap" ref={wrapRef}>
          <canvas id="viewer3d" ref={canvasRef} />

          {emptyState && (
            <div id="emptyState">
              <div className="icon">🏠</div>
              <p>
                Enter a prompt and press <strong>Generate World</strong>
                <br />
                to create your interactive 3D house.
              </p>
            </div>
          )}

          {viewerOverlay !== null && (
            <div id="viewerOverlay">
              <div className="spinner" />
              <p>{viewerOverlay}</p>
            </div>
          )}

          {sceneInfo && (
            <div id="sceneInfo">{sceneInfo}</div>
          )}

          {viewerHint && (
            <div id="viewerHint">
              <span>🖱 Drag to orbit</span>
              <span>⚙ Scroll to zoom</span>
              <span>⇧+Drag to pan</span>
            </div>
          )}
        </div>
      </main>

      {/* Toast notification */}
      <div
        id="toast"
        className={[toast.show ? 'show' : '', toast.type !== 'info' ? toast.type : '']
          .filter(Boolean)
          .join(' ')}
      >
        {toast.message}
      </div>
    </>
  );
}
