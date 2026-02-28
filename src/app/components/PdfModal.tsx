'use client';

import { useEffect } from 'react';

interface PdfModalProps {
  pdfUrl:   string;
  filename: string;
  onClose:  () => void;
}

export default function PdfModal({ pdfUrl, filename, onClose }: PdfModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    /* Centered overlay — sits above the chat panel */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col modal-enter"
        style={{
          width: '680px',
          maxWidth: '95vw',
          height: '80vh',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3.5"
          style={{ background: 'var(--accent)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[13px] font-semibold text-white truncate">{filename}</h2>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.6)' }}>EstateOS AI Report</p>
          </div>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-80"
            style={{ background: 'var(--green)' }}
            onClick={e => e.stopPropagation()}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download
          </a>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.12)' }}
            aria-label="Close"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* PDF preview */}
        <div className="flex-1 overflow-hidden" style={{ background: 'var(--bg-muted)' }}>
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0`}
            title={filename}
            className="w-full h-full border-0"
          />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-2 flex items-center justify-center"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            Press{' '}
            <kbd className="px-1 py-0.5 text-[9px] font-mono"
              style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              Esc
            </kbd>
            {' '}to close · Click outside to dismiss
          </p>
        </div>
      </div>
    </div>
  );
}
