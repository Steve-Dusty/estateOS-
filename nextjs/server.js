'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

const RESULTS_DIR = path.join(__dirname, '..', 'results');

// Pipeline constants
const HF_TOKEN   = process.env.HF_TOKEN || '';
const SPACE_BASE = 'https://tencent-hunyuanworld-mirror.hf.space';
const sleep      = ms => new Promise(r => setTimeout(r, ms));

// Ensure results dir exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Per-job state: { events: Array, clients: Set<ws>, done: boolean }
const jobs = new Map();

const MIME = {
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
};

function getJobState(jobId) {
  if (!jobs.has(jobId)) {
    jobs.set(jobId, { events: [], clients: new Set(), done: false });
  }
  return jobs.get(jobId);
}

function broadcastEvent(jobId, event) {
  const state = getJobState(jobId);
  state.events.push(event);
  state.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  });
}

// ── Gradio SSE helper ────────────────────────────────────────────────────────

async function spacePredictSSE(fnIndex, data, maxRetries = 5) {
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await sleep(Math.pow(2, attempt) * 1000);

    const sessionHash = crypto.randomUUID().replace(/-/g, '');

    // POST to join queue
    let joinRes;
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
      lastErr = e;
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
    let sseRes;
    try {
      sseRes = await fetch(
        `${SPACE_BASE}/gradio_api/queue/data?session_hash=${sessionHash}`,
        {
          headers: {
            'Accept': 'text/event-stream',
            'Authorization': `Bearer ${HF_TOKEN}`,
          },
        }
      );
    } catch (e) {
      lastErr = e;
      continue;
    }

    if (!sseRes.ok) {
      lastErr = new Error(`SSE stream failed: ${sseRes.status}`);
      continue;
    }

    // Read SSE stream
    const reader = sseRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let completed = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          let msg;
          try { msg = JSON.parse(raw); } catch (_) { continue; }

          if (msg.msg === 'process_completed') {
            reader.cancel();
            return msg.output.data;
          }
          if (msg.msg === 'unexpected_error') {
            throw new Error(`Gradio unexpected_error: ${msg.error || JSON.stringify(msg)}`);
          }
        }
      }
    } catch (e) {
      lastErr = e;
      continue;
    }

    if (!completed) {
      lastErr = new Error(`SSE stream ended without process_completed (fn_index ${fnIndex})`);
    }
  }
  throw lastErr || new Error(`spacePredictSSE failed after ${maxRetries} attempts`);
}

// ── Main pipeline ────────────────────────────────────────────────────────────

