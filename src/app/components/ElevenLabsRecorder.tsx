'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

const CHUNK_INTERVAL_MS = 20_000;

interface Props {
  onTranscript?: (text: string) => void;
}

export default function ElevenLabsRecorder({ onTranscript }: Props) {
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendChunk = useCallback(async () => {
    if (chunksRef.current.length === 0) return;

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];

    if (blob.size < 1000) return;

    setSending(true);
    try {
      // 1. Transcribe (no diarization — Gemini entity extractor handles names)
      const form = new FormData();
      form.append('audio', blob, 'audio.webm');

      const transcribeRes = await fetch('/api/transcribe', { method: 'POST', body: form });
      if (!transcribeRes.ok) return;

      const { transcript } = await transcribeRes.json();
      if (!transcript || transcript.trim().length === 0) return;

      onTranscript?.(transcript);

      // 2. Ingest single turn — Gemini extracts persons/topics/relationships
      await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'elevenlabs',
          turns: [{ role: 'user', content: transcript }],
        }),
      });
    } catch (err) {
      console.error('[ElevenLabsRecorder] Error:', err);
    } finally {
      setSending(false);
    }
  }, [onTranscript]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(1000);
      setRecording(true);

      intervalRef.current = setInterval(() => {
        sendChunk();
      }, CHUNK_INTERVAL_MS);
    } catch (err) {
      console.error('[ElevenLabsRecorder] Mic access denied:', err);
    }
  }, [sendChunk]);

  const stopRecording = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    sendChunk();
    mediaRecorderRef.current = null;
    setRecording(false);
  }, [sendChunk]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggle = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors"
      style={{
        background: recording ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${recording ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      {recording ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="2" x2="22" y1="2" y2="22" />
          <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
          <path d="M5 10v2a7 7 0 0 0 12 5.29" />
          <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      )}

      {recording && (
        <span
          className="w-[5px] h-[5px] rounded-full"
          style={{
            background: sending ? '#f59e0b' : '#ef4444',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      )}

      <span
        className="text-[10px] font-mono font-semibold tracking-wider"
        style={{ color: recording ? '#8b5cf6' : '#64748b' }}
      >
        {recording ? 'ELEVENLABS' : 'MIC'}
      </span>
    </button>
  );
}
