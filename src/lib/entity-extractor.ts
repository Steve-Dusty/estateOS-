import { GoogleGenerativeAI } from '@google/generative-ai';
import { ParsedMessage, SenderMetadata } from '@/types/openclaw';
import { extractPersonFromMessage } from './session-parser';
import {
  upsertPerson,
  upsertRelationship,
  upsertTopic,
  upsertPersonTopic,
  insertConversation,
  getDb,
} from './db';
import { GraphNode, GraphLink } from '@/types/graph';

const STEVE_ID = 1; // Steve is always person ID 1

interface ExtractionResult {
  persons: { name: string; telegramId?: string }[];
  topics: string[];
  relationships: { from: string; to: string; type: string }[];
}

interface ProcessingResult {
  newNodes: GraphNode[];
  updatedNodes: GraphNode[];
  newLinks: GraphLink[];
  updatedLinks: GraphLink[];
}

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI | null {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') return null;
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Use Gemini to extract entities from a batch of messages.
 */
async function extractEntitiesWithGemini(messages: ParsedMessage[]): Promise<ExtractionResult> {
  const conversationText = messages
    .map(m => {
      const role = m.role === 'user' ? (m.sender?.sender || 'User') : 'Assistant';
      return `[${role}]: ${m.content}`;
    })
    .join('\n');

  if (conversationText.length < 10) {
    return { persons: [], topics: [], relationships: [] };
  }

  try {
    const ai = getGenAI();
    if (!ai) return { persons: [], topics: [], relationships: [] };
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Analyze this conversation and extract:
1. **People mentioned** (names of real people discussed or participating, NOT "Assistant" or "AI")
2. **Topics discussed** (specific subjects, technologies, places, projects - NOT generic like "greeting" or "conversation")
3. **Relationships** between people (who knows who, who works with who)

Conversation context: This may be from Meta Ray-Ban glasses (in-person conversation), Telegram chat, or web chat with an AI assistant.

CONVERSATION:
${conversationText}

Respond ONLY with valid JSON (no markdown, no code fences):
{"persons":[{"name":"..."}],"topics":["..."],"relationships":[{"from":"...","to":"...","type":"knows"}]}

Rules:
- Only include REAL person names (not "User", "Assistant", "AI", "Bot")
- Topics should be specific and meaningful (2+ words or proper nouns)
- If no entities found, return empty arrays
- Keep topic names short (1-4 words)`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Try to parse JSON, handling potential markdown wrapping
    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);
    return {
      persons: Array.isArray(parsed.persons) ? parsed.persons : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
    };
  } catch (err) {
    console.error('[entity-extractor] Gemini extraction failed:', err);
    return { persons: [], topics: [], relationships: [] };
  }
}

/**
 * Process a batch of messages: extract entities, update DB, return graph deltas.
 */
export async function processMessages(
  messages: ParsedMessage[],
  sessionId: number
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    newNodes: [],
    updatedNodes: [],
    newLinks: [],
    updatedLinks: [],
  };

  if (messages.length === 0) return result;

  const db = getDb();

  // Step 1: Direct person extraction from metadata (reliable)
  const knownPersonIds = new Set<number>();
  for (const msg of messages) {
    const { name, telegramId } = extractPersonFromMessage(msg);

    let personId: number | null = null;
    if (name && name !== 'gateway-client' && name !== 'openclaw-control-ui') {
      const { id, isNew } = upsertPerson(name, {
        telegramId: telegramId || undefined,
        timestamp: msg.timestamp,
      });
      personId = id;
      knownPersonIds.add(id);

      if (isNew) {
        result.newNodes.push(personToNode(id));
        // New link: Steve <-> this person
        const linkIsNew = upsertRelationship(STEVE_ID, id, 'talked_to', msg.timestamp);
        const link = { source: `person-${STEVE_ID}`, target: `person-${id}`, type: 'talked_to' as const, weight: 1 };
        if (linkIsNew) result.newLinks.push(link);
        else result.updatedLinks.push(link);
      } else {
        result.updatedNodes.push(personToNode(id));
        upsertRelationship(STEVE_ID, id, 'talked_to', msg.timestamp);
        result.updatedLinks.push({
          source: `person-${STEVE_ID}`,
          target: `person-${id}`,
          type: 'talked_to',
          weight: 1,
        });
      }
    }

    // Store conversation
    const speakerId = msg.role === 'user' ? (personId || STEVE_ID) : null;
    insertConversation(
      sessionId,
      speakerId,
      msg.role,
      msg.content,
      msg.timestamp,
      msg.sender?.sender_id
    );
  }

  // Step 2: Gemini-powered extraction for additional entities
  try {
    const extraction = await extractEntitiesWithGemini(messages);

    // Process extracted persons
    for (const p of extraction.persons) {
      if (!p.name || p.name.length < 2) continue;
      // Skip if it's Steve
      if (/^steve$/i.test(p.name) || /^kuant$/i.test(p.name)) continue;

      const { id, isNew } = upsertPerson(p.name, {
        telegramId: p.telegramId,
        timestamp: messages[0].timestamp,
      });

      if (isNew && !knownPersonIds.has(id)) {
        result.newNodes.push(personToNode(id));
        const linkIsNew = upsertRelationship(STEVE_ID, id, 'talked_to', messages[0].timestamp);
        if (linkIsNew) {
          result.newLinks.push({
            source: `person-${STEVE_ID}`,
            target: `person-${id}`,
            type: 'talked_to',
            weight: 1,
          });
        }
      }
      knownPersonIds.add(id);
    }

    // Process topics
    for (const topicName of extraction.topics) {
      if (!topicName || topicName.length < 2) continue;
      const { id: topicId, isNew: topicIsNew } = upsertTopic(topicName);

      if (topicIsNew) {
        result.newNodes.push({
          id: `topic-${topicId}`,
          name: topicName,
          type: 'topic',
          mentionCount: 1,
          val: 3,
          color: '#6366f1',
        });
      }

      // Link persons to topics
      for (const personId of knownPersonIds) {
        upsertPersonTopic(personId, topicId);
        const linkKey = { source: `person-${personId}`, target: `topic-${topicId}`, type: 'mentioned_topic' as const, weight: 1 };
        result.newLinks.push(linkKey);
      }
    }

    // Process relationships
    for (const rel of extraction.relationships) {
      const fromPerson = db.prepare('SELECT id FROM persons WHERE LOWER(name) = LOWER(?)').get(rel.from) as { id: number } | undefined;
      const toPerson = db.prepare('SELECT id FROM persons WHERE LOWER(name) = LOWER(?)').get(rel.to) as { id: number } | undefined;
      if (fromPerson && toPerson && fromPerson.id !== toPerson.id) {
        const isNew = upsertRelationship(fromPerson.id, toPerson.id, rel.type || 'knows', messages[0].timestamp);
        const link = {
          source: `person-${fromPerson.id}`,
          target: `person-${toPerson.id}`,
          type: (rel.type || 'knows') as GraphLink['type'],
          weight: 1,
        };
        if (isNew) result.newLinks.push(link);
        else result.updatedLinks.push(link);
      }
    }
  } catch (err) {
    console.error('[entity-extractor] Processing error:', err);
  }

  // Update Steve's node
  result.updatedNodes.push(personToNode(STEVE_ID));

  return result;
}

function personToNode(id: number): GraphNode {
  const db = getDb();
  const p = db.prepare('SELECT * FROM persons WHERE id = ?').get(id) as {
    id: number; name: string; avatar_url: string | null; conversation_count: number;
    first_seen_at: string; last_seen_at: string; telegram_id: string | null;
  };
  return {
    id: `person-${p.id}`,
    name: p.name,
    type: 'person',
    avatarUrl: p.avatar_url || undefined,
    conversationCount: p.conversation_count,
    firstSeenAt: p.first_seen_at,
    lastSeenAt: p.last_seen_at,
    telegramId: p.telegram_id || undefined,
    val: p.id === STEVE_ID ? 15 : Math.max(5, Math.min(12, p.conversation_count + 3)),
    color: p.id === STEVE_ID ? '#f59e0b' : '#22d3ee',
  };
}
