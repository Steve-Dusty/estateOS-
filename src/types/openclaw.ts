// OpenClaw JSONL session types

export interface SessionHeader {
  type: 'session';
  version: number;
  id: string;
  timestamp: string;
  cwd: string;
}

export interface ModelChange {
  type: 'model_change';
  id: string;
  parentId: string | null;
  timestamp: string;
  provider: string;
  modelId: string;
}

export interface MessageEntry {
  type: 'message';
  id: string;
  parentId: string;
  timestamp: string;
  message: {
    role: 'user' | 'assistant' | 'toolResult';
    content: MessageContent[];
    timestamp?: number;
    toolCallId?: string;
    toolName?: string;
    api?: string;
    provider?: string;
    model?: string;
    usage?: Record<string, unknown>;
    stopReason?: string;
  };
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; thinkingSignature?: string }
  | { type: 'toolCall'; id: string; name: string; arguments: Record<string, unknown>; partialJson?: string }
  | { type: 'image'; source: { type: string; media_type: string; data: string } };

export type SessionEntry = SessionHeader | ModelChange | MessageEntry | { type: string; [key: string]: unknown };

export interface SenderMetadata {
  message_id?: string;
  sender_id: string;
  sender: string;
  origin?: string;
  channel?: string;
  telegram_user_id?: string;
  display_name?: string;
}

export interface ParsedMessage {
  sessionId: string;
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sender: SenderMetadata | null;
  sessionType: 'telegram' | 'glass' | 'webchat' | 'control' | 'unknown';
  images: string[];
}
