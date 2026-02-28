import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Composio } from '@composio/core';
import { buildPdf } from '@/app/lib/pdf-builder';
import { getDb } from '@/lib/db';

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

const INTENT_SYSTEM = `You are an intent classifier for a real estate AI assistant.

Given a user message, classify it into EXACTLY one of these intents:
- "schematic": The user wants a floor plan, architectural schematic, property layout, building diagram, or any visual/spatial representation of a property.
- "pdf_report": The user wants a comprehensive written report, market analysis, property valuation, investment analysis, CMA (Comparative Market Analysis), or any document-style output.
- "email": The user wants to send an email to someone. They may specify a recipient, subject, and content.
- "chat": General real estate questions, advice, conversational queries that need a text answer.

Respond ONLY with a JSON object — no markdown, no explanation:
{"intent": "schematic|pdf_report|email|chat", "subject": "brief description of what to generate"}`;

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

async function generateSchematic(subject: string): Promise<object> {
  const prompt =
    `Create a clean, professional architectural floor plan or schematic for: ${subject}. ` +
    'Top-down 2D blueprint style with labeled rooms, dimensions, clear black lines ' +
    'on a white background. Include a compass rose and scale bar.';

  try {
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
      message: `Image generation unavailable (${err}). Here is a text description instead:\n\n${fallback.choices[0].message.content}`,
    };
  }
}

const REPORT_SYSTEM = `You are an expert real estate analyst. Generate a comprehensive, structured
property report based on the user's request. Return a JSON object with this exact structure:

{
  "title": "Report title",
  "subtitle": "e.g. Prepared by EstateOS",
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
    message:     `Report "${reportData.title ?? 'Property Report'}" is ready.`,
  };
}

function queryKnowledgeGraph(message: string): string {
  try {
    const db = getDb();
    const parts: string[] = [];

    // Extract potential person names from the message (words that start with uppercase or the whole message)
    const words = message.split(/\s+/).filter(w => w.length > 1);

    for (const word of words) {
      const clean = word.replace(/[^a-zA-Z]/g, '');
      if (!clean) continue;

      // Search persons by name or alias
      const person = db.prepare(
        'SELECT id, name, aliases, first_seen_at, last_seen_at, conversation_count FROM persons WHERE LOWER(name) LIKE LOWER(?)'
      ).get(`%${clean}%`) as { id: number; name: string; aliases: string; first_seen_at: string; last_seen_at: string; conversation_count: number } | undefined;

      if (!person) {
        // Try alias search
        const allPersons = db.prepare('SELECT id, name, aliases, first_seen_at, last_seen_at, conversation_count FROM persons').all() as { id: number; name: string; aliases: string; first_seen_at: string; last_seen_at: string; conversation_count: number }[];
        const matched = allPersons.find(p => {
          const aliases: string[] = JSON.parse(p.aliases);
          return aliases.some(a => a.toLowerCase().includes(clean.toLowerCase()));
        });
        if (matched) {
          addPersonContext(db, matched, parts);
        }
        continue;
      }

      addPersonContext(db, person, parts);
    }

    // Also search for topic matches
    for (const word of words) {
      const clean = word.replace(/[^a-zA-Z]/g, '');
      if (!clean || clean.length < 3) continue;
      const topics = db.prepare(
        'SELECT id, name, category, mention_count FROM topics WHERE LOWER(name) LIKE LOWER(?) LIMIT 5'
      ).all(`%${clean}%`) as { id: number; name: string; category: string | null; mention_count: number }[];
      for (const topic of topics) {
        // Find who discussed this topic
        const discussers = db.prepare(`
          SELECT p.name, pt.mention_count FROM person_topics pt
          JOIN persons p ON p.id = pt.person_id
          WHERE pt.topic_id = ? ORDER BY pt.mention_count DESC LIMIT 5
        `).all(topic.id) as { name: string; mention_count: number }[];
        if (discussers.length > 0) {
          parts.push(`Topic "${topic.name}" (mentioned ${topic.mention_count}x) was discussed by: ${discussers.map(d => `${d.name} (${d.mention_count}x)`).join(', ')}`);
        }
      }
    }

    return parts.length > 0 ? parts.join('\n') : '';
  } catch {
    return '';
  }
}

function addPersonContext(
  db: ReturnType<typeof getDb>,
  person: { id: number; name: string; aliases: string; first_seen_at: string; last_seen_at: string; conversation_count: number },
  parts: string[],
) {
  const aliases: string[] = JSON.parse(person.aliases);
  parts.push(`Person: ${person.name}${aliases.length ? ` (also known as: ${aliases.join(', ')})` : ''} — ${person.conversation_count} conversations, first seen ${person.first_seen_at}, last seen ${person.last_seen_at}`);

  // Get their topics
  const topics = db.prepare(`
    SELECT t.name, pt.mention_count FROM person_topics pt
    JOIN topics t ON t.id = pt.topic_id
    WHERE pt.person_id = ? ORDER BY pt.mention_count DESC LIMIT 10
  `).all(person.id) as { name: string; mention_count: number }[];
  if (topics.length > 0) {
    parts.push(`${person.name} discussed: ${topics.map(t => `${t.name} (${t.mention_count}x)`).join(', ')}`);
  }

  // Get their relationships
  const rels = db.prepare(`
    SELECT p.name, r.type, r.weight FROM relationships r
    JOIN persons p ON p.id = r.target_person_id
    WHERE r.source_person_id = ?
    UNION ALL
    SELECT p.name, r.type, r.weight FROM relationships r
    JOIN persons p ON p.id = r.source_person_id
    WHERE r.target_person_id = ?
    ORDER BY weight DESC LIMIT 10
  `).all(person.id, person.id) as { name: string; type: string; weight: number }[];
  if (rels.length > 0) {
    parts.push(`${person.name}'s connections: ${rels.map(r => `${r.name} (${r.type}, strength ${r.weight})`).join(', ')}`);
  }

  // Get recent conversations
  const convos = db.prepare(`
    SELECT role, content, timestamp FROM conversations
    WHERE person_id = ? ORDER BY timestamp DESC LIMIT 15
  `).all(person.id) as { role: string; content: string; timestamp: string }[];
  if (convos.length > 0) {
    parts.push(`Recent messages involving ${person.name}:`);
    for (const c of convos.reverse()) {
      parts.push(`  [${c.timestamp}] ${c.role}: ${c.content.slice(0, 200)}`);
    }
  }
}

