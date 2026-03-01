import { NextResponse } from "next/server";
import {
  AccessToken,
  type AccessTokenOptions,
  type VideoGrant,
} from "livekit-server-sdk";
import { RoomConfiguration } from "@livekit/protocol";

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      throw new Error(
        "LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set"
      );
    }

    const body = await req.json();

    // TokenSource.endpoint sends room_config with agent dispatch info
    const roomConfig = body.room_config
      ? RoomConfiguration.fromJson(body.room_config, {
          ignoreUnknownFields: true,
        })
      : undefined;

    const participantIdentity =
      body.participant_identity ||
      `user_${Math.floor(Math.random() * 10_000)}`;
    const participantName = body.participant_name || "User";
    const roomName =
      body.room_name || `room_${Math.floor(Math.random() * 10_000)}`;

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      roomConfig
    );

    const headers = new Headers({ "Cache-Control": "no-store" });
    return NextResponse.json(
      {
        serverUrl: LIVEKIT_URL,
        roomName,
        participantName,
        participantToken,
      },
      { headers }
    );
  } catch (error) {
    console.error("Token generation error:", error);
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
    return new NextResponse("Internal server error", { status: 500 });
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  roomConfig?: RoomConfiguration
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: "15m",
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (roomConfig) {
    at.roomConfig = roomConfig;
  }

  return at.toJwt();
}
