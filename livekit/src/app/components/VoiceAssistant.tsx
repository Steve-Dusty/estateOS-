"use client";

import { useEffect, useState } from "react";
import { TokenSource, MediaDeviceFailure, Track } from "livekit-client";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
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
} from "@livekit/components-react";
import "@livekit/components-styles";

const tokenSource = TokenSource.endpoint("/api/token");

function RoomView() {
  const agent = useAgent();
  const { localParticipant } = useLocalParticipant();

  // Get all video + camera tracks in the room
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
    ],
    { onlySubscribed: false }
  );

  const localCamera = tracks.find(
    (t) =>
      t.source === Track.Source.Camera &&
      t.participant?.identity === localParticipant?.identity
  );

  // Avatar publishes a video track — find it by looking for remote camera tracks
  // The avatar participant identity is "hedra-avatar-agent"
  const avatarVideo = tracks.find(
    (t) =>
      t.source === Track.Source.Camera &&
      t.participant?.identity !== localParticipant?.identity &&
      t.publication?.track
  );

  useEffect(() => {
    if (agent.state === "failed") {
      alert(`Agent error: ${agent.failureReasons?.join(", ")}`);
    }
  }, [agent.state, agent.failureReasons]);

  // Enable camera on mount
  useEffect(() => {
    localParticipant?.setCameraEnabled(true);
  }, [localParticipant]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-4xl">
      <div className="grid grid-cols-2 gap-4 w-full">
        {/* Local camera */}
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-zinc-900 border border-white/[0.06]">
          {localCamera?.publication?.track ? (
            <VideoTrack
              trackRef={localCamera}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
              Camera off
            </div>
          )}
          <span className="absolute bottom-2 left-2 text-xs font-mono bg-black/60 text-zinc-300 px-2 py-1 rounded">
            You
          </span>
        </div>

        {/* Avatar video / fallback to audio visualizer */}
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-zinc-900 border border-white/[0.06] flex items-center justify-center">
          {avatarVideo?.publication?.track ? (
            <VideoTrack
              trackRef={avatarVideo as TrackReferenceOrPlaceholder & { publication: NonNullable<TrackReferenceOrPlaceholder["publication"]> }}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <BarVisualizer
              state={agent.state}
              barCount={7}
              track={agent.microphoneTrack}
              style={{ width: "80%", height: "60%" }}
            />
          )}
          <span className="absolute bottom-2 left-2 text-xs font-mono bg-black/60 text-zinc-300 px-2 py-1 rounded flex items-center gap-2">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                agent.state === "speaking"
                  ? "bg-cyan-400 animate-pulse"
                  : agent.state === "listening"
                    ? "bg-green-400 animate-pulse"
                    : agent.state === "thinking"
                      ? "bg-amber-400 animate-pulse"
                      : "bg-zinc-600"
              }`}
            />
            Agent · {agent.state}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3" data-lk-theme="default">
        <TrackToggle
          source={Track.Source.Microphone}
          className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-sm transition-colors cursor-pointer"
        />
        <TrackToggle
          source={Track.Source.Camera}
          className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-sm transition-colors cursor-pointer"
        />
        <DisconnectButton className="px-4 py-2 rounded-full bg-red-500/80 hover:bg-red-500 text-white text-sm transition-colors cursor-pointer">
          Leave
        </DisconnectButton>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

export default function VoiceAssistant() {
  const session = useSession(tokenSource);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (started) {
      session.start().catch((err) => {
        console.error("Failed to start session:", err);
      });
    } else {
      session.end().catch((err) => {
        console.error("Failed to end session:", err);
      });
    }
  }, [started, session.start, session.end]);

  useEffect(() => {
    if (session.connectionState === "disconnected") {
      setStarted(false);
    }
  }, [session.connectionState]);

  useEvents(
    session,
    SessionEvent.MediaDevicesError,
    (error) => {
      const failure = MediaDeviceFailure.getFailure(error);
      console.error("Media device failure:", failure);
      alert(
        "Error acquiring camera/microphone permissions. Please grant permissions and reload."
      );
    },
    []
  );

  return (
    <SessionProvider session={session}>
      <div className="flex flex-col items-center gap-6 w-full px-8">
        {started ? (
          <RoomView />
        ) : (
          <button
            className="px-8 py-3 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-sm tracking-wide transition-colors cursor-pointer"
            onClick={() => setStarted(true)}
          >
            Connect
          </button>
        )}
      </div>
    </SessionProvider>
  );
}
