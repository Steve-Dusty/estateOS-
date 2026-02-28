import { getDb } from './db';
import { GraphData, GraphNode, GraphLink } from '@/types/graph';

const STEVE_ID = 1;

/**
 * Build the full graph data from the database.
 */
export function buildFullGraph(): GraphData {
  const db = getDb();
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  // Get all persons
  const persons = db.prepare('SELECT * FROM persons ORDER BY conversation_count DESC').all() as Array<{
    id: number; name: string; avatar_url: string | null; conversation_count: number;
    first_seen_at: string; last_seen_at: string; telegram_id: string | null;
  }>;

  for (const p of persons) {
    nodes.push({
      id: `person-${p.id}`,
      name: p.name,
      type: 'person',
      avatarUrl: p.avatar_url || undefined,
      conversationCount: p.conversation_count,
      firstSeenAt: p.first_seen_at,
      lastSeenAt: p.last_seen_at,
      telegramId: p.telegram_id || undefined,
      val: p.id === STEVE_ID ? 12 : Math.max(10, Math.min(14, p.conversation_count + 8)),
      color: p.id === STEVE_ID ? '#f59e0b' : '#22d3ee',
    });
  }

  // Get all topics
  const topics = db.prepare('SELECT * FROM topics WHERE mention_count >= 1 ORDER BY mention_count DESC LIMIT 100').all() as Array<{
    id: number; name: string; category: string | null; mention_count: number;
  }>;

  for (const t of topics) {
    nodes.push({
      id: `topic-${t.id}`,
      name: t.name,
      type: 'topic',
      category: t.category || undefined,
      mentionCount: t.mention_count,
      val: Math.max(8, Math.min(12, t.mention_count + 6)),
      color: '#6366f1',
    });
  }

  // Get person-person relationships
  const relationships = db.prepare('SELECT * FROM relationships').all() as Array<{
    source_person_id: number; target_person_id: number; type: string; weight: number;
  }>;

  for (const r of relationships) {
    // Only add link if both nodes exist
    const sourceNodeId = `person-${r.source_person_id}`;
    const targetNodeId = `person-${r.target_person_id}`;
    if (nodes.some(n => n.id === sourceNodeId) && nodes.some(n => n.id === targetNodeId)) {
      links.push({
        source: sourceNodeId,
        target: targetNodeId,
        type: r.type as GraphLink['type'],
        weight: r.weight,
      });
    }
  }

  // Get person-topic links
  const personTopics = db.prepare('SELECT * FROM person_topics').all() as Array<{
    person_id: number; topic_id: number; mention_count: number;
  }>;

  for (const pt of personTopics) {
    const sourceNodeId = `person-${pt.person_id}`;
    const targetNodeId = `topic-${pt.topic_id}`;
    if (nodes.some(n => n.id === sourceNodeId) && nodes.some(n => n.id === targetNodeId)) {
      links.push({
        source: sourceNodeId,
        target: targetNodeId,
        type: 'mentioned_topic',
        weight: pt.mention_count,
      });
    }
  }

  return { nodes, links };
}

/**
 * Get stats for the overlay.
 */
export function getGraphStats(): {
  totalPersons: number;
  totalTopics: number;
  totalConversations: number;
  totalRelationships: number;
  recentPersons: Array<{ name: string; lastSeenAt: string }>;
} {
  const db = getDb();

  const totalPersons = (db.prepare('SELECT COUNT(*) as c FROM persons').get() as { c: number }).c;
  const totalTopics = (db.prepare('SELECT COUNT(*) as c FROM topics').get() as { c: number }).c;
  const totalConversations = (db.prepare('SELECT COUNT(*) as c FROM conversations').get() as { c: number }).c;
  const totalRelationships = (db.prepare('SELECT COUNT(*) as c FROM relationships').get() as { c: number }).c;

  const recentPersons = db.prepare(
    'SELECT name, last_seen_at as lastSeenAt FROM persons WHERE id != 1 ORDER BY last_seen_at DESC LIMIT 5'
  ).all() as Array<{ name: string; lastSeenAt: string }>;

  return { totalPersons, totalTopics, totalConversations, totalRelationships, recentPersons };
}
