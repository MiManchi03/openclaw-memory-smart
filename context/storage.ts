import { getDb } from "../shared/db.js";
import type { Conversation, ConversationMessage } from "../types.js";

function generateId(): string {
  return crypto.randomUUID();
}

export function createConversation(userId: string, agentId: string): Conversation {
  const now = Date.now();

  const conversation: Conversation = {
    id: generateId(),
    userId,
    agentId,
    messages: [],
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
  };

  const db = getDb();
  db.prepare(`
    INSERT INTO conversations (id, user_id, agent_id, messages, summary, metadata, created_at, updated_at, last_message_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    conversation.id,
    conversation.userId,
    conversation.agentId,
    JSON.stringify(conversation.messages),
    null,
    null,
    conversation.createdAt,
    conversation.updatedAt,
    conversation.lastMessageAt
  );

  return conversation;
}

export function getConversation(id: string): Conversation | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as ConversationRow | undefined;

  if (!row) {
    return null;
  }

  return mapRowToConversation(row);
}

export function getConversationsByUser(userId: string, limit?: number): Conversation[] {
  const db = getDb();

  let query = "SELECT * FROM conversations WHERE user_id = ? ORDER BY last_message_at DESC";
  if (limit) {
    query += ` LIMIT ${limit}`;
  }

  const rows = db.prepare(query).all(userId) as unknown as ConversationRow[];
  return rows.map(mapRowToConversation);
}

export function getMostRecentConversations(userId: string, count: number): Conversation[] {
  return getConversationsByUser(userId, count);
}

export function addMessageToConversation(
  conversationId: string,
  message: ConversationMessage
): Conversation | null {
  const db = getDb();
  const now = Date.now();

  const conversation = getConversation(conversationId);
  if (!conversation) {
    return null;
  }

  conversation.messages.push(message);
  conversation.updatedAt = now;
  conversation.lastMessageAt = now;

  db.prepare(`
    UPDATE conversations 
    SET messages = ?, updated_at = ?, last_message_at = ?
    WHERE id = ?
  `).run(
    JSON.stringify(conversation.messages),
    conversation.updatedAt,
    conversation.lastMessageAt,
    conversationId
  );

  return conversation;
}

export function updateConversationSummary(conversationId: string, summary: string): void {
  const db = getDb();
  db.prepare("UPDATE conversations SET summary = ?, updated_at = ? WHERE id = ?").run(
    summary,
    Date.now(),
    conversationId
  );
}

export function deleteConversation(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
}

export function cleanupOldConversations(userId: string, keepCount: number): number {
  const existing = getConversationsByUser(userId);
  if (existing.length <= keepCount) {
    return 0;
  }

  const toDelete = existing.slice(keepCount);
  let deletedCount = 0;

  for (const conv of toDelete) {
    deleteConversation(conv.id);
    deletedCount++;
  }

  return deletedCount;
}

export function searchConversations(userId: string, query: string): Conversation[] {
  const conversations = getConversationsByUser(userId);

  const lowerQuery = query.toLowerCase();
  return conversations.filter((conv) => {
    const allContent = conv.messages.map((m) => m.content).join(" ").toLowerCase();
    return allContent.includes(lowerQuery);
  });
}

interface ConversationRow {
  id: string;
  user_id: string;
  agent_id: string;
  messages: string;
  summary: string | null;
  metadata: string | null;
  created_at: number;
  updated_at: number;
  last_message_at: number;
}

function mapRowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    agentId: row.agent_id,
    messages: JSON.parse(row.messages) as ConversationMessage[],
    summary: row.summary ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
  };
}
