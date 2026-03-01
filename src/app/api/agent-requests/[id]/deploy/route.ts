import { NextResponse } from 'next/server';
import { AccessToken, type VideoGrant } from 'livekit-server-sdk';
import { getRequest, updateRequest } from '@/lib/agent-requests';
import { broadcastAgentDeploy } from '@/lib/socket-server';
import { PROPERTIES } from '@/app/lib/properties';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
      return NextResponse.json(
        { error: 'LiveKit environment variables not configured' },
        { status: 500 }
      );
    }

    const request = getRequest(id);
    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (request.status !== 'pending') {
      return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
    }

    // Create a room name scoped to this request
    const roomName = `agent_${request.propertyId}_${Date.now()}`;

    // Look up full property data
    const property = PROPERTIES.find((p) => p.id === request.propertyId);

    // Generate token for the client participant with full property metadata
    const clientToken = new AccessToken(API_KEY, API_SECRET, {
      identity: request.clientId,
      name: request.clientName,
      ttl: '15m',
      metadata: JSON.stringify({
        propertyId: request.propertyId,
        propertyAddress: request.propertyAddress,
        propertyCity: request.propertyCity,
        propertyPrice: request.propertyPrice,
        propertyBeds: property?.beds,
        propertyBaths: property?.baths,
        propertySqft: property?.sqft,
        propertyType: property?.type,
        propertyYearBuilt: property?.yearBuilt,
        propertyRoi: property?.roi,
        propertyRiskScore: property?.riskScore,
        propertyZestimate: property?.zestimate,
        propertyDaysOnMarket: property?.daysOnMarket,
        propertyStatus: property?.status,
        role: 'client',
      }),
    });

    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    };
    clientToken.addGrant(grant);

    const participantToken = await clientToken.toJwt();

    // Update the request with room info
    const updated = updateRequest(id, {
      status: 'deployed',
      roomName,
      serverUrl: LIVEKIT_URL,
      participantToken,
      deployedAt: Date.now(),
    });

    // Broadcast deployment to listening clients
    broadcastAgentDeploy(updated!);

    return NextResponse.json({
      request: updated,
      connection: {
        serverUrl: LIVEKIT_URL,
        roomName,
        participantToken,
      },
    });
  } catch (error) {
    console.error('Deploy error:', error);
    return NextResponse.json({ error: 'Failed to deploy agent' }, { status: 500 });
  }
}
