"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import PdfModal from "./PdfModal";

// ── Types ──────────────────────────────────────────────────────────────────
export type MessageType = "text" | "image" | "pdf";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: MessageType;
  imageUrl?: string;
  pdfUrl?: string;
  pdfFilename?: string;
  intent?: string;
}

const STORAGE_KEY  = "realestate_chat_history";

// ── Session-scoped chat persistence ──────────────────────────────────────
// Uses sessionStorage: survives in-tab navigation, clears when tab is closed.
function saveMessages(msgs: Message[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch {
    // Quota exceeded (likely large base64 images) — retry without image data
    try {
      const stripped = msgs.map(m =>
        m.type === "image" ? { ...m, imageUrl: undefined } : m
      );
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
    } catch {
      // Give up silently — chat still works, just not persisted this time
    }
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

// ── Suggestion chips shown on empty state ──────────────────────────────────
const SUGGESTIONS = [
  { label: "Floor plan for 3-bed house", icon: "🏠" },
  { label: "Market analysis report for Austin, TX", icon: "📊" },
  { label: "Schematic of open-plan office space", icon: "🏢" },
  { label: "Investment report for 5-unit apartment", icon: "📄" },
];

// ── Intent badge colours ───────────────────────────────────────────────────
const intentBadge: Record<string, { label: string; className: string }> = {
  schematic:  { label: "Floor Plan",   className: "bg-purple-100 text-purple-700" },
  pdf_report: { label: "PDF Report",   className: "bg-blue-100   text-blue-700"   },
  chat:       { label: "Chat",         className: "bg-gray-100   text-gray-600"   },
};

// ── Typing indicator ──────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 message-enter">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
        AI
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5 h-5">
          <span className="w-2 h-2 rounded-full bg-blue-400 typing-dot" />
          <span className="w-2 h-2 rounded-full bg-blue-400 typing-dot" />
          <span className="w-2 h-2 rounded-full bg-blue-400 typing-dot" />
        </div>
      </div>
    </div>
  );
}

// ── Image lightbox ────────────────────────────────────────────────────────
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="lightbox-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 cursor-zoom-out"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Schematic full view"
        className="lightbox-image max-w-full max-h-full object-contain rounded-xl shadow-2xl cursor-default"
        onClick={e => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Single message bubble ─────────────────────────────────────────────────
function MessageBubble({
  msg,
  onViewPdf,
  onExpandImage,
}: {
  msg: Message;
  onViewPdf: (url: string, filename: string) => void;
  onExpandImage: (src: string) => void;
}) {
  const isUser = msg.role === "user";
  const badge  = msg.intent ? intentBadge[msg.intent] : null;

  return (
    <div className={`flex items-end gap-3 message-enter ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
          ${isUser ? "bg-gray-200 text-gray-700" : "bg-blue-600 text-white"}`}
      >
        {isUser ? "You" : "AI"}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {/* Intent badge */}
        {badge && !isUser && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.className} self-start`}>
            {badge.label}
          </span>
        )}

        <div
          className={`rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed
            ${isUser
              ? "bg-blue-600 text-white rounded-br-none"
              : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"
            }`}
        >
          {/* Text content */}
          {(msg.type === "text" || msg.type === "pdf") && (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          )}

          {/* Image content */}
          {msg.type === "image" && msg.imageUrl && (
            <div className="flex flex-col gap-2">
              {msg.content && <p className="whitespace-pre-wrap mb-2">{msg.content}</p>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={msg.imageUrl}
                alt="Generated schematic"
                onClick={() => onExpandImage(msg.imageUrl!)}
                className="rounded-xl max-w-full w-auto max-h-[400px] object-contain border border-gray-100 cursor-zoom-in hover:opacity-90 transition-opacity"
              />
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => onExpandImage(msg.imageUrl!)}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 8v6M8 11h6" />
                  </svg>
                  Click image to enlarge
                </button>
                <span className="text-gray-200">·</span>
                <a
                  href={msg.imageUrl}
                  download="schematic.png"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Download
                </a>
              </div>
            </div>
          )}

          {/* PDF content */}
          {msg.type === "pdf" && msg.pdfUrl && (
            <div className="mt-3 flex flex-col gap-2">
              {/* PDF card */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{msg.pdfFilename ?? "report.pdf"}</p>
                  <p className="text-xs text-gray-500">PDF Report · Ready to view</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => onViewPdf(msg.pdfUrl!, msg.pdfFilename ?? "report.pdf")}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                >
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
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Download PDF
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function ChatGenerator() {
  const [messages,      setMessages]      = useState<Message[]>(() => loadMessages());
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [modalPdf,      setModalPdf]      = useState<{ url: string; filename: string } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  // Persist messages to sessionStorage whenever they change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  const handleViewPdf = useCallback((url: string, filename: string) => {
    setModalPdf({ url, filename });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id:      crypto.randomUUID(),
      role:    "user",
      content: trimmed,
      type:    "text",
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Build history for the API (excluding the just-added user message)
      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat-report', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }

      const data = await res.json();

      const assistantMsg: Message = {
        id:          crypto.randomUUID(),
        role:        "assistant",
        content:     data.message ?? "",
        type:        data.type as MessageType,
        imageUrl:    data.imageUrl,
        pdfUrl:      data.pdfUrl,
        pdfFilename: data.pdfFilename,
        intent:      data.intent,
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Auto-open modal for PDF responses
      if (data.type === "pdf" && data.pdfUrl) {
        setModalPdf({ url: data.pdfUrl, filename: data.pdfFilename ?? "report.pdf" });
      }
    } catch (err) {
      const errorMsg: Message = {
        id:      crypto.randomUUID(),
        role:    "assistant",
        content: `Sorry, something went wrong: ${err instanceof Error ? err.message : String(err)}`,
        type:    "text",
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0 ? (
            /* ── Empty state ── */
            <div className="flex flex-col items-center justify-center h-full gap-6 pb-8">
              <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 4l9 5.75V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.75z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800">RealEstate AI Agent</h2>
                <p className="text-sm text-gray-500 max-w-xs">
                  Ask me to generate floor plan schematics, create PDF market reports, or answer any real estate questions.
                </p>
              </div>

              {/* Suggestion chips */}
              <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s.label}
                    onClick={() => sendMessage(s.label)}
                    className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left shadow-sm"
                  >
                    <span className="text-base">{s.icon}</span>
                    <span className="text-xs font-medium">{s.label}</span>
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
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-4">
          {messages.length > 0 && (
            <div className="flex justify-end mb-2">
              <button
                onClick={clearChat}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear chat
              </button>
            </div>
          )}

          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about floor plans, property reports, market analysis…"
                rows={1}
                disabled={loading}
                className="w-full resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 pr-12 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 transition-colors overflow-y-auto"
              />
              {/* Char hint */}
              <p className="absolute right-3 bottom-2.5 text-[10px] text-gray-300 select-none">
                ⏎ send
              </p>
            </div>

            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shadow-sm"
              aria-label="Send message"
            >
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

          <p className="text-center text-[11px] text-gray-400 mt-2">
            Shift+Enter for new line · Enter to send
          </p>
        </div>
      </div>

      {/* Image lightbox */}
      {lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}

      {/* PDF panel */}
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
