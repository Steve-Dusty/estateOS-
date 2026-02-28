import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { broadcastEvent, getJob } from './jobs';

const HF_TOKEN = process.env.HF_TOKEN || '';
const SPACE_BASE = 'https://tencent-hunyuanworld-mirror.hf.space';
const RESULTS_DIR = path.join(process.cwd(), 'public', 'generated');

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/* ── Gradio SSE helper ─────────────────────────────────────────────── */

async function spacePredictSSE(fnIndex: number, data: unknown[], maxRetries = 5): Promise<unknown[]> {
  let lastErr: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await sleep(Math.pow(2, attempt) * 1000);

    const sessionHash = crypto.randomUUID().replace(/-/g, '');

    // POST to join queue
    let joinRes: Response;
    try {
      joinRes = await fetch(`${SPACE_BASE}/gradio_api/queue/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HF_TOKEN}`,
        },
        body: JSON.stringify({ fn_index: fnIndex, data, session_hash: sessionHash, event_data: null }),
      });
    } catch (e) {
      lastErr = e as Error;
      continue;
    }

    if (joinRes.status === 500) {
      lastErr = new Error(`Queue join returned 500 for fn_index ${fnIndex}`);
      continue;
    }
    if (!joinRes.ok) {
      lastErr = new Error(`Queue join failed: ${joinRes.status}`);
      continue;
    }

    // GET SSE stream
    let sseRes: Response;
    try {
      sseRes = await fetch(
        `${SPACE_BASE}/gradio_api/queue/data?session_hash=${sessionHash}`,
        { headers: { 'Accept': 'text/event-stream', 'Authorization': `Bearer ${HF_TOKEN}` } },
      );
    } catch (e) {
      lastErr = e as Error;
      continue;
    }

    if (!sseRes.ok) {
      lastErr = new Error(`SSE stream failed: ${sseRes.status}`);
      continue;
    }

    // Read SSE stream
    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          let msg: { msg: string; output?: { data: unknown[] }; error?: string };
          try { msg = JSON.parse(raw); } catch { continue; }

          if (msg.msg === 'process_completed') {
            reader.cancel();
            return msg.output!.data;
          }
          if (msg.msg === 'unexpected_error') {
            throw new Error(`Gradio unexpected_error: ${msg.error || JSON.stringify(msg)}`);
          }
        }
      }
    } catch (e) {
      lastErr = e as Error;
      continue;
    }

    lastErr = new Error(`SSE stream ended without process_completed (fn_index ${fnIndex})`);
  }
  throw lastErr || new Error(`spacePredictSSE failed after ${maxRetries} attempts`);
}

/* ── Main pipeline ─────────────────────────────────────────────────── */

export async function runPipeline(imageBase64: string, jobId: string) {
  broadcastEvent(jobId, { type: 'info', message: `Job ${jobId} started` });

  const jobDir = path.join(RESULTS_DIR, jobId);
  await mkdir(jobDir, { recursive: true });

  try {
    // ── Step 1: Decode base64 image ─────────────────────────────────
    broadcastEvent(jobId, { type: 'stage', stage: 'upload', status: 'running' });
    broadcastEvent(jobId, { type: 'log', stage: 'upload', message: 'Processing uploaded image…' });

    // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const imagePath = path.join(jobDir, 'input.png');
    await writeFile(imagePath, imageBuffer);

    const imageUrl = `/generated/${jobId}/input.png`;
    broadcastEvent(jobId, { type: 'log', stage: 'upload', message: 'Image ready' });
    broadcastEvent(jobId, { type: 'stage_done', stage: 'upload', panorama_url: imageUrl });

    // ── Step 2: Upload image to Gradio Space ────────────────────────
    broadcastEvent(jobId, { type: 'stage', stage: 'world', status: 'running' });
    broadcastEvent(jobId, { type: 'log', stage: 'world', message: 'Uploading image to HunyuanWorld…' });

    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('files', blob, 'input.png');

    const uploadRes = await fetch(`${SPACE_BASE}/gradio_api/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${HF_TOKEN}` },
      body: formData,
    });

    if (!uploadRes.ok) {
      throw new Error(`Gradio upload failed: ${uploadRes.status}`);
    }

    const uploadedPaths = await uploadRes.json() as string[];
    const remotePath = uploadedPaths[0];

    const fileData = {
      path: remotePath,
      url: `${SPACE_BASE}/gradio_api/file=${remotePath}`,
      orig_name: 'input.png',
      mime_type: 'image/png',
      is_stream: false,
      meta: { _type: 'gradio.FileData' },
    };

    // ── Step 3a: Process upload (fn_index 14) ───────────────────────
    broadcastEvent(jobId, { type: 'log', stage: 'world', message: 'Processing image upload…' });

    const processOut = await spacePredictSSE(14, [[fileData], 1.0]) as [string];
    const workspacePath = processOut[0];

    broadcastEvent(jobId, { type: 'log', stage: 'world', message: `Workspace ready: ${workspacePath}` });

    // ── Step 3b: 3D reconstruction (fn_index 5) ─────────────────────
    broadcastEvent(jobId, { type: 'log', stage: 'world', message: 'Running 3D reconstruction (ZeroGPU, ~60–120s)…' });

    const reconOut = await spacePredictSSE(5, [workspacePath, 'All', false, true, true, false]) as [{ url?: string; path?: string }];

    let glbUrl: string;
    const glbInfo = reconOut[0];
    if (glbInfo && glbInfo.url) {
      glbUrl = glbInfo.url;
    } else if (glbInfo && glbInfo.path) {
      glbUrl = `${SPACE_BASE}/gradio_api/file=${glbInfo.path}`;
    } else {
      throw new Error(`Unexpected 3D reconstruction output: ${JSON.stringify(reconOut)}`);
    }

    // ── Step 4: Download GLB ────────────────────────────────────────
    broadcastEvent(jobId, { type: 'log', stage: 'world', message: 'Downloading GLB model…' });

    const glbRes = await fetch(glbUrl, {
      headers: { 'Authorization': `Bearer ${HF_TOKEN}` },
    });

    if (!glbRes.ok) {
      throw new Error(`Failed to download GLB: ${glbRes.status}`);
    }

    const glbBuffer = Buffer.from(await glbRes.arrayBuffer());
    const glbFilePath = path.join(jobDir, 'world.glb');
    await writeFile(glbFilePath, glbBuffer);

    const modelUrl = `/generated/${jobId}/world.glb`;

    broadcastEvent(jobId, { type: 'log', stage: 'world', message: '3D world ready!' });
    broadcastEvent(jobId, {
      type: 'done',
      job_id: jobId,
      panorama_url: imageUrl,
      model_url: modelUrl,
      scene_class: 'interior',
    });
  } catch (err) {
    broadcastEvent(jobId, { type: 'error', message: (err as Error).message });
  } finally {
    const state = getJob(jobId);
    state.done = true;
  }
}
