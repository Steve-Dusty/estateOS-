import { Server as SocketIOServer } from 'socket.io';
import { GraphData, GraphNode, GraphLink } from '@/types/graph';
import { buildFullGraph } from './graph-builder';

let io: SocketIOServer | null = null;

export function initSocketServer(server: SocketIOServer): void {
  io = server;

  io.on('connection', (socket) => {
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
  io?.emit('graph:node:added', { node });
}

export function broadcastNodeUpdated(node: GraphNode): void {
  io?.emit('graph:node:updated', { node });
}

export function broadcastLinkAdded(link: GraphLink): void {
  io?.emit('graph:link:added', { link });
}

export function broadcastLinkUpdated(link: GraphLink): void {
  io?.emit('graph:link:updated', { link });
}

export function broadcastGraphDelta(delta: {
  newNodes: GraphNode[];
  updatedNodes: GraphNode[];
  newLinks: GraphLink[];
  updatedLinks: GraphLink[];
}): void {
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
  io?.emit('conversation:new', event);
}

export function getIO(): SocketIOServer | null {
  return io;
}
