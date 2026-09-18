import { getDatabase } from '@/shared/db';
import type { Conversation, Message } from '@/shared/types/chat';
import crypto from 'node:crypto';

export function listConversations(): Conversation[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT c.*, COUNT(m.id) as messages_count 
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `);
  const rows = stmt.all() as unknown as Array<{
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    model_id: string;
    total_tokens: number;
    messages_count: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    modelId: r.model_id,
    totalTokens: r.total_tokens,
    messagesCount: r.messages_count,
  }));
}

export function getConversation(id: string): Conversation | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
  const row = stmt.get(id) as unknown as {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    model_id: string;
    total_tokens: number;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    modelId: row.model_id,
    totalTokens: row.total_tokens,
  };
}

export function createConversation(title?: string, modelId: string = 'gemini-3.8-flash-high'): Conversation {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const convoTitle = title || 'Nueva conversación';

  db.prepare(`
    INSERT INTO conversations (id, title, created_at, updated_at, model_id, total_tokens)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(id, convoTitle, now, now, modelId);

  return {
    id,
    title: convoTitle,
    createdAt: now,
    updatedAt: now,
    modelId,
    totalTokens: 0,
    messagesCount: 0,
  };
}

export function updateConversationTitle(id: string, title: string): boolean {
  const db = getDatabase();
  db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run(
    title,
    new Date().toISOString(),
    id
  );
  return true;
}

export function deleteConversation(id: string): boolean {
  const db = getDatabase();
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  return true;
}

export function getMessages(conversationId: string): Message[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC');
  const rows = stmt.all(conversationId) as unknown as Array<{
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
    duration_seconds: number | null;
    input_tokens: number;
    output_tokens: number;
    thinking_tokens: number;
    total_tokens: number;
    account_id: string | null;
    account_email: string | null;
    model_id: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at,
    durationSeconds: r.duration_seconds ?? undefined,
    usage: {
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      thinkingTokens: r.thinking_tokens,
      totalTokens: r.total_tokens,
    },
    accountId: r.account_id ?? undefined,
    accountEmail: r.account_email ?? undefined,
    modelId: r.model_id ?? undefined,
  }));
}

export function saveMessage(msg: Message): Message {
  const db = getDatabase();
  const now = msg.createdAt || new Date().toISOString();

  db.prepare(`
    INSERT INTO messages (
      id, conversation_id, role, content, created_at, duration_seconds,
      input_tokens, output_tokens, thinking_tokens, total_tokens,
      account_id, account_email, model_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    msg.id,
    msg.conversationId,
    msg.role,
    msg.content,
    now,
    msg.durationSeconds ?? null,
    msg.usage?.inputTokens ?? 0,
    msg.usage?.outputTokens ?? 0,
    msg.usage?.thinkingTokens ?? 0,
    msg.usage?.totalTokens ?? 0,
    msg.accountId ?? null,
    msg.accountEmail ?? null,
    msg.modelId ?? null
  );

  // Actualizar timestamps y tokens de la conversación
  db.prepare(`
    UPDATE conversations 
    SET updated_at = ?, total_tokens = total_tokens + ?
    WHERE id = ?
  `).run(now, msg.usage?.totalTokens ?? 0, msg.conversationId);

  return msg;
}
