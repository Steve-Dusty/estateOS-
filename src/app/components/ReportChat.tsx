'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReportPdfModal from './ReportPdfModal';
import { Property, formatPrice } from '../lib/properties';

export type MessageType = 'text' | 'image' | 'pdf';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: MessageType;
  imageUrl?: string;
  imageFilename?: string;
  pdfUrl?: string;
  pdfFilename?: string;
  intent?: string;
}

const STORAGE_KEY = 'estateos_report_chat';

function saveMessages(msgs: Message[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch {
    try {
      const stripped = msgs.map(m =>
        m.type === 'image' ? { ...m, imageUrl: undefined } : m
      );
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
    } catch { /* silent */ }
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
  { label: 'Floor plan for 3-bed house', icon: 'SCHM' },
  { label: 'Market analysis for Irvine, CA', icon: 'MRKT' },
  { label: 'Office space schematic', icon: 'ARCH' },
  { label: 'Investment report for 5-unit complex', icon: 'RPRT' },
];

const intentBadge: Record<string, { label: string; color: string; dimColor: string }> = {
  schematic:  { label: 'SCHEMATIC', color: 'var(--accent)', dimColor: 'var(--accent-dim)' },
  pdf_report: { label: 'PDF REPORT', color: 'var(--amber)', dimColor: 'var(--amber-dim)' },
  email:      { label: 'EMAIL',      color: 'var(--green)',          dimColor: 'rgba(16,185,129,0.08)' },
  chat:       { label: 'INTEL',      color: 'var(--text-tertiary)', dimColor: 'rgba(100,116,139,0.08)' },
};

/* ── Typing indicator ── */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 fade-in">
      <div className="flex-shrink-0 w-7 h-7 rounded-sm flex items-center justify-center text-[9px] font-bold"
        style={{ background: 'var(--accent)', color: 'white' }}>
        OS
      </div>
      <div className="glass rounded-sm rounded-bl-none px-4 py-3">
        <div className="flex items-center gap-1.5 h-4">
          <span className="w-1.5 h-1.5 rounded-full chat-typing-dot" style={{ background: 'var(--accent)' }} />
          <span className="w-1.5 h-1.5 rounded-full chat-typing-dot" style={{ background: 'var(--accent)' }} />
          <span className="w-1.5 h-1.5 rounded-full chat-typing-dot" style={{ background: 'var(--accent)' }} />
        </div>
      </div>
    </div>
  );
}

