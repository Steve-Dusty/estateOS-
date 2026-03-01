'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import NavBar from '../components/NavBar';
import StatusBar from '../components/StatusBar';
import TopicStream from '../components/TopicStream';
import ForceGraph3D from '../components/ForceGraph3D';
import LiveStreamView from '../components/LiveStreamView';
import PersonPanel from '../components/PersonPanel';
import SearchBar from '../components/SearchBar';
import StatsOverlay from '../components/StatsOverlay';
import ElevenLabsRecorder from '../components/ElevenLabsRecorder';
import { useGraphData } from '@/hooks/useGraphData';
import type { GraphNode } from '@/types/graph';

interface TranscriptLine {
  text: string;
  timestamp: number;
}

export default function IntelligencePage() {
  const { graphData, stats, loading, connected, topics } = useGraphData();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [graphSize, setGraphSize] = useState({ width: 800, height: 600 });
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll transcript and fade old lines
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptLines]);

  // Fade out lines older than 60s
  useEffect(() => {
    const interval = setInterval(() => {
      setTranscriptLines(prev => prev.filter(l => Date.now() - l.timestamp < 60_000));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTranscript = useCallback((text: string) => {
    setTranscriptLines(prev => [...prev, { text, timestamp: Date.now() }].slice(-20));
  }, []);

  // Focus graph + open panel for a node
  const navigateToNode = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    // Toggle focusNodeId to re-trigger even if same node
    setFocusNodeId(null);
    requestAnimationFrame(() => setFocusNodeId(node.id));
  }, []);

  // Find a graph node by name (case-insensitive) and navigate to it
  const navigateToNodeByName = useCallback((name: string) => {
    const node = graphData.nodes.find(
      n => n.name.toLowerCase() === name.toLowerCase()
    );
    if (node) navigateToNode(node);
  }, [graphData.nodes, navigateToNode]);

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
                onNodeClick={navigateToNode}
                focusNodeId={focusNodeId}
                width={graphSize.width}
                height={graphSize.height}
              />
            )}

            {/* Overlay: top bar */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
              <div className="flex items-center gap-3 pointer-events-auto">
                <div className="text-sm font-semibold text-slate-200 font-mono">KNOWLEDGE GRAPH</div>
                <SearchBar nodes={graphData.nodes} onSelect={navigateToNode} />
              </div>
              <div className="flex items-center gap-3 pointer-events-auto">
                <StatsOverlay
                  stats={stats as { totalPersons: number; totalTopics: number; totalConversations: number; totalRelationships: number } | null}
                  connected={connected}
                  nodeCount={graphData.nodes.length}
                  linkCount={graphData.links.length}
                />
                <ElevenLabsRecorder onTranscript={handleTranscript} />
                <button
                  onClick={handleReset}
                  className="px-2 py-1 text-[10px] font-mono text-red-400/60 hover:text-red-400 hover:bg-red-900/20 border border-red-800/30 rounded transition-colors"
                >
                  RESET
                </button>
              </div>
            </div>

            {/* Overlay: live transcript on the left side */}
            {transcriptLines.length > 0 && (
              <div
                className="absolute bottom-4 left-3 z-10 pointer-events-none"
                style={{ maxWidth: '45%', maxHeight: '40%' }}
              >
                <div className="overflow-y-auto max-h-full flex flex-col gap-1.5 pr-2"
                  style={{ scrollbarWidth: 'none' }}>
                  {transcriptLines.map((line, i) => {
                    const age = Date.now() - line.timestamp;
                    const opacity = Math.max(0.3, 1 - age / 60_000);
                    return (
                      <div
                        key={`${line.timestamp}-${i}`}
                        className="text-[11px] leading-relaxed px-2.5 py-1.5 rounded"
                        style={{
                          color: `rgba(226,232,240,${opacity})`,
                          background: `rgba(13,17,23,${0.7 * opacity})`,
                          backdropFilter: 'blur(8px)',
                          borderLeft: '2px solid rgba(139,92,246,0.5)',
                          animation: 'fadeUp 0.3s ease-out',
                        }}
                      >
                        {line.text}
                      </div>
                    );
                  })}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            )}
          </div>

          {/* LiveStream — right half */}
          <LiveStreamView />
        </div>

        {/* Bottom: Topic stream */}
        <TopicStream topics={topics} onTopicClick={navigateToNodeByName} />
      </div>

      {/* Person detail panel (overlay on right) */}
      <PersonPanel node={selectedNode} onClose={() => setSelectedNode(null)} onNavigate={navigateToNodeByName} />

      <StatusBar />
    </div>
  );
}
