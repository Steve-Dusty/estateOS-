import { NextResponse } from 'next/server';
import { buildFullGraph, getGraphStats } from '@/lib/graph-builder';

export async function GET() {
  try {
    const graph = buildFullGraph();
    const stats = getGraphStats();
    return NextResponse.json({ graph, stats });
  } catch (err) {
    console.error('[api/graph] Error:', err);
    return NextResponse.json({ error: 'Failed to build graph' }, { status: 500 });
  }
}
