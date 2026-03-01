import { NextResponse } from 'next/server';
import { getRequest, updateRequest } from '@/lib/agent-requests';
import { broadcastAgentEnd } from '@/lib/socket-server';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const request = getRequest(id);
  if (!request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  const updated = updateRequest(id, { status: 'ended' });
  broadcastAgentEnd(updated!);

  return NextResponse.json({ request: updated });
}
