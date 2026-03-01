import { NextResponse } from "next/server";
import { AccessToken, type AccessTokenOptions, type VideoGrant } from "livekit-server-sdk";

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      throw new Error("LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set");
    }

    const body = await req.json();

    const participantIdentity =
      body.participant_identity || `user_${Math.floor(Math.random() * 10_000)}`;
    const participantName = body.participant_name || "User";
    const roomName =
      body.room_name || `room_${Math.floor(Math.random() * 10_000)}`;

    const at = new AccessToken(API_KEY, API_SECRET, {
      identity: participantIdentity,
      name: participantName,
      ttl: "15m",
    } as AccessTokenOptions);

    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    };
    at.addGrant(grant);

    // Attach property metadata if provided
    if (body.metadata) {
      at.metadata = typeof body.metadata === "string"
        ? body.metadata
        : JSON.stringify(body.metadata);
    }

    const participantToken = await at.toJwt();

    return NextResponse.json(
      { serverUrl: LIVEKIT_URL, roomName, participantName, participantToken },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Token generation error:", error);
    return new NextResponse(
      error instanceof Error ? error.message : "Internal server error",
      { status: 500 }
    );
  }
}
