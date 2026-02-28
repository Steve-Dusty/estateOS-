import { NextRequest, NextResponse } from 'next/server';
import { Odyssey } from '@odysseyml/odyssey';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const RESULTS_DIR = path.join(process.cwd(), 'public', 'generated');

export async function POST(req: NextRequest) {
  try {
    const { prompt, portrait } = await req.json() as {
      prompt?: string;
      portrait?: boolean;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt cannot be empty' }, { status: 400 });
    }

    if (!process.env.ODYSSEY_API_KEY) {
      return NextResponse.json({ error: 'ODYSSEY_API_KEY not configured' }, { status: 500 });
    }

    const client = new Odyssey({ apiKey: process.env.ODYSSEY_API_KEY });

    const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const jobDir = path.join(RESULTS_DIR, jobId);
    await mkdir(jobDir, { recursive: true });

    // Create simulation
    const job = await client.simulate({
      script: [
        { timestamp_ms: 0, start: { prompt: prompt.trim() } },
        { timestamp_ms: 8000, end: {} },
      ],
      portrait: portrait || false,
    });

    // Poll for completion
    let status: Awaited<ReturnType<typeof client.getSimulateStatus>>;
    while (true) {
      await new Promise(r => setTimeout(r, 5000));
      status = await client.getSimulateStatus(job.job_id);
      if (status.status === 'completed') break;
      if (status.status === 'failed') {
        return NextResponse.json({ error: `Simulation failed: ${status.error_message}` }, { status: 500 });
      }
      if (status.status === 'cancelled') {
        return NextResponse.json({ error: 'Simulation cancelled' }, { status: 500 });
      }
    }

    // Get recordings
    if (!status.streams?.length) {
      return NextResponse.json({ error: 'No streams returned' }, { status: 500 });
    }

    const recording = await client.getRecording(status.streams[0].stream_id);

    // Download the video locally
    const videoRes = await fetch(recording.video_url!);
    if (!videoRes.ok) {
      return NextResponse.json({ error: 'Failed to download video' }, { status: 500 });
    }

    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    const videoPath = path.join(jobDir, 'odyssey.mp4');
    await writeFile(videoPath, videoBuffer);

    return NextResponse.json({
      videoUrl: `/generated/${jobId}/odyssey.mp4`,
      jobId,
    });
  } catch (e) {
    console.error('Odyssey error:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
