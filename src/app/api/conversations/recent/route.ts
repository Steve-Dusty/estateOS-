import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        c.content,
        c.role,
        c.timestamp,
        COALESCE(p.name, 'Unknown') as speaker,
        COALESCE(s.session_type, 'unknown') as source
      FROM conversations c
      LEFT JOIN persons p ON c.person_id = p.id
      LEFT JOIN sessions s ON c.session_id = s.id
      ORDER BY c.timestamp DESC
      LIMIT 100
    `).all() as Array<{
      content: string;
      role: string;
      timestamp: string;
      speaker: string;
      source: string;
    }>;

    const conversations = rows.map(r => ({
      speaker: r.role === 'assistant' ? 'AI' : r.speaker,
      source: r.source,
      content: r.content,
      role: r.role,
      timestamp: r.timestamp,
    }));

    return NextResponse.json({ conversations });
  } catch (err) {
    console.error('[api/conversations/recent] Error:', err);
    return NextResponse.json({ conversations: [] });
  }
}
