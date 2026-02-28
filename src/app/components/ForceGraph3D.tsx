'use client';

import { useRef, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { GraphData, GraphNode } from '@/types/graph';
import * as THREE from 'three';

const ForceGraph3DComponent = dynamic(
  () => import('react-force-graph-3d').then(mod => mod.default || mod),
  { ssr: false }
);

interface Props {
  graphData: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  width: number;
  height: number;
}

export default function ForceGraph3D({ graphData, onNodeClick, width, height }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);

  // Zoom to fit on initial load — use negative padding to pull camera closer
  const hasZoomedRef = useRef(false);
  useEffect(() => {
    hasZoomedRef.current = false;
  }, [graphData.nodes.length]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const fg = fgRef.current;
      if (fg?.zoomToFit) {
        // Negative padding pulls the camera closer; scale by node count
        const padding = graphData.nodes.length <= 5 ? -40 : 20;
        fg.zoomToFit(1000, padding);
        hasZoomedRef.current = true;
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [graphData.nodes.length]);

  const data = useMemo(() => ({
    nodes: graphData.nodes.map(n => ({ ...n })),
    links: graphData.links.map(l => ({
      ...l,
      source: typeof l.source === 'object' ? (l.source as unknown as { id: string }).id : l.source,
      target: typeof l.target === 'object' ? (l.target as unknown as { id: string }).id : l.target,
    })),
  }), [graphData]);

  // Cache glow textures to avoid recreating canvases every render
  const glowTextureCache = useRef<Map<string, THREE.Texture>>(new Map());

  const getGlowTexture = useCallback((hex: string) => {
    if (glowTextureCache.current.has(hex)) return glowTextureCache.current.get(hex)!;
    const s = 256;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    g.addColorStop(0, hex + '80');
    g.addColorStop(0.12, hex + '50');
    g.addColorStop(0.35, hex + '18');
    g.addColorStop(0.7, hex + '06');
    g.addColorStop(1, hex + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    glowTextureCache.current.set(hex, tex);
    return tex;
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createNodeObject = useCallback((node: any) => {
    const group = new THREE.Group();
    const isSteve = node.id === 'person-1';
    const isPerson = node.type === 'person';

    // Tighter sizing — smaller, more elegant proportions
    const baseVal = node.val || 8;
    const coreSize = isSteve ? 4.5 : Math.max(2, Math.min(3.5, baseVal * 0.28));

    // Refined palette
    const baseHex = isSteve ? '#f59e0b' : isPerson ? '#22d3ee' : '#818cf8';
    const brightHex = isSteve ? '#fcd34d' : isPerson ? '#a5f3fc' : '#c7d2fe';

    // Core sphere — compact, high-poly for smoothness
    const coreGeo = new THREE.SphereGeometry(coreSize, 48, 48);
    const coreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(baseHex),
      transparent: true,
      opacity: 0.92,
    });
    group.add(new THREE.Mesh(coreGeo, coreMat));

    // Inner specular highlight — offset sphere for glass-like depth
    const hlGeo = new THREE.SphereGeometry(coreSize * 0.45, 24, 24);
    const hlMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(brightHex),
      transparent: true,
      opacity: 0.35,
    });
    const hl = new THREE.Mesh(hlGeo, hlMat);
    hl.position.set(coreSize * 0.22, coreSize * 0.28, coreSize * 0.22);
    group.add(hl);

    // Soft radial glow — additive-blended billboard sprite
    const glowSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getGlowTexture(baseHex),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    const glowScale = coreSize * 7;
    glowSprite.scale.set(glowScale, glowScale, 1);
    group.add(glowSprite);

    // Label — clean typography with subtle shadow
    const labelCanvas = document.createElement('canvas');
    const ctx = labelCanvas.getContext('2d')!;
    labelCanvas.width = 512;
    labelCanvas.height = 80;

    const fontSize = isPerson ? 26 : 22;
    ctx.font = `${isPerson ? '500' : '400'} ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Drop shadow for contrast
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = isPerson ? 'rgba(226,232,240,0.88)' : 'rgba(165,180,252,0.72)';
    const name = (node.name || '').length > 22 ? (node.name || '').slice(0, 20) + '\u2026' : (node.name || '');
    ctx.fillText(name, 256, 42);

    const labelTex = new THREE.CanvasTexture(labelCanvas);
    labelTex.minFilter = THREE.LinearFilter;
    const labelSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false })
    );
    const lw = coreSize * 6;
    labelSprite.scale.set(lw, lw * (80 / 512), 1);
    labelSprite.position.y = -coreSize - 2.2;
    group.add(labelSprite);

    return group;
  }, [getGlowTexture]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((node: any) => {
    if (!node.id) return;
    const graphNode = graphData.nodes.find(n => n.id === node.id);
    if (graphNode && onNodeClick) onNodeClick(graphNode);

    const fg = fgRef.current;
    if (fg?.cameraPosition) {
      const distance = 200;
      const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
      fg.cameraPosition(
        { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
        { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
        1000
      );
    }
  }, [graphData, onNodeClick]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const FG = ForceGraph3DComponent as any;

  if (!data.nodes.length) return null;

  return (
    <FG
      ref={fgRef}
      graphData={data}
      width={width}
      height={height}
      backgroundColor="#0a0a1a"
      nodeThreeObject={createNodeObject}
      nodeThreeObjectExtend={false}
      onNodeClick={handleNodeClick}
      linkColor={() => 'rgba(148, 163, 184, 0.12)'}
      linkWidth={0.3}
      linkDirectionalParticles={1}
      linkDirectionalParticleWidth={0.8}
      linkDirectionalParticleSpeed={0.004}
      linkDirectionalParticleColor={() => 'rgba(148, 163, 184, 0.5)'}
      d3AlphaDecay={0.02}
      d3VelocityDecay={0.3}
      warmupTicks={50}
      cooldownTime={3000}
      onEngineStop={() => {
        if (hasZoomedRef.current) return; // Don't re-zoom if already fitted
        const fg = fgRef.current;
        if (fg?.zoomToFit) {
          const padding = graphData.nodes.length <= 5 ? -40 : 20;
          fg.zoomToFit(800, padding);
          hasZoomedRef.current = true;
        }
      }}
    />
  );
}
