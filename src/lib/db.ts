import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'knowledgegraph.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      telegram_id TEXT,
      avatar_url TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      conversation_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL UNIQUE,
      session_type TEXT NOT NULL DEFAULT 'unknown',
      file_path TEXT NOT NULL,
      last_line_processed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      person_id INTEGER,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      sender_id TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (person_id) REFERENCES persons(id)
    );

    CREATE TABLE IF NOT EXISTS relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_person_id INTEGER NOT NULL,
      target_person_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'talked_to',
      weight INTEGER NOT NULL DEFAULT 1,
      last_interaction_at TEXT NOT NULL,
      FOREIGN KEY (source_person_id) REFERENCES persons(id),
      FOREIGN KEY (target_person_id) REFERENCES persons(id),
      UNIQUE(source_person_id, target_person_id, type)
    );

    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT,
      mention_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS person_topics (
      person_id INTEGER NOT NULL,
      topic_id INTEGER NOT NULL,
      mention_count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (person_id, topic_id),
      FOREIGN KEY (person_id) REFERENCES persons(id),
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER,
      session_id INTEGER,
      file_path TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'image',
      caption TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (person_id) REFERENCES persons(id),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_person ON conversations(person_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_person_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_person_id);
    CREATE INDEX IF NOT EXISTS idx_person_topics_person ON person_topics(person_id);
    CREATE INDEX IF NOT EXISTS idx_media_person ON media(person_id);
  `);

  // Ensure "Steve" (the user) always exists as person ID 1
  const owner = db.prepare('SELECT id FROM persons WHERE id = 1').get();
  if (!owner) {
    db.prepare(
      `INSERT INTO persons (id, name, aliases, first_seen_at, last_seen_at, conversation_count)
       VALUES (1, 'Realtor', '["Steve","kuant"]', datetime('now'), datetime('now'), 0)`
    ).run();
  } else {
    // Ensure name is up to date
    db.prepare(`UPDATE persons SET name = 'Realtor' WHERE id = 1 AND name != 'Realtor'`).run();
  }
}

// --- Query helpers ---

export function findPersonByName(name: string): { id: number; name: string; aliases: string } | undefined {
  const db = getDb();
  // Exact name match
  const exact = db.prepare('SELECT id, name, aliases FROM persons WHERE LOWER(name) = LOWER(?)').get(name) as { id: number; name: string; aliases: string } | undefined;
  if (exact) return exact;

  // Alias match
  const all = db.prepare('SELECT id, name, aliases FROM persons').all() as { id: number; name: string; aliases: string }[];
  for (const p of all) {
    const aliases: string[] = JSON.parse(p.aliases);
    if (aliases.some(a => a.toLowerCase() === name.toLowerCase())) {
      return p;
    }
  }
  return undefined;
}

export function findPersonByTelegramId(telegramId: string): { id: number; name: string } | undefined {
  const db = getDb();
  return db.prepare('SELECT id, name FROM persons WHERE telegram_id = ?').get(telegramId) as { id: number; name: string } | undefined;
}

export function upsertPerson(
  name: string,
  opts: { telegramId?: string; alias?: string; timestamp?: string } = {}
): { id: number; isNew: boolean } {
  const db = getDb();
  const ts = opts.timestamp || new Date().toISOString();

  // Check telegram ID first
  if (opts.telegramId) {
    const existing = findPersonByTelegramId(opts.telegramId);
    if (existing) {
      db.prepare('UPDATE persons SET last_seen_at = ?, conversation_count = conversation_count + 1 WHERE id = ?').run(ts, existing.id);
      return { id: existing.id, isNew: false };
    }
  }

  // Check name/alias
  const existing = findPersonByName(name);
  if (existing) {
    db.prepare('UPDATE persons SET last_seen_at = ?, conversation_count = conversation_count + 1 WHERE id = ?').run(ts, existing.id);
    if (opts.telegramId) {
      db.prepare('UPDATE persons SET telegram_id = ? WHERE id = ? AND telegram_id IS NULL').run(opts.telegramId, existing.id);
    }
    if (opts.alias) {
      const aliases: string[] = JSON.parse(existing.aliases);
      if (!aliases.some(a => a.toLowerCase() === opts.alias!.toLowerCase())) {
        aliases.push(opts.alias);
        db.prepare('UPDATE persons SET aliases = ? WHERE id = ?').run(JSON.stringify(aliases), existing.id);
      }
    }
    return { id: existing.id, isNew: false };
  }

  // Create new
  const aliases = opts.alias ? [opts.alias] : [];
  const result = db.prepare(
    `INSERT INTO persons (name, aliases, telegram_id, first_seen_at, last_seen_at, conversation_count)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).run(name, JSON.stringify(aliases), opts.telegramId || null, ts, ts);

  return { id: Number(result.lastInsertRowid), isNew: true };
}

