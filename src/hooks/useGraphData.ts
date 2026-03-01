'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { GraphData, GraphNode, GraphLink } from '@/types/graph';
import { useWebSocket } from './useWebSocket';

export interface ConversationEvent {
  speaker: string;
  source: string;
  content: string;
  role: string;
  timestamp: string;
}

export interface TopicEvent {
  name: string;
  source: string;
  timestamp: string;
}

export function useGraphData() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationEvent[]>([]);
  const [topics, setTopics] = useState<TopicEvent[]>([]);
  const initializedRef = useRef(false);

  const mergeNode = useCallback((node: GraphNode, isNew: boolean) => {
    setGraphData(prev => {
      const existingIdx = prev.nodes.findIndex(n => n.id === node.id);
      if (existingIdx >= 0) {
        const newNodes = [...prev.nodes];
        newNodes[existingIdx] = { ...newNodes[existingIdx], ...node };
        return { ...prev, nodes: newNodes };
      }
      if (isNew) {
        return { ...prev, nodes: [...prev.nodes, node] };
      }
      return prev;
    });
  }, []);

  const mergeLink = useCallback((link: GraphLink, isNew: boolean) => {
    setGraphData(prev => {
      const existingIdx = prev.links.findIndex(
        l => l.source === link.source && l.target === link.target && l.type === link.type
      );
      if (existingIdx >= 0) {
        const newLinks = [...prev.links];
        newLinks[existingIdx] = { ...newLinks[existingIdx], weight: (newLinks[existingIdx].weight || 0) + 1 };
        return { ...prev, links: newLinks };
      }
      if (isNew) {
        const sourceExists = prev.nodes.some(n => n.id === link.source);
        const targetExists = prev.nodes.some(n => n.id === link.target);
        if (sourceExists && targetExists) {
          return { ...prev, links: [...prev.links, link] };
        }
      }
      return prev;
    });
  }, []);

  const { connected } = useWebSocket({
    onInit: ({ graph }) => {
      if (!initializedRef.current) {
        console.log('[useGraphData] Got graph:init with', graph.nodes.length, 'nodes,', graph.links.length, 'links');
        setGraphData(graph);
        setLoading(false);
        initializedRef.current = true;
      }
    },
    onNodeAdded: ({ node }) => mergeNode(node, true),
    onNodeUpdated: ({ node }) => mergeNode(node, false),
    onLinkAdded: ({ link }) => mergeLink(link, true),
    onLinkUpdated: ({ link }) => mergeLink(link, false),
    onConversation: (event: ConversationEvent) => {
      setConversations(prev => [event, ...prev].slice(0, 200));
    },
    onTopic: (event: TopicEvent) => {
      setTopics(prev => [event, ...prev].slice(0, 200));
    },
  });

  // Fallback: fetch via REST if WebSocket hasn't initialized after 3s
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!initializedRef.current) {
        console.log('[useGraphData] WS timeout, falling back to REST');
        fetch(`${window.location.origin}/api/graph`)
          .then(res => res.json())
          .then(data => {
            if (data.graph && !initializedRef.current) {
              setGraphData(data.graph);
              setStats(data.stats);
              initializedRef.current = true;
            }
          })
          .catch(err => console.error('[useGraphData] Fetch error:', err))
          .finally(() => setLoading(false));
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch initial conversations for the stream
  useEffect(() => {
    fetch(`${window.location.origin}/api/conversations/recent`)
      .then(res => res.json())
      .then(data => {
        if (data.conversations) {
          setConversations(data.conversations);
        }
      })
      .catch(() => {});
  }, []);

  return { graphData, stats, loading, connected, conversations, topics };
}
