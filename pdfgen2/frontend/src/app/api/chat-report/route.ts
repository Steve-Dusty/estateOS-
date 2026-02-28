import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildPdf } from '@/lib/pdf-builder';

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const OPENAI_MODEL        = process.env.OPENAI_MODEL        ?? 'gpt-4o-mini';
const IMAGEN_MODEL        = process.env.IMAGEN_MODEL        ?? 'imagen-4.0-fast-generate-001';
const GEMINI_IMAGE_MODEL  = process.env.GEMINI_IMAGE_MODEL  ?? 'gemini-2.0-flash-exp-image-generation';
const GENERATED_ASSETS_URL = process.env.GENERATED_ASSETS_URL ?? '/generated';

const _BASE          = 'https://generativelanguage.googleapis.com/v1beta/models';
const IMAGEN_URL     = `${_BASE}/${IMAGEN_MODEL}:predict?key=${process.env.GOOGLE_API_KEY}`;
const GEMINI_IMG_URL = `${_BASE}/${GEMINI_IMAGE_MODEL}:generateContent?key=${process.env.GOOGLE_API_KEY}`;

interface HistoryItem {
  role: string;
  content: string;
}

// ── Intent classification ────────────────────────────────────────────────────

const INTENT_SYSTEM = `You are an intent classifier for a real estate AI assistant.

Given a user message, classify it into EXACTLY one of these intents:
- "schematic": The user wants a floor plan, architectural schematic, property layout, building diagram, or any visual/spatial representation of a property.
- "pdf_report": The user wants a comprehensive written report, market analysis, property valuation, investment analysis, CMA (Comparative Market Analysis), or any document-style output.
- "chat": General real estate questions, advice, conversational queries that need a text answer.

Respond ONLY with a JSON object — no markdown, no explanation:
{"intent": "schematic|pdf_report|chat", "subject": "brief description of what to generate"}`;

async function classifyIntent(
  message: string,
  history: HistoryItem[],
): Promise<[string, string]> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: INTENT_SYSTEM },
    ...history.slice(-6).map(h => ({
      role:    h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user', content: message },
  ];

  const resp = await openai.chat.completions.create({
    model:       OPENAI_MODEL,
    messages,
    temperature: 0,
    max_tokens:  100,
  });

  const raw  = resp.choices[0].message.content?.trim() ?? '{}';
  const data = JSON.parse(raw);
  return [data.intent, data.subject ?? message];
}

// ── Schematic generation ─────────────────────────────────────────────────────

async function generateSchematic(subject: string): Promise<object> {
  const prompt =
    `Create a clean, professional architectural floor plan or schematic for: ${subject}. ` +
    'Top-down 2D blueprint style with labeled rooms, dimensions, clear black lines ' +
    'on a white background. Include a compass rose and scale bar.';

  try {
    // Strategy 1: Imagen 4 Fast
    const imagenRes = await fetch(IMAGEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1 } }),
      signal:  AbortSignal.timeout(60_000),
    });

    if (imagenRes.ok) {
      const imagenData = await imagenRes.json();
      const pred       = imagenData.predictions?.[0];
      if (pred?.bytesBase64Encoded) {
        return {
          type:     'image',
          imageUrl: `data:${pred.mimeType ?? 'image/png'};base64,${pred.bytesBase64Encoded}`,
          message:  `Here is the schematic for: ${subject}`,
        };
      }
    }

    // Strategy 2: Gemini 2.0 Flash image-gen
    const geminiRes = await fetch(GEMINI_IMG_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents:         [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (geminiRes.ok) {
      const geminiData = await geminiRes.json();
      const parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] =
        geminiData.candidates?.[0]?.content?.parts ?? [];

      for (const part of parts) {
        if (part.inlineData) {
          return {
            type:     'image',
            imageUrl: `data:${part.inlineData.mimeType ?? 'image/png'};base64,${part.inlineData.data}`,
            message:  `Here is the schematic for: ${subject}`,
          };
        }
      }

      const textParts = parts.filter(p => p.text).map(p => p.text);
      if (textParts.length > 0) {
        return { type: 'text', message: textParts.join(' ') };
      }
    }

    throw new Error(`Imagen HTTP ${imagenRes.status}, Gemini HTTP ${geminiRes.status}`);
  } catch (err) {
    // Graceful text fallback
    const fallback = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role:    'system',
          content: 'You are a real estate architect. Describe a detailed floor plan layout in text.',
        },
        { role: 'user', content: `Describe a floor plan for: ${subject}` },
      ],
      max_tokens: 400,
    });
    return {
      type:    'text',
      message: `⚠️ Image generation unavailable (${err}). Here is a text description instead:\n\n${fallback.choices[0].message.content}`,
    };
  }
}

// ── PDF report generation ────────────────────────────────────────────────────

const REPORT_SYSTEM = `You are an expert real estate analyst. Generate a comprehensive, structured
property report based on the user's request. Return a JSON object with this exact structure:

{
  "title": "Report title",
  "subtitle": "e.g. Prepared by RealEstate AI",
  "executive_summary": "2-3 sentence overview",
  "property_details": [
    ["Field", "Value"],
    ["Property Type", "Single Family Home"],
    ...
  ],
  "sections": [
    {
      "heading": "Market Analysis",
      "body": "Detailed paragraph text..."
    },
    ...
  ],
  "key_metrics": [
    ["Metric", "Value", "Note"],
    ["Estimated Value", "$450,000", "Based on comps"],
    ...
  ],
  "conclusion": "Final recommendation paragraph"
}

Include at least: Market Analysis, Location Overview, Investment Outlook, and Recommendations sections.
Use realistic, plausible data even if hypothetical — label it as estimated.`;

async function generatePdfReport(message: string): Promise<object> {
  const resp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: REPORT_SYSTEM },
      { role: 'user',   content: `Generate a real estate report for: ${message}` },
    ],
    max_tokens:  2000,
    temperature: 0.7,
  });

  let raw = resp.choices[0].message.content?.trim() ?? '{}';
  if (raw.startsWith('```')) {
    raw = raw.split('```')[1];
    if (raw.startsWith('json')) raw = raw.slice(4);
  }
  raw = raw.trim();

  const reportData = JSON.parse(raw);
  const filename   = await buildPdf(reportData);

  return {
    type:        'pdf',
    pdfUrl:      `${GENERATED_ASSETS_URL}/${filename}`,
    pdfFilename: filename,
    message:     `Your report **"${reportData.title ?? 'Property Report'}"** is ready.`,
  };
}

// ── Chat response ────────────────────────────────────────────────────────────

async function generateChatResponse(message: string, history: HistoryItem[]): Promise<object> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role:    'system',
      content:
        'You are a knowledgeable and friendly real estate AI assistant. ' +
        'Provide helpful, accurate, and concise answers about real estate topics. ' +
        'You can help with property valuations, market trends, investment advice, ' +
        'neighborhood analysis, and general real estate guidance.',
    },
    ...history.slice(-10).map(h => ({
      role:    h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user', content: message },
  ];

  const resp = await openai.chat.completions.create({
    model:       OPENAI_MODEL,
    messages,
    max_tokens:  600,
    temperature: 0.7,
  });

  return { type: 'text', message: resp.choices[0].message.content };
}

// ── Main endpoint ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { message, history = [] } = await request.json();
    const [intent, subject]         = await classifyIntent(message, history);

    let result: object;
    if (intent === 'schematic') {
      result = await generateSchematic(subject);
    } else if (intent === 'pdf_report') {
      result = await generatePdfReport(message);
    } else {
      result = await generateChatResponse(message, history);
    }

    return NextResponse.json({ intent, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
