"use client";

import { useEffect } from "react";

interface PdfModalProps {
  pdfUrl:   string;
  filename: string;
  onClose:  () => void;
}

export default function PdfModal({ pdfUrl, filename, onClose }: PdfModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    /* Right-side panel — does NOT block the chat on the left */
    <div className="fixed right-0 top-0 h-full w-[480px] max-w-full z-40 flex flex-col bg-white border-l border-gray-200 shadow-[-8px_0_32px_rgba(0,0,0,0.15)] pdf-panel-enter">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-blue-700 to-blue-600">
        <div className="flex-shrink-0 w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white truncate">{filename}</h2>
          <p className="text-xs text-blue-200">Real Estate AI Report</p>
        </div>

        <button
          onClick={onClose}
          className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
          aria-label="Close panel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Download CTA bar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 py-3 bg-blue-50 border-b border-blue-100">
        <div className="flex items-center gap-2 text-xs text-blue-800 font-medium">
          <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Report ready
        </div>

        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 active:scale-95 text-white text-sm font-bold rounded-xl shadow-md transition-all select-none"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download PDF
        </a>
      </div>

      {/* ── PDF Preview ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden bg-gray-100">
        <iframe
          src={`${pdfUrl}#toolbar=0&navpanes=0`}
          title={filename}
          className="w-full h-full border-0"
        />
      </div>

      {/* ── Footer hint ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-2.5 border-t border-gray-200 bg-white">
        <p className="text-[11px] text-gray-400 text-center">
          Press <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-600 text-[10px] font-mono">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
