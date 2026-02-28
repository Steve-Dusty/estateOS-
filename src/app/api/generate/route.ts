import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runPipeline } from './pipeline';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json() as { prompt?: string };

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt cannot be empty' }, { status: 400 });
    }

    const jobId = crypto.randomUUID().replace(/-/g, '').slice(0, 8);

    // Fire-and-forget: run pipeline in background
    runPipeline(prompt.trim(), jobId);

    return NextResponse.json({ job_id: jobId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
