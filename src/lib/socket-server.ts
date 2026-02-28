import { Server as SocketIOServer } from 'socket.io';
import { GraphData, GraphNode, GraphLink } from '@/types/graph';
import { buildFullGraph } from './graph-builder';

// Use globalThis to share the Socket.IO instance between the custom server
// (server.ts) and Next.js API routes (which run in a separate module context).
declare global {
  // eslint-disable-next-line no-var
  var __socketIO: SocketIOServer | undefined;
}

function getIO(): SocketIOServer | null {
  return globalThis.__socketIO || null;
}

export function initSocketServer(server: SocketIOServer): void {
  globalThis.__socketIO = server;

  server.on('connection', (socket) => {
    console.log(`[socket] Client connected: ${socket.id}`);

    // Send full graph on connect
    const graph = buildFullGraph();
    console.log(`[socket] Sending graph:init with ${graph.nodes.length} nodes, ${graph.links.length} links`);
    socket.emit('graph:init', { graph });

    socket.on('disconnect', () => {
      console.log(`[socket] Client disconnected: ${socket.id}`);
    });
  });
}

export function broadcastNodeAdded(node: GraphNode): void {
  getIO()?.emit('graph:node:added', { node });
}

export function broadcastNodeUpdated(node: GraphNode): void {
  getIO()?.emit('graph:node:updated', { node });
}

export function broadcastLinkAdded(link: GraphLink): void {
  getIO()?.emit('graph:link:added', { link });
}

export function broadcastLinkUpdated(link: GraphLink): void {
  getIO()?.emit('graph:link:updated', { link });
}

export function broadcastGraphDelta(delta: {
  newNodes: GraphNode[];
  updatedNodes: GraphNode[];
  newLinks: GraphLink[];
  updatedLinks: GraphLink[];
}): void {
  const io = getIO();
  if (!io) {
    console.warn('[socket] No Socket.IO instance — delta not broadcast');
    return;
  }
  for (const node of delta.newNodes) broadcastNodeAdded(node);
  for (const node of delta.updatedNodes) broadcastNodeUpdated(node);
  for (const link of delta.newLinks) broadcastLinkAdded(link);
  for (const link of delta.updatedLinks) broadcastLinkUpdated(link);
}

export function broadcastConversation(event: {
  speaker: string;
  source: string;
  content: string;
  role: string;
  timestamp: string;
}): void {
  getIO()?.emit('conversation:new', event);
}

export { getIO };
