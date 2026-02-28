import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runPipeline } from './pipeline';

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageBase64 } = await req.json() as {
      prompt?: string;
      imageBase64?: string;
    };

    if (!prompt?.trim() && !imageBase64) {
      return NextResponse.json({ error: 'Prompt or image is required' }, { status: 400 });
    }

    const jobId = crypto.randomUUID().replace(/-/g, '').slice(0, 8);

    // Fire-and-forget: run pipeline in background
    runPipeline(jobId, prompt?.trim(), imageBase64);

    return NextResponse.json({ job_id: jobId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
