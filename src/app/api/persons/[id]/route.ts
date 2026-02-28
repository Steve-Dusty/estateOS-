import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { PersonDetail, PersonRow, ConversationRow, TopicRow, RelationshipRow, MediaRow } from '@/types/graph';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const personId = parseInt(id, 10);
    if (isNaN(personId)) {
      return NextResponse.json({ error: 'Invalid person ID' }, { status: 400 });
    }

    const db = getDb();

    const person = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId) as PersonRow | undefined;
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const conversations = db.prepare(
      `SELECT c.* FROM conversations c
       WHERE c.person_id = ? OR (c.session_id IN (
         SELECT DISTINCT session_id FROM conversations WHERE person_id = ?
       ) AND c.role = 'assistant')
       ORDER BY c.timestamp ASC
       LIMIT 200`
    ).all(personId, personId) as ConversationRow[];

    const topics = db.prepare(
      `SELECT t.*, pt.mention_count as person_mention_count
       FROM topics t
       JOIN person_topics pt ON pt.topic_id = t.id
       WHERE pt.person_id = ?
       ORDER BY pt.mention_count DESC`
    ).all(personId) as (TopicRow & { person_mention_count: number })[];

    const media = db.prepare(
      'SELECT * FROM media WHERE person_id = ? ORDER BY created_at DESC'
    ).all(personId) as MediaRow[];

    const relationships = db.prepare(
      `SELECT r.*, p.name as other_person_name
       FROM relationships r
       JOIN persons p ON (
         CASE WHEN r.source_person_id = ? THEN p.id = r.target_person_id
              ELSE p.id = r.source_person_id END
       )
       WHERE r.source_person_id = ? OR r.target_person_id = ?`
    ).all(personId, personId, personId) as (RelationshipRow & { other_person_name: string })[];

    const detail: PersonDetail = { person, conversations, topics, media, relationships };
    return NextResponse.json(detail);
  } catch (err) {
    console.error('[api/persons] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch person' }, { status: 500 });
  }
}
