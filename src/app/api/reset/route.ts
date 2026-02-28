import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { buildFullGraph } from '@/lib/graph-builder';
import { getIO } from '@/lib/socket-server';

/**
 * DELETE /api/reset
 *
 * Clears all knowledge graph data and re-creates Steve (person ID 1).
 * Broadcasts a full graph refresh via WebSocket so the UI updates live.
 */
export async function DELETE() {
  try {
    const db = getDb();

    db.exec(`
      DELETE FROM person_topics;
      DELETE FROM media;
      DELETE FROM conversations;
      DELETE FROM relationships;
      DELETE FROM topics;
      DELETE FROM persons WHERE id != 1;
      DELETE FROM sessions;
    `);

    // Reset Steve's conversation count
    db.prepare('UPDATE persons SET conversation_count = 0, last_seen_at = datetime(\'now\') WHERE id = 1').run();

    // Broadcast fresh (empty) graph to all connected clients
    const io = getIO();
    if (io) {
      const graph = buildFullGraph();
      io.emit('graph:init', { graph });
    }

    console.log('[reset] All knowledge graph data cleared');

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reset] Error:', err);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
