'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import PdfModal from './PdfModal';

// ── Types ────────────────────────────────────────────────────────────────────
export type MessageType = 'text' | 'image' | 'pdf';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: MessageType;
  imageUrl?: string;
  pdfUrl?: string;
  pdfFilename?: string;
  intent?: string;
}

const API_URL     = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const STORAGE_KEY = 'estateos_chat_history';

function saveMessages(msgs: Message[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch {
    try {
      const stripped = msgs.map(m =>
        m.type === 'image' ? { ...m, imageUrl: undefined } : m
      );
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
    } catch { /* silently fail */ }
  }
}

function loadMessages(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

const SUGGESTIONS = [
  { label: 'Floor plan for 3-bed house', icon: '🏠' },
  { label: 'Market analysis report for Austin, TX', icon: '📊' },
  { label: 'Investment report for 5-unit apartment', icon: '📄' },
  { label: 'Neighborhood analysis for Beverly Hills', icon: '🏙️' },
];

const intentBadge: Record<string, { label: string; color: string; bg: string }> = {
  schematic:  { label: 'Floor Plan', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
  pdf_report: { label: 'PDF Report', color: '#0891B2', bg: 'rgba(8,145,178,0.08)' },
  chat:       { label: 'Chat',       color: '#64748B', bg: 'rgba(100,116,139,0.08)' },
};

// ── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 message-enter">
      <div className="w-6 h-6 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
        style={{ background: 'var(--accent)' }}>
        AI
      </div>
      <div className="px-3 py-2.5 text-[12px]"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1 h-4">
          <span className="w-1.5 h-1.5 typing-dot" style={{ background: 'var(--accent)', borderRadius: '50%' }} />
          <span className="w-1.5 h-1.5 typing-dot" style={{ background: 'var(--accent)', borderRadius: '50%' }} />
          <span className="w-1.5 h-1.5 typing-dot" style={{ background: 'var(--accent)', borderRadius: '50%' }} />
        </div>
      </div>
    </div>
  );
}

// ── Image lightbox ────────────────────────────────────────────────────────────
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="lightbox-backdrop fixed inset-0 z-[60] flex items-center justify-center p-4 cursor-zoom-out"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Schematic full view"
        className="lightbox-image max-w-full max-h-full object-contain shadow-2xl cursor-default"
        style={{ borderRadius: '2px' }}
        onClick={e => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white transition-colors"
        style={{ background: 'rgba(255,255,255,0.12)' }}
        aria-label="Close"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  msg,
  onViewPdf,
  onExpandImage,
}: {
  msg: Message;
  onViewPdf: (url: string, filename: string) => void;
  onExpandImage: (src: string) => void;
}) {
  const isUser = msg.role === 'user';
  const badge  = msg.intent ? intentBadge[msg.intent] : null;

  return (
    <div className={`flex items-end gap-2 message-enter ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-[9px] font-bold"
        style={{
          background: isUser ? 'var(--bg-muted)' : 'var(--accent)',
          color: isUser ? 'var(--text-secondary)' : 'white',
        }}
      >
        {isUser ? 'You' : 'AI'}
      </div>

      {/* Bubble */}
      <div className={`max-w-[82%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Intent badge */}
        {badge && !isUser && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 self-start"
            style={{ color: badge.color, background: badge.bg }}>
            {badge.label}
          </span>
        )}

        <div
          className="px-3 py-2 text-[12px] leading-relaxed"
          style={isUser ? {
            background: 'var(--accent)',
            color: 'white',
          } : {
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          {/* Text / PDF text */}
          {(msg.type === 'text' || msg.type === 'pdf') && (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          )}

          {/* Image */}
          {msg.type === 'image' && msg.imageUrl && (
            <div className="flex flex-col gap-2">
              {msg.content && <p className="whitespace-pre-wrap mb-1">{msg.content}</p>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={msg.imageUrl}
                alt="Generated schematic"
                onClick={() => onExpandImage(msg.imageUrl!)}
                className="max-w-full w-auto max-h-[280px] object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
                style={{ border: '1px solid var(--border)' }}
              />
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  onClick={() => onExpandImage(msg.imageUrl!)}
                  className="text-[10px] font-medium transition-opacity hover:opacity-70"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Expand
                </button>
                <span style={{ color: 'var(--border)' }}>·</span>
                <a
                  href={msg.imageUrl}
                  download="schematic.png"
                  className="text-[10px] font-medium transition-opacity hover:opacity-70"
                  style={{ color: 'var(--accent)' }}
                >
                  Download
                </a>
              </div>
            </div>
          )}

          {/* PDF */}
          {msg.type === 'pdf' && msg.pdfUrl && (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 p-2"
                style={{ background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.15)' }}>
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center"
                  style={{ background: 'var(--accent)' }}>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {msg.pdfFilename ?? 'report.pdf'}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>PDF Report · Ready</p>
                </div>
              </div>

              <div className="flex gap-1.5">
                <button
                  onClick={() => onViewPdf(msg.pdfUrl!, msg.pdfFilename ?? 'report.pdf')}
                  className="flex-1 py-1.5 text-[10px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--accent)' }}
                >
                  View Report
                </button>
                <a
                  href={msg.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-1.5 text-[10px] font-semibold text-white text-center transition-opacity hover:opacity-90"
                  style={{ background: 'var(--green)' }}
                >
                  Download
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ChatPanel component ──────────────────────────────────────────────────
interface ChatPanelProps {
  onClose: () => void;
}

export default function ChatPanel({ onClose }: ChatPanelProps) {
  const [messages,      setMessages]      = useState<Message[]>(() => loadMessages());
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [modalPdf,      setModalPdf]      = useState<{ url: string; filename: string } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { saveMessages(messages); }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  // Close panel on Escape (only when no modals are open)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !modalPdf && !lightboxImage) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, modalPdf, lightboxImage]);

  const handleViewPdf = useCallback((url: string, filename: string) => {
    setModalPdf({ url, filename });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id:      crypto.randomUUID(),
      role:    'user',
      content: trimmed,
      type:    'text',
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_URL}/api/chat-report`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: trimmed, history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }

      const data = await res.json();

      const assistantMsg: Message = {
        id:          crypto.randomUUID(),
        role:        'assistant',
        content:     data.message ?? '',
        type:        data.type as MessageType,
        imageUrl:    data.imageUrl,
        pdfUrl:      data.pdfUrl,
        pdfFilename: data.pdfFilename,
        intent:      data.intent,
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (data.type === 'pdf' && data.pdfUrl) {
        setModalPdf({ url: data.pdfUrl, filename: data.pdfFilename ?? 'report.pdf' });
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id:      crypto.randomUUID(),
        role:    'assistant',
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        type:    'text',
      }]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput('');
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <>
      {/* Panel */}
      <div
        className="fixed right-0 z-30 flex flex-col pdf-panel-enter"
        style={{
          top: '48px',
          bottom: '28px',
          width: '360px',
          background: 'var(--bg-elevated)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3"
          style={{ background: 'var(--accent)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[13px] font-semibold text-white leading-none">AI Reports</h2>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Floor plans · PDF reports · Market analysis
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.12)' }}
            aria-label="Close panel"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 pb-6">
              <div className="text-center space-y-1">
                <div className="mx-auto w-10 h-10 flex items-center justify-center"
                  style={{ background: 'var(--accent)' }}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 4l9 5.75V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.75z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
                  </svg>
                </div>
                <p className="text-[13px] font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>
                  EstateOS AI
                </p>
                <p className="text-[11px] max-w-[220px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
                  Generate floor plans, PDF market reports, or ask real estate questions.
                </p>
              </div>

              <div className="w-full space-y-1.5">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s.label}
                    onClick={() => sendMessage(s.label)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors hover:opacity-80"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span>{s.icon}</span>
                    <span className="font-medium">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  onViewPdf={handleViewPdf}
                  onExpandImage={setLightboxImage}
                />
              ))}
              {loading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-3 py-3"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          {messages.length > 0 && (
            <div className="flex justify-end mb-1.5">
              <button
                onClick={clearChat}
                className="text-[10px] transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Clear
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about floor plans, reports, market data…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none text-[12px] px-3 py-2 outline-none transition-colors overflow-y-auto"
              style={{
                background: 'var(--bg-body)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontFamily: 'DM Sans, sans-serif',
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
              style={{ background: 'var(--accent)' }}
              aria-label="Send"
            >
              {loading ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>

          <p className="text-center text-[10px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}

      {/* PDF modal */}
      {modalPdf && (
        <PdfModal
          pdfUrl={modalPdf.url}
          filename={modalPdf.filename}
          onClose={() => setModalPdf(null)}
        />
      )}
    </>
  );
}
