// Graph visualization types

export interface GraphNode {
  id: string;
  name: string;
  type: 'person' | 'topic';
  // Person-specific
  avatarUrl?: string;
  conversationCount?: number;
  lastSeenAt?: string;
  firstSeenAt?: string;
  telegramId?: string;
  // Topic-specific
  category?: string;
  mentionCount?: number;
  // Computed for rendering
  val?: number; // node size
  color?: string;
  fx?: number;
  fy?: number;
  fz?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'talked_to' | 'mentioned_topic' | 'knows';
  weight: number;
  color?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Database row types
export interface PersonRow {
  id: number;
  name: string;
  aliases: string; // JSON array
  telegram_id: string | null;
  avatar_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
  conversation_count: number;
}

export interface SessionRow {
  id: number;
  session_key: string;
  session_type: string;
  file_path: string;
  last_line_processed: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationRow {
  id: number;
  session_id: number;
  person_id: number | null;
  role: string;
  content: string;
  timestamp: string;
  sender_id: string | null;
}

export interface RelationshipRow {
  id: number;
  source_person_id: number;
  target_person_id: number;
  type: string;
  weight: number;
  last_interaction_at: string;
}

export interface TopicRow {
  id: number;
  name: string;
  category: string | null;
  mention_count: number;
}

export interface PersonTopicRow {
  person_id: number;
  topic_id: number;
  mention_count: number;
}

export interface MediaRow {
  id: number;
  person_id: number | null;
  session_id: number | null;
  file_path: string;
  media_type: string;
  caption: string | null;
  created_at: string;
}

// WebSocket event payloads
export interface GraphNodeEvent {
  node: GraphNode;
}

export interface GraphLinkEvent {
  link: GraphLink;
}

export interface GraphInitEvent {
  graph: GraphData;
}

// Person detail (API response)
export interface PersonDetail {
  person: PersonRow;
  conversations: ConversationRow[];
  topics: (TopicRow & { person_mention_count: number })[];
  media: MediaRow[];
  relationships: (RelationshipRow & { other_person_name: string })[];
}
