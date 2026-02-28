import { NextRequest, NextResponse } from 'next/server';
import { processMessages } from '@/lib/entity-extractor';
import { getOrCreateSession, updateSessionProgress } from '@/lib/db';
import { broadcastGraphDelta, broadcastConversation } from '@/lib/socket-server';
import type { ParsedMessage } from '@/types/openclaw';

/**
 * POST /api/ingest
 *
 * Called by OpenClaw (via tool call or webhook) whenever a conversation happens.
 * Accepts conversation turns, extracts entities, updates the graph in real-time.
 *
 * Body: {
 *   sessionId?: string,
 *   source?: "glasses" | "telegram" | "webchat",
 *   speaker?: string,           // person the user is talking to
 *   speakerId?: string,         // e.g. telegram user ID
 *   turns: [
 *     { role: "user", content: "..." },
 *     { role: "assistant", content: "..." }
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, source, speaker, speakerId, turns } = body;

    if (!turns || !Array.isArray(turns) || turns.length === 0) {
      return NextResponse.json({ error: 'Missing or empty turns array' }, { status: 400 });
    }

    // Only accept glasses and phone conversations (not telegram, webchat, etc.)
    const allowedSources = ['glasses', 'phone'];
    if (source && !allowedSources.includes(source)) {
      return NextResponse.json({ error: 'Only glasses and phone conversations are tracked' }, { status: 400 });
    }

    // Require a named speaker (the person the user is talking to)
    const hasSpeaker = speaker || turns.some((t: { speaker?: string }) => t.speaker);
    if (!hasSpeaker) {
      return NextResponse.json({ error: 'A named speaker is required' }, { status: 400 });
    }

    const sessionKey = sessionId || `ingest-${Date.now()}`;
    const sessionType = source || 'glasses';
    const now = new Date().toISOString();

    const session = getOrCreateSession(sessionKey, `ingest:${sessionKey}`, sessionType);

    const messages: ParsedMessage[] = turns.map((turn: {
      role: string;
      content: string;
      speaker?: string;
      speakerId?: string;
      timestamp?: string;
    }, i: number) => ({
      sessionId: sessionKey,
      messageId: `${sessionKey}-${session.lastLineProcessed + i}`,
      role: turn.role as 'user' | 'assistant',
      content: turn.content,
      timestamp: turn.timestamp || now,
      sender: turn.role === 'user' && (turn.speaker || speaker) ? {
        sender_id: turn.speakerId || speakerId || (turn.speaker || speaker),
        sender: turn.speaker || speaker,
        display_name: turn.speaker || speaker,
      } : turn.role === 'user' ? {
        sender_id: 'gateway-client',
        sender: 'gateway-client',
      } : null,
      sessionType: sessionType as ParsedMessage['sessionType'],
      images: [],
    }));

    const delta = await processMessages(messages, session.id);
    updateSessionProgress(session.id, session.lastLineProcessed + turns.length);

    if (delta.newNodes.length || delta.updatedNodes.length || delta.newLinks.length || delta.updatedLinks.length) {
      broadcastGraphDelta(delta);
    }

    // Broadcast each conversation turn to the live stream
    for (const turn of turns) {
      broadcastConversation({
        speaker: turn.role === 'user' ? (turn.speaker || speaker || 'You') : 'AI',
        source: sessionType,
        content: turn.content,
        role: turn.role,
        timestamp: turn.timestamp || now,
      });
    }

    console.log(`[ingest] ${sessionType}: ${turns.length} turns → +${delta.newNodes.length} nodes, ~${delta.updatedNodes.length} updated`);

    return NextResponse.json({
      ok: true,
      processed: turns.length,
      newNodes: delta.newNodes.length,
      updatedNodes: delta.updatedNodes.length,
    });
  } catch (err) {
    console.error('[ingest] Error:', err);
    return NextResponse.json({ error: 'Ingest failed' }, { status: 500 });
  }
}
