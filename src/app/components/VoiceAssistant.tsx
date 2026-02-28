'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PROPERTIES } from '@/app/lib/properties';

type VoiceStatus = 'idle' | 'listening' | 'processing';

interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  pdfUrl?: string;
  pdfFilename?: string;
  imageUrl?: string;
}

interface LogEntry {
  id: string;
  label: string;
  text: string;
  done: boolean;
  color: string;
}

const intentBadge: Record<string, { label: string; color: string }> = {
  schematic:     { label: 'SCHEMATIC',   color: 'var(--accent)' },
  pdf_report:    { label: 'PDF REPORT',  color: 'var(--amber)' },
  email:         { label: 'EMAIL',       color: 'var(--green)' },
  world_builder: { label: 'WORLD BUILD', color: 'var(--accent)' },
  chat:          { label: 'INTEL',       color: 'var(--text-tertiary)' },
};

const intentRoute: Record<string, string> = {
  chat:          '/intelligence',
  pdf_report:    '/reports',
  schematic:     '/world-builder',
  world_builder: '/world-builder',
};

const toolLabel: Record<string, { label: string; color: string }> = {
  schematic:     { label: 'IMG',   color: 'var(--accent)' },
  pdf_report:    { label: 'PDF',   color: 'var(--amber)' },
  email:         { label: 'EMAIL', color: 'var(--green)' },
  world_builder: { label: '3D',    color: 'var(--accent)' },
  chat:          { label: 'LLM',   color: 'var(--text-tertiary)' },
};

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
    </svg>
  );
}

function SpinnerIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: 'va-spin 0.8s linear infinite', flexShrink: 0 }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

