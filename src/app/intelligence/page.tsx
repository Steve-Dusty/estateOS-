'use client';

import { useState, useEffect, useRef } from 'react';
import NavBar from '../components/NavBar';
import StatusBar from '../components/StatusBar';
import ConversationStream from '../components/ConversationStream';
import ForceGraph3D from '../components/ForceGraph3D';
import LiveStreamView from '../components/LiveStreamView';
import PersonPanel from '../components/PersonPanel';
import SearchBar from '../components/SearchBar';
import StatsOverlay from '../components/StatsOverlay';
import { useGraphData } from '@/hooks/useGraphData';
import type { GraphNode } from '@/types/graph';

export default function IntelligencePage() {
  const { graphData, stats, loading, connected, conversations } = useGraphData();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [graphSize, setGraphSize] = useState({ width: 800, height: 600 });
  const graphContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateSize = () => {
      if (graphContainerRef.current) {
        const rect = graphContainerRef.current.getBoundingClientRect();
        setGraphSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
  };

  const handleReset = async () => {
    if (!confirm('Clear all knowledge graph data? This cannot be undone.')) return;
    await fetch('/api/reset', { method: 'DELETE' });
    setSelectedNode(null);
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-body)' }}>
      <NavBar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top row: Graph (left) + LiveStream (right) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Knowledge Graph — left ~60% */}
          <div ref={graphContainerRef} className="flex-[3] relative overflow-hidden" style={{ background: '#0a0a1a' }}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-cyan-400 animate-pulse font-mono text-sm">Initializing graph...</div>
              </div>
            ) : (
              <ForceGraph3D
                graphData={graphData}
                onNodeClick={handleNodeClick}
                width={graphSize.width}
                height={graphSize.height}
              />
            )}

            {/* Overlay: top bar */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
              <div className="flex items-center gap-3 pointer-events-auto">
                <div className="text-sm font-semibold text-slate-200 font-mono">KNOWLEDGE GRAPH</div>
                <SearchBar nodes={graphData.nodes} onSelect={handleNodeClick} />
              </div>
              <div className="flex items-center gap-3 pointer-events-auto">
                <StatsOverlay
                  stats={stats as { totalPersons: number; totalTopics: number; totalConversations: number; totalRelationships: number } | null}
                  connected={connected}
                  nodeCount={graphData.nodes.length}
                  linkCount={graphData.links.length}
                />
                <button
                  onClick={handleReset}
                  className="px-2 py-1 text-[10px] font-mono text-red-400/60 hover:text-red-400 hover:bg-red-900/20 border border-red-800/30 rounded transition-colors"
                >
                  RESET
                </button>
              </div>
            </div>
          </div>

          {/* LiveStream — right half */}
          <LiveStreamView />
        </div>

        {/* Bottom: Conversation stream */}
        <ConversationStream conversations={conversations} />
      </div>

      {/* Person detail panel (overlay on right) */}
      <PersonPanel node={selectedNode} onClose={() => setSelectedNode(null)} />

      <StatusBar />
    </div>
  );
}
