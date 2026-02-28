import fs from 'fs';
import path from 'path';
import { parseSessionFile } from '../src/lib/session-parser';
import { processMessages } from '../src/lib/entity-extractor';
import { getOrCreateSession, updateSessionProgress, getDb } from '../src/lib/db';
import { getGraphStats } from '../src/lib/graph-builder';

const SESSIONS_DIR = process.env.OPENCLAW_SESSIONS_DIR ||
  path.join(process.env.HOME || '~', '.openclaw', 'agents', 'main', 'sessions');

async function main() {
  console.log('=== Knowledge Graph Seed ===\n');

  getDb();
  console.log('Database initialized.');

  if (!fs.existsSync(SESSIONS_DIR)) {
    console.log(`Sessions directory not found: ${SESSIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.jsonl'));
  console.log(`Found ${files.length} session files.\n`);

  let processed = 0;
  let errors = 0;

  for (const file of files) {
    try {
      const filePath = path.join(SESSIONS_DIR, file);
      const sessionKey = path.basename(file, '.jsonl');
      const { messages, totalLines, sessionType } = parseSessionFile(filePath, 0);

      // Only process glasses/phone sessions (skip telegram, control, webchat)
      const excludedTypes = ['telegram', 'control', 'webchat'];
      if (excludedTypes.includes(sessionType)) { processed++; continue; }

      // Filter to messages with a named person (not gateway-client or openclaw-control-ui)
      const qualifyingMessages = messages.filter(m => {
        if (!m.sender) return m.role === 'assistant'; // keep assistant replies for context
        const sid = m.sender.sender_id || '';
        return sid !== 'gateway-client' && sid !== 'openclaw-control-ui';
      });

      if (qualifyingMessages.filter(m => m.role === 'user').length === 0) { processed++; continue; }

      const session = getOrCreateSession(sessionKey, filePath, sessionType);

      if (totalLines <= session.lastLineProcessed) { processed++; continue; }

      const { messages: allNewMessages } = parseSessionFile(filePath, session.lastLineProcessed);
      // Apply the same filter to new messages
      const newMessages = allNewMessages.filter(m => {
        if (!m.sender) return m.role === 'assistant';
        const sid = m.sender.sender_id || '';
        return sid !== 'gateway-client' && sid !== 'openclaw-control-ui';
      });
      if (newMessages.length > 0) {
        await processMessages(newMessages, session.id);
      }
      updateSessionProgress(session.id, totalLines);
      processed++;

      if (processed % 10 === 0) console.log(`  Progress: ${processed}/${files.length}`);
    } catch (err) {
      console.error(`  Error processing ${file}:`, err);
      errors++;
    }
  }

  const stats = getGraphStats();
  console.log(`\n=== Seed Complete ===`);
  console.log(`Processed: ${processed} | Errors: ${errors}`);
  console.log(`Persons: ${stats.totalPersons} | Topics: ${stats.totalTopics} | Conversations: ${stats.totalConversations} | Relationships: ${stats.totalRelationships}`);
  if (stats.recentPersons.length > 0) {
    console.log('\nRecent People:');
    for (const p of stats.recentPersons) {
      console.log(`  - ${p.name} (last seen: ${p.lastSeenAt})`);
    }
  }

  process.exit(0);
}

main().catch(err => { console.error('Seed failed:', err); process.exit(1); });