export default function VoiceAssistant() {
  const router = useRouter();
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const logIdRef = useRef(0);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, logs, liveTranscript]);

  const newLogId = () => String(++logIdRef.current);

  const addLog = useCallback((label: string, text: string, color: string, done = false): string => {
    const id = newLogId();
    setLogs(prev => [...prev, { id, label, text, done, color }]);
    return id;
  }, []);

  const resolveLog = useCallback((id: string, text: string) => {
    setLogs(prev => prev.map(l => l.id === id ? { ...l, text, done: true } : l));
  }, []);

  const addUserMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content }]);
    historyRef.current.push({ role: 'user', content });
  }, []);

  const addAssistantMessage = useCallback((data: {
    intent?: string; message?: string; pdfUrl?: string; pdfFilename?: string; imageUrl?: string;
  }) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: data.message ?? '',
      intent: data.intent,
      pdfUrl: data.pdfUrl,
      pdfFilename: data.pdfFilename,
      imageUrl: data.imageUrl,
    }]);
    historyRef.current.push({ role: 'assistant', content: data.message ?? '' });
  }, []);

  const handleRecordingStop = useCallback(async () => {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];
    setLiveTranscript('');

    // Log: STT
    const sttId = addLog('STT', 'Transcribing audio…', 'var(--accent)');

    try {
      const form = new FormData();
      form.append('audio', blob, 'audio.webm');
      const transcribeRes = await fetch('/api/transcribe', { method: 'POST', body: form });
      const { transcript, error: transcribeError } = await transcribeRes.json();

      if (transcribeError || !transcript) {
        resolveLog(sttId, 'Transcription failed');
        setStatus('idle');
        return;
      }

      resolveLog(sttId, `"${transcript}"`);
      addUserMessage(transcript);

      // Log: AGENT intent classification
      const intentId = addLog('AGENT', 'Classifying intent…', 'var(--text-tertiary)');

      const chatRes = await fetch('/api/chat-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: transcript, history: historyRef.current.slice(-10) }),
      });
      const data = await chatRes.json();

      if (!chatRes.ok || data.error) {
        resolveLog(intentId, '→ ERROR');
        addAssistantMessage({ message: data.error ?? 'Request failed. Please try again.' });
        return;
      }

      const intent = data.intent ?? 'chat';
      const badge = intentBadge[intent] ?? intentBadge.chat;
      resolveLog(intentId, `→ ${badge.label}`);

      // Log: tool call
      const tool = toolLabel[intent] ?? toolLabel.chat;
      const toolId = addLog(tool.label, 'Executing…', tool.color);

      await new Promise(r => setTimeout(r, 120));
      resolveLog(toolId,
        intent === 'email'         ? 'Email dispatched' :
        intent === 'pdf_report'    ? 'PDF generated' :
        intent === 'schematic'     ? 'Image generated' :
        intent === 'world_builder' ? 'Launching world gen…' :
        'Response ready'
      );

      addAssistantMessage(data);

      // Seed destination page state before navigating
      if (intent === 'pdf_report' && data.pdfUrl) {
        try {
          const existing = JSON.parse(sessionStorage.getItem('estateos_report_chat') || '[]');
          existing.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.message ?? 'Report is ready.',
            type: 'pdf',
            pdfUrl: data.pdfUrl,
            pdfFilename: data.pdfFilename,
            intent: 'pdf_report',
          });
          sessionStorage.setItem('estateos_report_chat', JSON.stringify(existing));
        } catch { /* silent */ }
      }

      if (intent === 'schematic' || intent === 'world_builder') {
        try {
          const lower = transcript.toLowerCase();
          // Collapse all spaces for fuzzy matching (handles "sun stone" → "sunstone")
          const lowerNoSpace = lower.replace(/\s+/g, '');
          const matched = PROPERTIES.find(p => {
            const addr = p.address.toLowerCase();
            const city = p.city.toLowerCase();
            // Full address match
            if (lower.includes(addr)) return true;
            // City match
            if (lower.includes(city)) return true;
            // Street name only — strip leading house number (e.g. "12 Sunstone" → "sunstone")
            const street = addr.replace(/^\d+\s*/, '').replace(/\s+/g, '');
            if (street.length > 3 && lowerNoSpace.includes(street)) return true;
            return false;
          });
          sessionStorage.setItem('va_pending_schematic', JSON.stringify({
            propertyImage: matched?.image ?? null,
            propertyId: matched?.id ?? null,
          }));
        } catch { /* silent */ }
      }

      // Navigate to the relevant page after a short delay
      const route = intentRoute[intent];
      if (route) {
        const navId = addLog('NAV', `Navigating to ${route}…`, 'var(--accent)');
        await new Promise(r => setTimeout(r, 2000));
        resolveLog(navId, `→ ${route}`);
        router.push(route);
        // For world-builder: dispatch event after navigation so the page reacts
        // whether it's freshly mounted or already open
        if (route === '/world-builder') {
          setTimeout(() => window.dispatchEvent(new CustomEvent('va-world-build')), 400);
        }
      }
    } catch (err) {
      console.error('Voice assistant error:', err);
      addAssistantMessage({ message: 'Something went wrong. Please try again.' });
    } finally {
      setStatus('idle');
    }
  }, [addLog, resolveLog, addUserMessage, addAssistantMessage]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      setLogs([]);
      setLiveTranscript('');
      setPanelOpen(true);

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = handleRecordingStop;
      recorder.start();
      setStatus('listening');
    } catch (err) {
      console.error('Mic access error:', err);
    }
  }, [handleRecordingStop]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setStatus('processing');
  }, []);

  const handleMicClick = useCallback(() => {
    if (status === 'listening') stopRecording();
    else if (status === 'idle') startRecording();
  }, [status, startRecording, stopRecording]);

  const showPanel = panelOpen && (messages.length > 0 || status !== 'idle' || logs.length > 0);

  return (
    <>
      <style>{`
        @keyframes va-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes va-pulse-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes va-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        .va-pulse-ring { animation: va-pulse-ring 1.2s ease-out infinite; }
        .va-blink      { animation: va-blink 1.1s ease-in-out infinite; }
      `}</style>

      <div style={{
        position: 'fixed', bottom: '40px', right: '16px', zIndex: 50,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px',
      }}>

        {/* ── Panel ── */}
        {showPanel && (
          <div style={{
            width: '380px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
          }}>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-muted)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent)' }}>
                  AGENT COPILOT
                </span>
                {status === 'listening' && (
                  <span className="va-blink" style={{
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
                    color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                    LIVE
                  </span>
                )}
              </div>
              <button onClick={() => setPanelOpen(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-tertiary)', fontSize: '16px', lineHeight: 1, padding: '2px 4px',
              }}>×</button>
            </div>

            {/* Messages */}
            {messages.length > 0 && (
              <div ref={messagesScrollRef} style={{
                maxHeight: '280px', overflowY: 'auto', padding: '12px',
                display: 'flex', flexDirection: 'column', gap: '10px',
              }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    {msg.role === 'assistant' && msg.intent && intentBadge[msg.intent] && (
                      <span style={{
                        fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
                        color: intentBadge[msg.intent].color, marginBottom: '3px', paddingLeft: '2px',
                      }}>
                        {intentBadge[msg.intent].label}
                      </span>
                    )}
                    {msg.role === 'user' ? (
                      <div style={{
                        background: 'var(--accent)', color: 'white',
                        padding: '7px 11px', borderRadius: '8px 8px 2px 8px',
                        fontSize: '12px', maxWidth: '85%', lineHeight: '1.45',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {msg.content}
                      </div>
                    ) : (
                      <div style={{
                        background: 'var(--bg-muted)', border: '1px solid var(--border)',
                        padding: '7px 11px', borderRadius: '2px 8px 8px 8px',
                        fontSize: '12px', maxWidth: '90%', lineHeight: '1.5',
                        color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {msg.content
                          ? <p style={{ margin: 0 }}>{msg.content}</p>
                          : !msg.pdfUrl && !msg.imageUrl && <p style={{ margin: 0, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No response</p>
                        }
                        {msg.pdfUrl && (
                          <div style={{
                            marginTop: msg.content ? '8px' : 0, padding: '6px 8px',
                            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                            borderRadius: '4px', fontSize: '11px',
                          }}>
                            <span style={{ color: 'var(--amber)', fontWeight: 600 }}>PDF Ready</span>
                            {' · '}
                            <a href={msg.pdfUrl} target="_blank" rel="noreferrer"
                              style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                              Open {msg.pdfFilename ?? 'report.pdf'}
                            </a>
                          </div>
                        )}
                        {msg.imageUrl && (
                          <img src={msg.imageUrl} alt="Generated schematic"
                            style={{ marginTop: msg.content ? '8px' : 0, width: '100%', borderRadius: '4px', display: 'block' }} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Activity log + live transcript ── */}
            {(logs.length > 0 || status === 'listening') && (
              <div style={{
                borderTop: messages.length > 0 ? '1px solid var(--border)' : 'none',
                background: 'rgba(0,0,0,0.18)',
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
              }}>

                {/* Live listening indicator */}
                {status === 'listening' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
                      color: '#ef4444', background: 'rgba(239,68,68,0.12)',
                      padding: '2px 5px', borderRadius: '3px', flexShrink: 0,
                    }}>MIC</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                      {liveTranscript || (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          Listening
                          <span className="va-blink" style={{ letterSpacing: '2px' }}>…</span>
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {/* Log entries */}
                {logs.map(log => (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, letterSpacing: '0.07em',
                      color: log.color, background: `color-mix(in srgb, ${log.color} 12%, transparent)`,
                      padding: '2px 5px', borderRadius: '3px', flexShrink: 0, minWidth: '38px',
                      textAlign: 'center',
                    }}>{log.label}</span>
                    <span style={{
                      fontSize: '11px', color: log.done ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                      fontFamily: 'monospace', flex: 1, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{log.text}</span>
                    <span style={{ flexShrink: 0 }}>
                      {log.done
                        ? <CheckIcon color={log.color} />
                        : <SpinnerIcon size={10} color={log.color} />}
                    </span>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* ── FAB ── */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {status === 'listening' && (
            <div className="va-pulse-ring" style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(239,68,68,0.3)', pointerEvents: 'none',
            }} />
          )}
          <button
            onClick={handleMicClick}
            disabled={status === 'processing'}
            title={status === 'idle' ? 'Start Agent Copilot' : status === 'listening' ? 'Stop recording' : 'Processing…'}
            style={{
              width: '44px', height: '44px', borderRadius: '50%', border: 'none',
              cursor: status === 'processing' ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white',
              background: status === 'listening' ? '#ef4444' : 'var(--accent)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              transition: 'background 0.2s',
              position: 'relative', zIndex: 1,
              opacity: status === 'processing' ? 0.8 : 1,
            }}
          >
            {status === 'idle' && <MicIcon />}
            {status === 'listening' && <StopIcon />}
            {status === 'processing' && <SpinnerIcon />}
          </button>
        </div>
      </div>
    </>
  );
}
