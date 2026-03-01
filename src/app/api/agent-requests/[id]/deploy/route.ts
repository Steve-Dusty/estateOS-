import { NextResponse } from 'next/server';
import { deployAgentRequest } from '@/lib/deploy-agent';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updated = await deployAgentRequest(id);
    return NextResponse.json({ request: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deploy agent';
    const status = message === 'Request not found' ? 404
      : message === 'Request already processed' ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
