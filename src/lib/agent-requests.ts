export interface AgentRequest {
  id: string;
  clientId: string;
  clientName: string;
  propertyId: string;
  propertyAddress: string;
  propertyCity: string;
  propertyPrice: number;
  status: 'pending' | 'deployed' | 'active' | 'ended';
  roomName: string | null;
  serverUrl: string | null;
  participantToken: string | null;
  createdAt: number;
  deployedAt: number | null;
}

// In-memory store — fine for hackathon; persists across hot reloads via globalThis
declare global {
  // eslint-disable-next-line no-var
  var __agentRequests: Map<string, AgentRequest> | undefined;
}

function getStore(): Map<string, AgentRequest> {
  if (!globalThis.__agentRequests) {
    globalThis.__agentRequests = new Map();
  }
  return globalThis.__agentRequests;
}

export function createRequest(data: {
  clientId: string;
  clientName: string;
  propertyId: string;
  propertyAddress: string;
  propertyCity: string;
  propertyPrice: number;
}): AgentRequest {
  const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const request: AgentRequest = {
    id,
    ...data,
    status: 'pending',
    roomName: null,
    serverUrl: null,
    participantToken: null,
    createdAt: Date.now(),
    deployedAt: null,
  };
  getStore().set(id, request);
  return request;
}

export function getRequests(status?: AgentRequest['status']): AgentRequest[] {
  const all = Array.from(getStore().values());
  if (status) return all.filter((r) => r.status === status);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export function getRequest(id: string): AgentRequest | undefined {
  return getStore().get(id);
}

export function updateRequest(id: string, updates: Partial<AgentRequest>): AgentRequest | null {
  const req = getStore().get(id);
  if (!req) return null;
  const updated = { ...req, ...updates };
  getStore().set(id, updated);
  return updated;
}