async function runPipeline(prompt, jobId) {
  broadcastEvent(jobId, { type: 'info', message: `Job ${jobId} started` });

  const jobDir = path.join(RESULTS_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  // ── Step 1: Text → Panorama ────────────────────────────────────────────────
  broadcastEvent(jobId, { type: 'stage', stage: 'panorama', status: 'running' });

  const panoramaPrompt =
    prompt + ', equirectangular panorama, 360 degree view, high quality, detailed';

  const hfRes = await fetch(
    'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: panoramaPrompt,
        parameters: { width: 2048, height: 1024 },
      }),
    }
  );

  if (!hfRes.ok) {
    const errText = await hfRes.text().catch(() => hfRes.status.toString());
    throw new Error(`HF Inference API error ${hfRes.status}: ${errText}`);
  }

  const panoramaBuffer = Buffer.from(await hfRes.arrayBuffer());
  const panoramaPath = path.join(jobDir, 'panorama.png');
  fs.writeFileSync(panoramaPath, panoramaBuffer);

  const panoramaUrl = `/results/${jobId}/panorama.png`;
  broadcastEvent(jobId, { type: 'stage_done', stage: 'panorama', panorama_url: panoramaUrl });

  // ── Step 2: Upload panorama to Gradio Space ────────────────────────────────
  broadcastEvent(jobId, { type: 'stage', stage: 'world', status: 'running', message: 'Uploading panorama…' });

  const formData = new FormData();
  const blob = new Blob([panoramaBuffer], { type: 'image/png' });
  formData.append('files', blob, 'panorama.png');

  const uploadRes = await fetch(`${SPACE_BASE}/gradio_api/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${HF_TOKEN}` },
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(`Gradio upload failed: ${uploadRes.status}`);
  }

  const uploadedPaths = await uploadRes.json();
  const remotePath = uploadedPaths[0];

  const fileData = {
    path: remotePath,
    url: `${SPACE_BASE}/gradio_api/file=${remotePath}`,
    orig_name: 'panorama.png',
    mime_type: 'image/png',
    is_stream: false,
    meta: { _type: 'gradio.FileData' },
  };

  // ── Step 3a: Process upload (fn_index 14) ─────────────────────────────────
  broadcastEvent(jobId, { type: 'log', stage: 'world', message: 'Processing image upload…' });

  const processOut = await spacePredictSSE(14, [[fileData], 1.0]);
  const workspacePath = processOut[0];

  broadcastEvent(jobId, { type: 'log', stage: 'world', message: `Workspace ready: ${workspacePath}` });

  // ── Step 3b: 3D reconstruction (fn_index 5) ───────────────────────────────
  broadcastEvent(jobId, { type: 'log', stage: 'world', message: 'Running 3D reconstruction (ZeroGPU, ~60–120 s)…' });

  const reconOut = await spacePredictSSE(5, [workspacePath, 'All', false, true, true, false]);

  let glbUrl;
  const glbInfo = reconOut[0];
  if (glbInfo && glbInfo.url) {
    glbUrl = glbInfo.url;
  } else if (glbInfo && glbInfo.path) {
    glbUrl = `${SPACE_BASE}/gradio_api/file=${glbInfo.path}`;
  } else {
    throw new Error(`Unexpected 3D reconstruction output: ${JSON.stringify(reconOut)}`);
  }

  // ── Step 4: Download GLB ───────────────────────────────────────────────────
  broadcastEvent(jobId, { type: 'log', stage: 'world', message: 'Downloading GLB…' });

  const glbRes = await fetch(glbUrl, {
    headers: { 'Authorization': `Bearer ${HF_TOKEN}` },
  });

  if (!glbRes.ok) {
    throw new Error(`Failed to download GLB: ${glbRes.status}`);
  }

  const glbBuffer = Buffer.from(await glbRes.arrayBuffer());
  const glbFilePath = path.join(jobDir, 'world.glb');
  fs.writeFileSync(glbFilePath, glbBuffer);

  const modelUrl = `/results/${jobId}/world.glb`;

  broadcastEvent(jobId, {
    type: 'done',
    job_id: jobId,
    panorama_url: panoramaUrl,
    model_url: modelUrl,
    scene_class: 'interior',
  });
}

// ── HTTP + WS Server ─────────────────────────────────────────────────────────

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost`);
    const pathname = parsedUrl.pathname;

    // ── POST /generate ──────────────────────────────────────────────────
    if (req.method === 'POST' && pathname === '/generate') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const { prompt } = JSON.parse(body);
          if (!prompt || !prompt.trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Prompt cannot be empty' }));
            return;
          }
          const jobId = uuidv4().replace(/-/g, '').slice(0, 8);

          runPipeline(prompt.trim(), jobId).catch(err => {
            broadcastEvent(jobId, { type: 'error', message: err.message });
          }).finally(() => {
            const state = getJobState(jobId);
            state.done = true;
            state.clients.forEach(ws => {
              if (ws.readyState === WebSocket.OPEN) ws.close();
            });
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ job_id: jobId }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // ── GET /results/* ──────────────────────────────────────────────────
    if (req.method === 'GET' && pathname.startsWith('/results/')) {
      const relPath = decodeURIComponent(pathname.slice('/results/'.length));
      const filePath = path.resolve(RESULTS_DIR, relPath);
      if (!filePath.startsWith(RESULTS_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME[ext] || 'application/octet-stream';
      fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stat.size,
          'Cache-Control': 'no-cache',
        });
        fs.createReadStream(filePath).pipe(res);
      });
      return;
    }

    // ── All other → Next.js ─────────────────────────────────────────────
    handle(req, res);
  });

  // ── WebSocket server ────────────────────────────────────────────────────────
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const wsUrl = new URL(req.url, `http://localhost`);
    const match = wsUrl.pathname.match(/^\/ws\/([^/]+)$/);
    if (!match) {
      socket.destroy();
      return;
    }
    const jobId = match[1];
    wss.handleUpgrade(req, socket, head, (ws) => {
      const state = getJobState(jobId);
      for (const event of state.events) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(event));
        }
      }
      if (state.done) {
        ws.close();
        return;
      }
      state.clients.add(ws);
      ws.on('close', () => state.clients.delete(ws));
      ws.on('error', () => state.clients.delete(ws));
    });
  });

  const PORT = parseInt(process.env.PORT || '3000', 10);
  server.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
