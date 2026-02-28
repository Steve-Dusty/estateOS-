'use client';

import { useEffect } from 'react';

interface ReportPdfModalProps {
  pdfUrl:   string;
  filename: string;
  onClose:  () => void;
}

export default function ReportPdfModal({ pdfUrl, filename, onClose }: ReportPdfModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed right-0 top-0 h-full w-[480px] max-w-full z-40 flex flex-col report-panel-enter"
      style={{
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.5), 0 0 60px rgba(6,182,212,0.05)',
      }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4"
        style={{ background: 'var(--accent)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex-shrink-0 w-9 h-9 rounded-sm flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.15)' }}>
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-[13px] font-semibold text-white truncate">{filename}</h2>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.6)' }}>EstateOS Intelligence Report</p>
        </div>

        <button
          onClick={onClose}
          className="flex-shrink-0 w-7 h-7 rounded-sm flex items-center justify-center transition-colors cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.1)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          aria-label="Close panel">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Download bar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 py-3"
        style={{ background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 text-[11px] font-medium" style={{ color: 'var(--green)' }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Report generated
        </div>

        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-white rounded-sm transition-all"
          style={{ background: 'var(--green)' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download
        </a>
      </div>

      {/* PDF preview */}
      <div className="flex-1 overflow-hidden" style={{ background: 'var(--bg-body)' }}>
        <iframe
          src={`${pdfUrl}#toolbar=0&navpanes=0`}
          title={filename}
          className="w-full h-full border-0"
        />
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-5 py-2 text-center"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <p className="text-[10px] text-text-tertiary">
          Press <kbd className="px-1 py-0.5 rounded-sm font-mono text-[9px]"
            style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
