import { AccessToken, type VideoGrant } from 'livekit-server-sdk';
import { getRequest, updateRequest } from './agent-requests';
import { broadcastAgentDeploy } from './socket-server';
import { PROPERTIES } from '@/app/lib/properties';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export async function deployAgentRequest(id: string) {
  if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
    throw new Error('LiveKit environment variables not configured');
  }

  const request = getRequest(id);
  if (!request) throw new Error('Request not found');
  if (request.status !== 'pending') throw new Error('Request already processed');

  const roomName = `agent_${request.propertyId}_${Date.now()}`;
  const property = PROPERTIES.find((p) => p.id === request.propertyId);

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

  const updated = updateRequest(id, {
    status: 'deployed',
    roomName,
    serverUrl: LIVEKIT_URL,
    participantToken,
    deployedAt: Date.now(),
  });

  broadcastAgentDeploy(updated!);

  return updated!;
}