async function generateChatResponse(message: string, history: HistoryItem[]): Promise<object> {
  // Query the knowledge graph for relevant context
  const kgContext = queryKnowledgeGraph(message);

  let systemContent =
    'You are EstateOS, a knowledgeable and precise real estate AI assistant. ' +
    'Provide helpful, accurate, and concise answers about real estate topics. ' +
    'You can help with property valuations, market trends, investment advice, ' +
    'neighborhood analysis, and general real estate guidance.';

  if (kgContext) {
    systemContent += '\n\nYou have access to a knowledge graph of people, conversations, and topics from the user\'s real estate network. ' +
      'Use the following context to answer questions about specific people, what they discussed, and their relationships:\n\n' +
      kgContext;
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemContent },
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

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });

async function sendEmail(
  message: string,
  propertyContext: string,
  lastPdfUrl?: string,
  lastPdfFilename?: string,
): Promise<object> {
  // 1. Use GPT to extract email fields from user message
  const extractionPrompt = `Extract the email details from this user message. The user may or may not provide all fields.
If subject or body is not explicitly provided, generate appropriate ones based on the context.

${propertyContext ? `Property context: ${propertyContext}` : ''}
${lastPdfUrl ? `A PDF report is available: ${lastPdfFilename}` : ''}

User message: ${message}

Respond ONLY with JSON:
{"to": "email@example.com", "subject": "Email subject", "body": "Email body in HTML format"}`;

  const resp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: 'You are a helpful assistant that extracts email details and generates professional real estate emails. Always format the body as clean HTML with proper paragraphs.' },
      { role: 'user', content: extractionPrompt },
    ],
    temperature: 0,
    max_tokens: 800,
  });

  let raw = resp.choices[0].message.content?.trim() ?? '{}';
  if (raw.startsWith('```')) {
    raw = raw.split('```')[1];
    if (raw.startsWith('json')) raw = raw.slice(4);
  }
  raw = raw.trim();

  const { to, subject, body } = JSON.parse(raw);

  if (!to) {
    return { type: 'text', message: 'Could not determine the recipient email address. Please specify who to send the email to.' };
  }

  // 2. Send via Composio
  const result = await composio.tools.execute('GMAIL_SEND_EMAIL', {
    userId: 'default',
    arguments: {
      recipient_email: to,
      subject: subject ?? 'Property Information from EstateOS',
      body,
      is_html: true,
    },
    dangerouslySkipVersionCheck: true,
  });

  if (result.data?.error) {
    return { type: 'text', message: `Failed to send email: ${result.data.error}` };
  }

  return { type: 'text', message: `Email sent successfully to ${to}!\n\nSubject: ${subject}` };
}

export async function POST(request: NextRequest) {
  try {
    const { message, history = [], lastPdfUrl, lastPdfFilename } = await request.json();
    const [intent, subject] = await classifyIntent(message, history);

    let result: object;
    if (intent === 'schematic') {
      result = await generateSchematic(subject);
    } else if (intent === 'pdf_report') {
      result = await generatePdfReport(message);
    } else if (intent === 'email') {
      result = await sendEmail(message, '', lastPdfUrl, lastPdfFilename);
    } else {
      result = await generateChatResponse(message, history);
    }

    return NextResponse.json({ intent, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