/* ── Image lightbox ── */
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-zoom-out chat-lightbox-backdrop"
      style={{ background: 'rgba(8,12,20,0.92)' }}
      onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Schematic full view"
        className="max-w-full max-h-full object-contain rounded-sm cursor-default chat-lightbox-image"
        style={{ boxShadow: '0 0 80px rgba(6,182,212,0.15), 0 20px 60px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 rounded-sm flex items-center justify-center text-white transition-colors cursor-pointer"
        style={{ background: 'rgba(255,255,255,0.08)' }}
        aria-label="Close">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ── Single message bubble ── */
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
    <div className={`flex items-end gap-3 fade-in ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-sm flex items-center justify-center text-[9px] font-bold"
        style={{
          background: isUser ? 'var(--bg-muted)' : 'var(--accent)',
          color: isUser ? 'var(--text-secondary)' : 'white',
          border: isUser ? '1px solid var(--border)' : 'none',
        }}>
        {isUser ? 'KQ' : 'OS'}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Intent badge */}
        {badge && !isUser && (
          <span className="text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded-sm font-mono"
            style={{ background: badge.dimColor, color: badge.color }}>
            {badge.label}
          </span>
        )}

        <div className="rounded-sm px-4 py-3 text-[12px] leading-relaxed"
          style={{
            background: isUser ? 'var(--accent)' : 'var(--bg-surface)',
            color: isUser ? 'white' : 'var(--text-primary)',
            border: isUser ? 'none' : '1px solid var(--border)',
            borderRadius: isUser ? '4px 4px 0 4px' : '4px 4px 4px 0',
          }}>

          {/* Text content */}
          {(msg.type === 'text' || msg.type === 'pdf') && (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          )}

          {/* Image content */}
          {msg.type === 'image' && msg.imageUrl && (
            <div className="flex flex-col gap-2">
              {msg.content && <p className="whitespace-pre-wrap mb-2">{msg.content}</p>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={msg.imageUrl}
                alt="Generated schematic"
                onClick={() => onExpandImage(msg.imageUrl!)}
                className="rounded-sm max-w-full w-auto max-h-[400px] object-contain cursor-zoom-in transition-opacity hover:opacity-80"
                style={{ border: '1px solid var(--border)' }}
              />
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => onExpandImage(msg.imageUrl!)}
                  className="inline-flex items-center gap-1 text-[10px] font-medium transition-colors cursor-pointer"
                  style={{ color: 'var(--text-tertiary)' }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 8v6M8 11h6" />
                  </svg>
                  Expand
                </button>
                <a
                  href={msg.imageUrl}
                  download="schematic.png"
                  className="inline-flex items-center gap-1 text-[10px] font-medium transition-colors"
                  style={{ color: 'var(--accent)' }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Download
                </a>
              </div>
            </div>
          )}

          {/* PDF content */}
          {msg.type === 'pdf' && msg.pdfUrl && (
            <div className="mt-3 flex flex-col gap-2">
              {/* PDF card */}
              <div className="flex items-center gap-3 p-3 rounded-sm"
                style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
                <div className="flex-shrink-0 w-9 h-9 rounded-sm flex items-center justify-center"
                  style={{ background: 'var(--accent)' }}>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-text-primary truncate">{msg.pdfFilename ?? 'report.pdf'}</p>
                  <p className="text-[10px] text-text-tertiary font-mono">PDF Report &middot; Ready</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => onViewPdf(msg.pdfUrl!, msg.pdfFilename ?? 'report.pdf')}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm text-[11px] font-semibold text-white transition-colors cursor-pointer"
                  style={{ background: 'var(--accent)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View Report
                </button>
                <a
                  href={msg.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm text-[11px] font-semibold text-white transition-colors"
                  style={{ background: 'var(--green)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
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

/* ── Property context chip (Cursor-style) ── */
function PropertyContextChip({ property, onRemove }: { property: Property; onRemove: () => void }) {
  return (
    <div className="context-chip-enter context-chip-wrapper inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-md transition-all cursor-default"
      style={{
        background: 'rgba(6,182,212,0.08)',
        border: '1px solid rgba(6,182,212,0.25)',
      }}>
      {/* Tiny property thumbnail */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={property.image}
        alt=""
        className="w-4 h-4 rounded-sm object-cover flex-shrink-0"
      />
      <span className="text-[11px] font-medium truncate max-w-[200px]"
        style={{ color: 'var(--accent)' }}>
        {property.address}, {property.city}
      </span>
      <span className="text-[9px] font-mono opacity-60" style={{ color: 'var(--accent)' }}>
        {formatPrice(property.price)}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="flex-shrink-0 w-3.5 h-3.5 rounded-sm flex items-center justify-center transition-colors cursor-pointer hover:bg-white/10"
        aria-label="Remove context">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
          style={{ color: 'var(--accent)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ── Build context string for API ── */
function buildPropertyContext(property: Property): string {
  return `[PROPERTY CONTEXT] The user is currently viewing: ${property.address}, ${property.city}. ` +
    `Price: ${formatPrice(property.price)} | ${property.beds}bd/${property.baths}ba | ${property.sqft.toLocaleString()} sqft | ` +
    `Year Built: ${property.yearBuilt} | Type: ${property.type} | Status: ${property.status} | ` +
    `ROI: ${property.roi}% | Risk Score: ${property.riskScore}/100 | Zestimate: ${formatPrice(property.zestimate)} | ` +
    `Days on Market: ${property.daysOnMarket}. ` +
    `When the user asks questions, they are likely referring to this property unless they specify otherwise.`;
}

/* ── Main component ── */
export default function ReportChat({
  selectedProperty,
  onClearProperty,
}: {
  selectedProperty?: Property | null;
  onClearProperty?: () => void;
}) {
  const backgroundImage = selectedProperty?.image ?? null;
  const [messages,      setMessages]      = useState<Message[]>(() => loadMessages());
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [modalPdf,      setModalPdf]      = useState<{ url: string; filename: string } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

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

      // Inject property context if a property is selected
      const contextPrefix = selectedProperty ? buildPropertyContext(selectedProperty) : '';
      const enrichedMessage = contextPrefix ? `${contextPrefix}\n\nUser message: ${trimmed}` : trimmed;

      // Find the most recent PDF and schematic for potential email attachments
      const reversed = [...messages].reverse();
      const lastPdf   = reversed.find(m => m.type === 'pdf'   && m.pdfFilename);
      const lastImage = reversed.find(m => m.type === 'image' && m.imageFilename);

      const res = await fetch('/api/chat-report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message: enrichedMessage,
          history,
          lastPdfFilename:   lastPdf?.pdfFilename,
          lastImageFilename: lastImage?.imageFilename,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }

      const data = await res.json();

      const assistantMsg: Message = {
        id:            crypto.randomUUID(),
        role:          'assistant',
        content:       data.message ?? '',
        type:          data.type as MessageType,
        imageUrl:      data.imageUrl,
        imageFilename: data.imageFilename,
        pdfUrl:        data.pdfUrl,
        pdfFilename:   data.pdfFilename,
        intent:        data.intent,
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (data.type === 'pdf' && data.pdfUrl) {
        setModalPdf({ url: data.pdfUrl, filename: data.pdfFilename ?? 'report.pdf' });
      }
    } catch (err) {
      const errorMsg: Message = {
        id:      crypto.randomUUID(),
        role:    'assistant',
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        type:    'text',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [loading, messages, selectedProperty]);

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
      <div className="flex flex-col h-full relative">
        {/* Property background image — clear house photo with dark overlay */}
        {backgroundImage && (
          <div className="absolute inset-0 z-0 overflow-hidden chat-bg-transition">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={backgroundImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0.35 }}
            />
            {/* Dark gradient overlay for text readability */}
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, rgba(8,12,20,0.5) 0%, rgba(8,12,20,0.7) 40%, rgba(8,12,20,0.9) 100%)' }} />
            {/* Subtle accent glow at top */}
            <div className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.06) 0%, transparent 60%)' }} />
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 relative z-10">
          {messages.length === 0 ? (
            /* ── Empty state ── */
            <div className="flex flex-col items-center justify-center h-full gap-5 pb-8">
              <div className="text-center space-y-2">
                <div className="mx-auto w-14 h-14 rounded-sm flex items-center justify-center"
                  style={{ background: 'var(--accent)', boxShadow: '0 0 40px rgba(6,182,212,0.2)' }}>
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 4l9 5.75V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.75z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
                  </svg>
                </div>
                <h2 className="text-[16px] font-semibold text-text-primary">EstateOS Intelligence</h2>
                <p className="text-[11px] text-text-tertiary max-w-xs leading-relaxed">
                  Generate floor plan schematics, create PDF market reports, or ask any real estate question. Multimodal &mdash; all data is shared.
                </p>
              </div>

              {/* Suggestion chips */}
              <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s.label}
                    onClick={() => sendMessage(s.label)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-sm text-left transition-all cursor-pointer prop-card">
                    <span className="flex-shrink-0 font-mono text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-sm"
                      style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                      {s.icon}
                    </span>
                    <span className="text-[11px] text-text-secondary font-medium">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Message list ── */
            <>
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} onViewPdf={handleViewPdf} onExpandImage={setLightboxImage} />
              ))}
              {loading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-4 py-3 relative z-10" style={{ borderTop: '1px solid var(--border)', background: backgroundImage ? 'rgba(13,17,23,0.85)' : 'var(--bg-surface)', backdropFilter: backgroundImage ? 'blur(20px)' : undefined }}>
          {messages.length > 0 && (
            <div className="flex justify-end mb-2">
              <button
                onClick={clearChat}
                className="text-[10px] font-mono tracking-wider transition-colors cursor-pointer"
                style={{ color: 'var(--text-tertiary)' }}>
                CLEAR
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              {/* Cursor-style context chips + textarea wrapper */}
              <div className="chat-input-wrapper rounded-sm transition-colors overflow-hidden"
                style={{
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border)',
                }}>
                {/* Context chip row */}
                {selectedProperty && (
                  <div className="px-2.5 pt-2 pb-0.5 flex flex-wrap gap-1.5 items-center">
                    <PropertyContextChip
                      property={selectedProperty}
                      onRemove={onClearProperty ?? (() => {})}
                    />
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={selectedProperty
                    ? `Ask about ${selectedProperty.address}...`
                    : 'Ask about floor plans, reports, market analysis...'}
                  rows={1}
                  disabled={loading}
                  className="w-full resize-none px-3 py-2.5 pr-10 text-[12px] placeholder-text-tertiary focus:outline-none transition-colors overflow-y-auto disabled:opacity-40"
                  style={{
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    border: 'none',
                    outline: 'none',
                  }}
                />
              </div>
              <span className="absolute right-3 bottom-2.5 text-[9px] font-mono select-none" style={{ color: 'var(--text-tertiary)' }}>
                &crarr;
              </span>
            </div>

            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-9 h-9 rounded-sm flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: 'var(--accent)' }}
              aria-label="Send message">
              {loading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>

          <p className="text-center text-[9px] font-mono mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
            Shift+Enter new line &middot; Enter to send
          </p>
        </div>
      </div>

      {/* Image lightbox */}
      {lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}

      {/* PDF panel */}
      {modalPdf && (
        <ReportPdfModal
          pdfUrl={modalPdf.url}
          filename={modalPdf.filename}
          onClose={() => setModalPdf(null)}
        />
      )}
    </>
  );
}
