import fs from 'fs';
import { SessionEntry, MessageEntry, ParsedMessage, SenderMetadata } from '@/types/openclaw';

/**
 * Parse an OpenClaw JSONL session file, returning only user/assistant messages
 * starting from a given line offset.
 */
export function parseSessionFile(
  filePath: string,
  startLine: number = 0
): { messages: ParsedMessage[]; totalLines: number; sessionId: string; sessionType: string } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const messages: ParsedMessage[] = [];
  let sessionId = '';
  let sessionType: 'telegram' | 'glass' | 'webchat' | 'control' | 'unknown' = 'unknown';

  for (let i = 0; i < lines.length; i++) {
    let entry: SessionEntry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }

    // Extract session ID from header
    if (entry.type === 'session' && 'id' in entry) {
      sessionId = (entry as { id: string }).id;
    }

    // Skip already-processed lines
    if (i < startLine) continue;

    if (entry.type !== 'message') continue;

    const msg = entry as MessageEntry;
    const role = msg.message.role;

    // Only care about user and assistant messages (not toolResult)
    if (role !== 'user' && role !== 'assistant') continue;

    // Extract text content
    const textParts = msg.message.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map(c => c.text);

    if (textParts.length === 0) continue;

    const fullText = textParts.join('\n');

    // Extract images
    const images = msg.message.content
      .filter((c): c is { type: 'image'; source: { type: string; media_type: string; data: string } } => c.type === 'image')
      .map(c => c.source.data);

    // Parse sender metadata from user messages
    let sender: SenderMetadata | null = null;
    if (role === 'user') {
      sender = extractSenderMetadata(fullText);
      if (!sessionType || sessionType === 'unknown') {
        sessionType = detectSessionType(sender, fullText);
      }
    }

    // Clean the text (remove metadata block)
    const cleanedText = cleanMessageText(fullText);
    if (!cleanedText.trim()) continue;

    messages.push({
      sessionId,
      messageId: msg.id,
      role: role as 'user' | 'assistant',
      content: cleanedText,
      timestamp: msg.timestamp,
      sender,
      sessionType,
      images,
    });
  }

  return { messages, totalLines: lines.length, sessionId, sessionType };
}

/**
 * Extract sender metadata from the JSON block at the top of user messages.
 */
function extractSenderMetadata(text: string): SenderMetadata | null {
  // Pattern: Conversation info (untrusted metadata):\n```json\n{...}\n```
  const metaMatch = text.match(/Conversation info[^`]*```json\s*\n([\s\S]*?)\n```/);
  if (!metaMatch) return null;

  try {
    return JSON.parse(metaMatch[1]);
  } catch {
    return null;
  }
}

/**
 * Detect session type from sender metadata and message content.
 */
function detectSessionType(sender: SenderMetadata | null, text: string): 'telegram' | 'glass' | 'webchat' | 'control' | 'unknown' {
  if (!sender) return 'unknown';

  const senderId = sender.sender_id || '';
  const senderName = sender.sender || '';

  // Telegram messages come from telegram channel
  if (sender.channel === 'telegram' || sender.origin === 'telegram') return 'telegram';

  // Check for telegram user ID patterns in sender_id
  if (/^telegram[:_]/.test(senderId)) return 'telegram';

  // Gateway client = web chat or glasses
  if (senderId === 'gateway-client' || senderName === 'gateway-client') {
    // Glasses sessions often mention camera, glass, etc.
    if (/glass|camera|snap|photo|看|拍/i.test(text)) return 'glass';
    return 'webchat';
  }

  // Control UI
  if (senderId === 'openclaw-control-ui') return 'control';

  // Check if the sender looks like a person name with telegram ID
  if (/id:\d+/.test(senderName) || /^\d{5,}$/.test(senderId)) return 'telegram';

  return 'unknown';
}

/**
 * Clean message text by removing the metadata JSON block and timestamp prefix.
 */
function cleanMessageText(text: string): string {
  // Remove metadata block
  let cleaned = text.replace(/Conversation info[^`]*```json\s*\n[\s\S]*?\n```\s*\n?/, '');

  // Remove timestamp prefix like "[Sat 2026-02-21 11:50 PST] "
  cleaned = cleaned.replace(/^\[[\w\s\-:]+\]\s*/, '');

  return cleaned.trim();
}

/**
 * Extract person name and telegram ID from sender metadata or message text.
 * Telegram messages often have sender like "Jeff id:8046831879"
 */
export function extractPersonFromMessage(msg: ParsedMessage): {
  name: string | null;
  telegramId: string | null;
} {
  if (msg.role === 'assistant') return { name: null, telegramId: null };

  const sender = msg.sender;
  if (!sender) return { name: null, telegramId: null };

  // Check for explicit telegram info
  if (sender.display_name) {
    const idMatch = sender.sender_id?.match(/(\d{5,})/);
    return {
      name: sender.display_name,
      telegramId: idMatch?.[1] || sender.telegram_user_id || null,
    };
  }

  // Check sender field for "Name id:12345" pattern
  const nameIdMatch = sender.sender?.match(/^(.+?)\s+id:(\d+)$/);
  if (nameIdMatch) {
    return { name: nameIdMatch[1], telegramId: nameIdMatch[2] };
  }

  // For telegram sessions, sender_id might be the telegram user id
  if (msg.sessionType === 'telegram' && sender.sender_id && /^\d{5,}$/.test(sender.sender_id)) {
    return { name: sender.sender || null, telegramId: sender.sender_id };
  }

  // For gateway-client, this is Steve talking
  if (sender.sender_id === 'gateway-client' || sender.sender_id === 'openclaw-control-ui') {
    return { name: null, telegramId: null }; // Steve, handled separately
  }

  return { name: sender.sender !== sender.sender_id ? sender.sender : null, telegramId: null };
}
