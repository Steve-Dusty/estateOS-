import { NextResponse } from 'next/server';
import { createRequest, getRequests } from '@/lib/agent-requests';
import { broadcastAgentRequest } from '@/lib/socket-server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as 'pending' | 'deployed' | 'active' | 'ended' | null;
  const requests = getRequests(status ?? undefined);
  return NextResponse.json({ requests });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientId, clientName, propertyId, propertyAddress, propertyCity, propertyPrice } = body;

    if (!clientId || !propertyId || !propertyAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const request = createRequest({
      clientId,
      clientName: clientName || 'Client',
      propertyId,
      propertyAddress,
      propertyCity: propertyCity || '',
      propertyPrice: propertyPrice || 0,
    });

    // Broadcast to agent dashboard via Socket.IO
    broadcastAgentRequest(request);

    return NextResponse.json({ request });
  } catch (error) {
    console.error('Agent request error:', error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}
