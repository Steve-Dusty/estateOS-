import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const RESULTS_DIR = path.join(process.cwd(), 'public', 'generated');

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageBase64 } = await req.json() as {
      prompt?: string;
      imageBase64?: string;
    };

    if (!prompt?.trim() && !imageBase64) {
      return NextResponse.json({ error: 'Prompt or image is required' }, { status: 400 });
    }

    const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const jobDir = path.join(RESULTS_DIR, jobId);
    await mkdir(jobDir, { recursive: true });

    const veoPrompt = prompt?.trim() || 'Cinematic real estate advertisement video of this property';

    let operation;

    if (imageBase64) {
      // Image input mode: use Veo with image
      let mimeType = 'image/jpeg';
      let rawBase64 = imageBase64;
      if (imageBase64.includes(',')) {
        const header = imageBase64.split(',')[0];
        const mimeMatch = header.match(/data:(.*?);/);
        if (mimeMatch) mimeType = mimeMatch[1];
        rawBase64 = imageBase64.split(',')[1];
      }

      operation = await ai.models.generateVideos({
        model: 'veo-3.0-generate-001',
        prompt: veoPrompt,
        image: {
          imageBytes: rawBase64,
          mimeType,
        },
        config: {
          aspectRatio: '16:9',
          numberOfVideos: 1,
        },
      });
    } else {
      // Text-only mode
      operation = await ai.models.generateVideos({
        model: 'veo-3.0-generate-001',
        prompt: veoPrompt,
        config: {
          aspectRatio: '16:9',
          numberOfVideos: 1,
        },
      });
    }

    // Poll for completion
    while (!operation.done) {
      await new Promise(r => setTimeout(r, 5000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    const video = operation.response?.generatedVideos?.[0]?.video;
    if (!video) {
      return NextResponse.json({ error: 'No video generated' }, { status: 500 });
    }

    // Download video
    const videoPath = path.join(jobDir, 'video.mp4');
    await ai.files.download({ file: video, downloadPath: videoPath });

    return NextResponse.json({
      videoUrl: `/generated/${jobId}/video.mp4`,
      jobId,
    });
  } catch (e) {
    console.error('Veo error:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
