'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GraphData, GraphNode, GraphLink } from '@/types/graph';
import type { ConversationEvent, TopicEvent } from './useGraphData';

type EventHandler = {
  onInit?: (data: { graph: GraphData }) => void;
  onNodeAdded?: (data: { node: GraphNode }) => void;
  onNodeUpdated?: (data: { node: GraphNode }) => void;
  onLinkAdded?: (data: { link: GraphLink }) => void;
  onLinkUpdated?: (data: { link: GraphLink }) => void;
  onConversation?: (event: ConversationEvent) => void;
  onTopic?: (event: TopicEvent) => void;
};

export function useWebSocket(handlers: EventHandler) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  const [connected, setConnected] = useState(false);

  handlersRef.current = handlers;

  useEffect(() => {
    const socket = io({
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[ws] Connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[ws] Disconnected');
      setConnected(false);
    });

    socket.on('graph:init', (data: { graph: GraphData }) => {
      handlersRef.current.onInit?.(data);
    });

    socket.on('graph:node:added', (data: { node: GraphNode }) => {
      handlersRef.current.onNodeAdded?.(data);
    });

    socket.on('graph:node:updated', (data: { node: GraphNode }) => {
      handlersRef.current.onNodeUpdated?.(data);
    });

    socket.on('graph:link:added', (data: { link: GraphLink }) => {
      handlersRef.current.onLinkAdded?.(data);
    });

    socket.on('graph:link:updated', (data: { link: GraphLink }) => {
      handlersRef.current.onLinkUpdated?.(data);
    });

    socket.on('conversation:new', (event: ConversationEvent) => {
      handlersRef.current.onConversation?.(event);
    });

    socket.on('topic:new', (event: TopicEvent) => {
      handlersRef.current.onTopic?.(event);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { connected, emit };
}