export function upsertRelationship(sourceId: number, targetId: number, type: string = 'talked_to', timestamp?: string): boolean {
  const db = getDb();
  const ts = timestamp || new Date().toISOString();

  const existing = db.prepare(
    'SELECT id FROM relationships WHERE source_person_id = ? AND target_person_id = ? AND type = ?'
  ).get(sourceId, targetId, type);

  if (existing) {
    db.prepare(
      'UPDATE relationships SET weight = weight + 1, last_interaction_at = ? WHERE source_person_id = ? AND target_person_id = ? AND type = ?'
    ).run(ts, sourceId, targetId, type);
    return false; // not new
  }

  db.prepare(
    `INSERT INTO relationships (source_person_id, target_person_id, type, weight, last_interaction_at)
     VALUES (?, ?, ?, 1, ?)`
  ).run(sourceId, targetId, type, ts);
  return true; // new
}

export function upsertTopic(name: string): { id: number; isNew: boolean } {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM topics WHERE LOWER(name) = LOWER(?)').get(name) as { id: number } | undefined;
  if (existing) {
    db.prepare('UPDATE topics SET mention_count = mention_count + 1 WHERE id = ?').run(existing.id);
    return { id: existing.id, isNew: false };
  }
  const result = db.prepare('INSERT INTO topics (name, mention_count) VALUES (?, 1)').run(name);
  return { id: Number(result.lastInsertRowid), isNew: true };
}

export function upsertPersonTopic(personId: number, topicId: number): void {
  const db = getDb();
  const existing = db.prepare('SELECT 1 FROM person_topics WHERE person_id = ? AND topic_id = ?').get(personId, topicId);
  if (existing) {
    db.prepare('UPDATE person_topics SET mention_count = mention_count + 1 WHERE person_id = ? AND topic_id = ?').run(personId, topicId);
  } else {
    db.prepare('INSERT INTO person_topics (person_id, topic_id) VALUES (?, ?)').run(personId, topicId);
  }
}

export function getOrCreateSession(sessionKey: string, filePath: string, sessionType: string): { id: number; lastLineProcessed: number } {
  const db = getDb();
  const existing = db.prepare('SELECT id, last_line_processed FROM sessions WHERE session_key = ?').get(sessionKey) as { id: number; last_line_processed: number } | undefined;
  if (existing) return { id: existing.id, lastLineProcessed: existing.last_line_processed };

  const result = db.prepare(
    `INSERT INTO sessions (session_key, session_type, file_path, last_line_processed) VALUES (?, ?, ?, 0)`
  ).run(sessionKey, sessionType, filePath);
  return { id: Number(result.lastInsertRowid), lastLineProcessed: 0 };
}

export function updateSessionProgress(sessionId: number, lastLine: number): void {
  const db = getDb();
  db.prepare('UPDATE sessions SET last_line_processed = ?, updated_at = datetime(\'now\') WHERE id = ?').run(lastLine, sessionId);
}

export function insertConversation(sessionId: number, personId: number | null, role: string, content: string, timestamp: string, senderId?: string): number {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO conversations (session_id, person_id, role, content, timestamp, sender_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(sessionId, personId, role, content, timestamp, senderId || null);
  return Number(result.lastInsertRowid);
}
