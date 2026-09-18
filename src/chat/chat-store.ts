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
    ORDER BY c.is_pinned DESC, c.updated_at DESC
  `);
  const rows = stmt.all() as unknown as Array<{
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    model_id: string;
    total_tokens: number;
    messages_count: number;
    project_path?: string;
    is_pinned?: number;
    reasoning_effort?: 'low' | 'medium' | 'high';
  }>;

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    modelId: r.model_id,
    reasoningEffort: r.reasoning_effort || 'high',
    totalTokens: r.total_tokens,
    messagesCount: r.messages_count,
    projectPath: r.project_path || undefined,
    isPinned: Boolean(r.is_pinned),
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
    project_path?: string;
    is_pinned?: number;
    reasoning_effort?: 'low' | 'medium' | 'high';
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    modelId: row.model_id,
    reasoningEffort: row.reasoning_effort || 'high',
    totalTokens: row.total_tokens,
    projectPath: row.project_path || undefined,
    isPinned: Boolean(row.is_pinned),
  };
}

export function createConversation(
  title?: string,
  modelId: string = 'gemini-3.8-flash',
  projectPath?: string,
  reasoningEffort: 'low' | 'medium' | 'high' = 'high'
): Conversation {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const convoTitle = title || 'Nueva conversación';

  db.prepare(`
    INSERT INTO conversations (id, title, created_at, updated_at, model_id, total_tokens, project_path, reasoning_effort)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).run(id, convoTitle, now, now, modelId, projectPath || null, reasoningEffort);

  return {
    id,
    title: convoTitle,
    createdAt: now,
    updatedAt: now,
    modelId,
    reasoningEffort,
    totalTokens: 0,
    messagesCount: 0,
    projectPath: projectPath || undefined,
  };
}

export function updateConversationModelAndEffort(
  id: string,
  modelId: string,
  effort?: 'low' | 'medium' | 'high'
): boolean {
  const db = getDatabase();
  const now = new Date().toISOString();
  if (effort) {
    db.prepare('UPDATE conversations SET model_id = ?, reasoning_effort = ?, updated_at = ? WHERE id = ?').run(
      modelId,
      effort,
      now,
      id
    );
  } else {
    db.prepare('UPDATE conversations SET model_id = ?, updated_at = ? WHERE id = ?').run(
      modelId,
      now,
      id
    );
  }
  return true;
}

export function updateConversationProjectPath(id: string, projectPath: string): boolean {
  const db = getDatabase();
  db.prepare('UPDATE conversations SET project_path = ?, updated_at = ? WHERE id = ?').run(
    projectPath || null,
    new Date().toISOString(),
    id
  );
  return true;
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

export function togglePinConversation(id: string, isPinned?: boolean): boolean {
  const db = getDatabase();
  const now = new Date().toISOString();
  if (isPinned !== undefined) {
    db.prepare('UPDATE conversations SET is_pinned = ?, updated_at = ? WHERE id = ?').run(
      isPinned ? 1 : 0,
      now,
      id
    );
  } else {
    db.prepare('UPDATE conversations SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?').run(
      now,
      id
    );
  }
  return true;
}

export function bulkPinConversations(ids: string[], isPinned: boolean): boolean {
  if (!ids || ids.length === 0) return true;
  const db = getDatabase();
  const now = new Date().toISOString();
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE conversations SET is_pinned = ?, updated_at = ? WHERE id IN (${placeholders})`).run(
    isPinned ? 1 : 0,
    now,
    ...ids
  );
  return true;
}

export function bulkDeleteConversations(ids: string[], isPinned?: boolean): boolean {
  if (!ids || ids.length === 0) return true;
  const db = getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM conversations WHERE id IN (${placeholders})`).run(...ids);
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
    attachments_json?: string | null;
  }>;

  return rows.map((r) => {
    let attachments = undefined;
    if (r.attachments_json) {
      try {
        attachments = JSON.parse(r.attachments_json);
      } catch {
        attachments = undefined;
      }
    }

    return {
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
      attachments,
    };
  });
}

export function saveMessage(msg: Message): Message {
  const db = getDatabase();
  const now = msg.createdAt || new Date().toISOString();
  const attachmentsJson =
    msg.attachments && msg.attachments.length > 0 ? JSON.stringify(msg.attachments) : null;

  db.prepare(`
    INSERT INTO messages (
      id, conversation_id, role, content, created_at, duration_seconds,
      input_tokens, output_tokens, thinking_tokens, total_tokens,
      account_id, account_email, model_id, attachments_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    msg.modelId ?? null,
    attachmentsJson
  );

  // Actualizar timestamps y tokens reales de la conversación
  if (msg.usage && msg.usage.totalTokens > 0) {
    db.prepare(`
      UPDATE conversations 
      SET updated_at = ?, total_tokens = ?
      WHERE id = ?
    `).run(now, msg.usage.totalTokens, msg.conversationId);
  } else {
    db.prepare(`
      UPDATE conversations 
      SET updated_at = ?
      WHERE id = ?
    `).run(now, msg.conversationId);
  }

  return msg;
}
