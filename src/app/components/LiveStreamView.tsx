'use client';

import { useEffect, useState, useRef } from 'react';

const SIGNALING_URL = process.env.NEXT_PUBLIC_WEBRTC_SIGNALING_URL || 'ws://localhost:8080';
const TURN_API_URL = SIGNALING_URL.replace('ws://', 'http://').replace('wss://', 'https://') + '/api/turn';

export default function LiveStreamView() {
  const [elapsed, setElapsed] = useState(0);
  const [rtcState, setRtcState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [hasStream, setHasStream] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function cleanup() {
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (videoRef.current) videoRef.current.srcObject = null;
      remoteStreamRef.current = null;
      pendingCandidatesRef.current = [];
    }

    async function setupPeerConnection() {
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }

      // Fetch TURN credentials from signaling server
      let iceServers: RTCIceServer[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ];
      try {
        const resp = await fetch(TURN_API_URL);
        const creds = await resp.json();
        if (creds?.iceServers) {
          for (const s of creds.iceServers) {
            iceServers.push({ urls: s.urls, username: s.username, credential: s.credential });
          }
        }
      } catch {
        // STUN only
      }

      const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 2 });
      pcRef.current = pc;

      pc.ontrack = (e) => {
        if (!mounted) return;
        const video = videoRef.current;
        if (!video) return;

        if (e.streams?.[0]) {
          remoteStreamRef.current = e.streams[0];
        } else {
          if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
          remoteStreamRef.current.addTrack(e.track);
        }
        video.srcObject = remoteStreamRef.current;
        video.play().catch(() => {});
        setHasStream(true);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'candidate',
            candidate: e.candidate.candidate,
            sdpMid: e.candidate.sdpMid,
            sdpMLineIndex: e.candidate.sdpMLineIndex,
          }));
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (!mounted) return;
        switch (pc.iceConnectionState) {
          case 'connected':
          case 'completed':
            setRtcState('connected');
            setHasStream(true);
            if (remoteStreamRef.current && videoRef.current) {
              videoRef.current.srcObject = remoteStreamRef.current;
            }
            break;
          case 'disconnected':
            setRtcState('connecting');
            break;
          case 'failed':
          case 'closed':
            setRtcState('disconnected');
            break;
        }
      };

      return pc;
    }

    async function handleSignaling(msg: Record<string, unknown>) {
      if (!mounted) return;

      switch (msg.type) {
        case 'room_joined':
          setRtcState('connecting');
          break;

        case 'offer': {
          pendingCandidatesRef.current = [];
          const pc = await setupPeerConnection();
          if (!pc) return;
          await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp as string });
          // Flush any candidates that arrived before the offer was set
          for (const c of pendingCandidatesRef.current) {
            await pc.addIceCandidate(c);
          }
          pendingCandidatesRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          wsRef.current?.send(JSON.stringify({ type: 'answer', sdp: answer.sdp }));
          break;
        }

        case 'candidate': {
          const candidate: RTCIceCandidateInit = {
            candidate: msg.candidate as string,
            sdpMid: msg.sdpMid as string,
            sdpMLineIndex: msg.sdpMLineIndex as number,
          };
          if (pcRef.current?.remoteDescription) {
            await pcRef.current.addIceCandidate(candidate);
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
          break;
        }

        case 'peer_left':
          if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
          if (videoRef.current) videoRef.current.srcObject = null;
          remoteStreamRef.current = null;
          setHasStream(false);
          setRtcState('connecting');
          break;

        case 'error':
          if (msg.message === 'No active stream') {
            // Retry joining after 3s
            setTimeout(() => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'join' }));
              }
            }, 3000);
          }
          break;
      }
    }

    function connect() {
      if (!mounted) return;
      cleanup();
      setRtcState('connecting');

      const ws = new WebSocket(SIGNALING_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        // Auto-join first available room (no code needed)
        ws.send(JSON.stringify({ type: 'join' }));
      };

      ws.onmessage = (e) => {
        try {
          handleSignaling(JSON.parse(e.data));
        } catch {}
      };

      ws.onclose = () => {
        if (!mounted) return;
        setRtcState('disconnected');
        setHasStream(false);
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      mounted = false;
      clearTimeout(reconnectTimer);
      cleanup();
    };
  }, []);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative flex-[2] min-h-0 flex flex-col border-l overflow-hidden"
      style={{ borderColor: 'var(--border)', background: '#050810' }}>

      {/* Video area */}
      <div className="flex-1 relative">
        {/* WebRTC video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${hasStream ? 'block' : 'hidden'}`}
          style={{ background: '#000' }}
        />

        {/* Placeholder background (when no stream) */}
        {!hasStream && (
          <>
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(135deg, #070c14 0%, #0a1018 35%, #0d1520 60%, #080d16 100%)' }} />
            <div className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 65% 35%, rgba(255,255,255,0.02) 0%, transparent 50%)' }} />
            <div className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 30% 70%, rgba(6,182,212,0.015) 0%, transparent 40%)' }} />
          </>
        )}

        {/* Grid overlay */}
        <div className="absolute inset-0 graph-grid opacity-40 pointer-events-none" />

        {/* Viewfinder brackets */}
        <div className="absolute top-3 left-3 w-5 h-5 pointer-events-none"
          style={{ borderTop: '1.5px solid rgba(6,182,212,0.35)', borderLeft: '1.5px solid rgba(6,182,212,0.35)' }} />
        <div className="absolute top-3 right-3 w-5 h-5 pointer-events-none"
          style={{ borderTop: '1.5px solid rgba(6,182,212,0.35)', borderRight: '1.5px solid rgba(6,182,212,0.35)' }} />
        <div className="absolute bottom-3 left-3 w-5 h-5 pointer-events-none"
          style={{ borderBottom: '1.5px solid rgba(6,182,212,0.35)', borderLeft: '1.5px solid rgba(6,182,212,0.35)' }} />
        <div className="absolute bottom-3 right-3 w-5 h-5 pointer-events-none"
          style={{ borderBottom: '1.5px solid rgba(6,182,212,0.35)', borderRight: '1.5px solid rgba(6,182,212,0.35)' }} />

        {/* Center crosshair */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-8 h-px" style={{ background: 'rgba(6,182,212,0.15)' }} />
          <div className="h-8 w-px absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ background: 'rgba(6,182,212,0.15)' }} />
        </div>

        {/* HUD: Top-left — LIVE indicator */}
        <div className="absolute top-3 left-8 flex items-center gap-2 pointer-events-none">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm" style={{ background: hasStream ? 'rgba(239,68,68,0.15)' : 'rgba(100,100,100,0.15)' }}>
            <div className="w-[5px] h-[5px] rounded-full status-live" style={{ background: hasStream ? 'var(--red)' : '#6b7280' }} />
            <span className="font-mono text-[9px] font-semibold" style={{ color: hasStream ? 'var(--red)' : '#6b7280' }}>
              {hasStream ? 'LIVE' : 'STANDBY'}
            </span>
          </div>
          <span className="font-mono text-[10px] text-text-tertiary">{fmt(elapsed)}</span>
        </div>

        {/* HUD: Top-right — Signal */}
        <div className="absolute top-3 right-8 flex items-center gap-2 pointer-events-none">
          <span className="font-mono text-[9px] text-text-tertiary">WebRTC</span>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4].map(bar => (
              <div key={bar} className="rounded-sm"
                style={{
                  width: '2px',
                  height: `${bar * 3 + 2}px`,
                  background: rtcState === 'connected'
                    ? (bar <= 3 ? 'var(--green)' : 'rgba(255,255,255,0.1)')
                    : rtcState === 'connecting'
                      ? (bar <= 1 ? '#f59e0b' : 'rgba(255,255,255,0.1)')
                      : 'rgba(255,255,255,0.1)',
                }} />
            ))}
          </div>
        </div>

        {/* HUD: Bottom-left — Resolution + FPS */}
        <div className="absolute bottom-3 left-8 flex items-center gap-3 pointer-events-none">
          <span className="font-mono text-[9px] text-text-tertiary">1080p</span>
          <span className="font-mono text-[9px] text-text-tertiary">30fps</span>
          <span className="font-mono text-[9px] text-text-tertiary">42ms</span>
        </div>

        {/* HUD: Bottom-right — Source */}
        <div className="absolute bottom-3 right-8 flex items-center gap-1.5 pointer-events-none">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
            <circle cx="6" cy="14" r="4"/><circle cx="18" cy="14" r="4"/><path d="M10 14h4"/><path d="M2 14l2-6h16l2 6"/>
          </svg>
          <span className="font-mono text-[9px] text-accent" style={{ opacity: 0.6 }}>Meta Ray-Ban</span>
        </div>

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)' }} />

        {/* Scanlines */}
        <div className="absolute inset-0 pointer-events-none scanlines" />
      </div>

      {/* Status strip */}
      <div className="flex items-center justify-between px-3 py-1 border-t shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-[4px] h-[4px] rounded-full status-live" style={{
              background: rtcState === 'connected' ? 'var(--green)'
                : rtcState === 'connecting' ? '#f59e0b'
                : 'var(--red)'
            }} />
            <span className="font-mono text-[9px]" style={{
              color: rtcState === 'connected' ? 'var(--green)'
                : rtcState === 'connecting' ? '#f59e0b'
                : 'var(--red)'
            }}>
              {rtcState === 'connected' ? 'Connected' : rtcState === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
          <span className="text-[9px] text-text-tertiary">&middot;</span>
          <span className="font-mono text-[9px] text-text-tertiary">WebRTC &middot; Port 8080</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] text-text-tertiary">{hasStream ? 'P2P' : 'Waiting'}</span>
          <div className="w-[4px] h-[4px] rounded-full" style={{ background: 'var(--accent)', opacity: hasStream ? 0.8 : 0.3 }} />
        </div>
      </div>
    </div>
  );
}
