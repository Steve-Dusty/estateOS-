'use client';

import { useState, useEffect, useCallback } from 'react';
import NavBar from '../components/NavBar';
import StatusBar from '../components/StatusBar';
import { formatPrice } from '../lib/properties';

interface AgentRequest {
  id: string;
  clientId: string;
  clientName: string;
  propertyId: string;
  propertyAddress: string;
  propertyCity: string;
  propertyPrice: number;
  status: 'pending' | 'deployed' | 'active' | 'ended';
  roomName: string | null;
  createdAt: number;
  deployedAt: number | null;
}

export default function ClientsPage() {
  const [requests, setRequests] = useState<AgentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-requests');
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 3000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const deployAgent = useCallback(async (requestId: string) => {
    setDeploying(requestId);
    try {
      const res = await fetch(`/api/agent-requests/${requestId}/deploy`, { method: 'POST' });
      if (!res.ok) throw new Error('Deploy failed');
      await fetchRequests();
    } catch (err) {
      console.error('Deploy error:', err);
    } finally {
      setDeploying(null);
    }
  }, [fetchRequests]);

  const pending = requests.filter((r) => r.status === 'pending');
  const active = requests.filter((r) => r.status === 'deployed' || r.status === 'active');
  const ended = requests.filter((r) => r.status === 'ended');

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-body)' }}>
      <NavBar />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[20px] font-bold text-text-primary">Client Requests</h1>
              <p className="text-[12px] text-text-tertiary mt-0.5">
                Manage incoming agent conversation requests from clients
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: '#7c3aed', animation: 'soft-pulse 2s ease-in-out infinite' }} />
                <span className="font-mono text-[10px] font-semibold" style={{ color: '#a78bfa' }}>
                  {pending.length} pending
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm" style={{ background: 'var(--green-dim)' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--green)' }} />
                <span className="font-mono text-[10px] font-semibold" style={{ color: 'var(--green)' }}>
                  {active.length} active
                </span>
              </div>
            </div>
          </div>

          {/* Pending Requests */}
          {pending.length > 0 && (
            <div className="mb-6">
              <h2 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider mb-3">
                Pending Requests
              </h2>
              <div className="space-y-2">
                {pending.map((req) => (
                  <div key={req.id} className="rounded-sm overflow-hidden"
                    style={{ background: 'var(--bg-surface)', border: '1px solid rgba(124,58,237,0.3)' }}>
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 flex items-center justify-center rounded-sm" style={{ background: 'rgba(124,58,237,0.15)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-text-primary">{req.clientName}</span>
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                              {req.clientId}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-text-secondary">{req.propertyAddress}, {req.propertyCity}</span>
                            <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--green)' }}>{formatPrice(req.propertyPrice)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-text-tertiary">{formatTime(req.createdAt)}</span>
                        <button
                          onClick={() => deployAgent(req.id)}
                          disabled={deploying === req.id}
                          className="px-4 py-2 text-[11px] font-semibold rounded-sm transition-all cursor-pointer flex items-center gap-1.5"
                          style={{
                            background: deploying === req.id ? 'var(--bg-muted)' : '#7c3aed',
                            color: 'white',
                            opacity: deploying === req.id ? 0.7 : 1,
                          }}>
                          {deploying === req.id ? (
                            <>
                              <div className="w-3 h-3 rounded-full" style={{ border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white', animation: 'spin .8s linear infinite' }} />
                              Deploying…
                            </>
                          ) : (
                            <>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                              </svg>
                              Deploy Agent
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Conversations */}
          {active.length > 0 && (
            <div className="mb-6">
              <h2 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider mb-3">
                Active Conversations
              </h2>
              <div className="space-y-2">
                {active.map((req) => (
                  <div key={req.id} className="rounded-sm overflow-hidden"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 flex items-center justify-center rounded-sm" style={{ background: 'var(--green-dim)' }}>
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)', animation: 'soft-pulse 2s ease-in-out infinite' }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-text-primary">{req.clientName}</span>
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>
                              LIVE
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-text-secondary">{req.propertyAddress}, {req.propertyCity}</span>
                            <span className="font-mono text-[10px] text-text-tertiary">Room: {req.roomName}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {req.deployedAt && (
                          <span className="font-mono text-[10px] text-text-tertiary">
                            deployed {formatTime(req.deployedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {ended.length > 0 && (
            <div className="mb-6">
              <h2 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider mb-3">
                History
              </h2>
              <div className="space-y-2">
                {ended.map((req) => (
                  <div key={req.id} className="rounded-sm overflow-hidden opacity-60"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 flex items-center justify-center rounded-sm" style={{ background: 'var(--bg-muted)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                        <div>
                          <span className="text-[13px] font-semibold text-text-primary">{req.clientName}</span>
                          <div className="text-[11px] text-text-tertiary mt-0.5">
                            {req.propertyAddress}, {req.propertyCity}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-text-tertiary">{formatTime(req.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full" style={{ border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : requests.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4" style={{ opacity: 0.15, color: 'var(--accent)' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <p className="text-[13px] text-text-tertiary">No client requests yet.</p>
              <p className="text-[11px] text-text-tertiary mt-1">
                Requests will appear here when clients want to speak with an agent about a property.
              </p>
            </div>
          )}
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
