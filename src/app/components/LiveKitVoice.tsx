'use client';

import { useEffect, useState } from 'react';
import { TokenSource, MediaDeviceFailure, Track } from 'livekit-client';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import {
  useSession,
  SessionProvider,
  useAgent,
  BarVisualizer,
  RoomAudioRenderer,
  VideoTrack,
  TrackToggle,
  DisconnectButton,
  useTracks,
  useLocalParticipant,
  SessionEvent,
  useEvents,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Property, formatPrice } from '../lib/properties';

interface LiveKitVoiceProps {
  property: Property;
  serverUrl: string;
  token: string;
  roomName: string;
  onDisconnect: () => void;
}

function RoomView({ property, onDisconnect }: { property: Property; onDisconnect: () => void }) {
  const agent = useAgent();
  const { localParticipant } = useLocalParticipant();

  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  );

  const localCamera = tracks.find(
    (t) =>
      t.source === Track.Source.Camera &&
      t.participant?.identity === localParticipant?.identity
  );

  const avatarVideo = tracks.find(
    (t) =>
      t.source === Track.Source.Camera &&
      t.participant?.identity !== localParticipant?.identity &&
      t.publication?.track
  );

  useEffect(() => {
    localParticipant?.setCameraEnabled(true);
  }, [localParticipant]);

  const stateColor =
    agent.state === 'speaking' ? 'var(--accent)' :
    agent.state === 'listening' ? 'var(--green)' :
    agent.state === 'thinking' ? 'var(--amber)' :
    'var(--text-tertiary)';

  return (
    <div className="flex flex-col h-full">
      {/* Property context badge */}
      <div className="px-4 py-2 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
        <div className="w-2 h-2 rounded-full" style={{
          background: stateColor,
          animation: agent.state === 'speaking' || agent.state === 'listening' ? 'soft-pulse 2s ease-in-out infinite' : 'none',
        }} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider" style={{ color: stateColor }}>
          {agent.state || 'connecting'}
        </span>
        <div className="w-px h-3" style={{ background: 'var(--border)' }} />
        <span className="text-[11px] text-text-secondary truncate">
          {property.address}, {property.city}
        </span>
        <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--green)' }}>
          {formatPrice(property.price)}
        </span>
      </div>

      {/* Video area */}
      <div className="flex-1 flex items-center justify-center p-6 gap-4">
        <div className="grid grid-cols-2 gap-4 w-full max-w-3xl">
          {/* Local camera */}
          <div className="relative aspect-video rounded-sm overflow-hidden" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
            {localCamera?.publication?.track ? (
              <VideoTrack
                trackRef={localCamera}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-[11px] text-text-tertiary">Camera off</span>
              </div>
            )}
            <span className="absolute bottom-2 left-2 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm"
              style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--text-secondary)' }}>
              You
            </span>
          </div>

          {/* Avatar / Visualizer */}
          <div className="relative aspect-video rounded-sm overflow-hidden flex items-center justify-center"
            style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
            {avatarVideo?.publication?.track ? (
              <VideoTrack
                trackRef={avatarVideo as TrackReferenceOrPlaceholder & { publication: NonNullable<TrackReferenceOrPlaceholder['publication']> }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <BarVisualizer
                state={agent.state}
                barCount={7}
                track={agent.microphoneTrack}
                style={{ width: '80%', height: '60%' }}
              />
            )}
            <span className="absolute bottom-2 left-2 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm flex items-center gap-1.5"
              style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--text-secondary)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{
                background: stateColor,
                animation: agent.state === 'speaking' || agent.state === 'listening' ? 'soft-pulse 2s ease-in-out infinite' : 'none',
              }} />
              Agent
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 flex items-center justify-center gap-3"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}
        data-lk-theme="default">
        <TrackToggle
          source={Track.Source.Microphone}
          className="px-4 py-2 rounded-sm text-[11px] font-semibold transition-all cursor-pointer"
          style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        />
        <TrackToggle
          source={Track.Source.Camera}
          className="px-4 py-2 rounded-sm text-[11px] font-semibold transition-all cursor-pointer"
          style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        />
        <DisconnectButton
          className="px-4 py-2 rounded-sm text-[11px] font-semibold transition-all cursor-pointer"
          style={{ background: 'var(--red)', color: 'white' }}
        >
          End Call
        </DisconnectButton>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

export default function LiveKitVoice({ property, serverUrl, token, roomName, onDisconnect }: LiveKitVoiceProps) {
  const tokenSource = TokenSource.custom(() => ({
    serverUrl,
    participantToken: token,
  }));

  const session = useSession(tokenSource);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    // Auto-start the session
    if (!started) {
      setStarted(true);
      session.start().catch((err) => {
        console.error('Failed to start LiveKit session:', err);
      });
    }
  }, [started, session]);

  useEffect(() => {
    if (session.connectionState === 'disconnected' && started) {
      onDisconnect();
    }
  }, [session.connectionState, started, onDisconnect]);

  useEvents(
    session,
    SessionEvent.MediaDevicesError,
    (error) => {
      const failure = MediaDeviceFailure.getFailure(error);
      console.error('Media device failure:', failure);
    },
    []
  );

  return (
    <SessionProvider session={session}>
      <RoomView property={property} onDisconnect={onDisconnect} />
    </SessionProvider>
  );
}
