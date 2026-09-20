import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { getDatabase } from '@/shared/db';
import { ensureTrajectoryInCli } from '@/chat/agy-bridge';

export interface SyncResult {
  totalScanned: number;
  conversationsImported: number;
  conversationsUpdated: number;
  messagesImported: number;
  errors: string[];
}

interface TranscriptStep {
  step_index: number;
  source?: string;
  type?: string;
  status?: string;
  created_at?: string;
  content?: string;
  thinking?: string;
  tool_calls?: unknown[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    thinking_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * Limpia el contenido de los prompts del usuario de Antigravity,
 * extrayendo el contenido relevante si viene envuelto en etiquetas como <USER_REQUEST>.
 */
export function cleanUserInputContent(rawContent: string): string {
  if (!rawContent) return '';

  // 1. Si contiene <USER_REQUEST>...</USER_REQUEST>, extraer lo que está dentro
  const userReqMatch = rawContent.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
  if (userReqMatch && userReqMatch[1]) {
    return userReqMatch[1].trim();
  }

  // 2. Si no tiene etiqueta cerrada pero empieza por <USER_REQUEST>, quitar la cabecera
  let cleaned = rawContent.replace(/<USER_REQUEST>/gi, '').trim();

  // 3. Eliminar bloques de metadatos como <ADDITIONAL_METADATA>...</ADDITIONAL_METADATA>
  cleaned = cleaned.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '').trim();

  // 4. Eliminar bloques como <CONTEXT_SUMMARY>...</CONTEXT_SUMMARY>
  cleaned = cleaned.replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/gi, '').trim();

  return cleaned || rawContent.trim();
}

/**
 * Obtiene las carpetas candidatas donde Antigravity guarda los cerebros de conversación.
 */
export function getAntigravityBrainDirs(): string[] {
  const home = os.homedir();
  const candidates = [
    path.join(home, '.gemini', 'antigravity-cli', 'brain'),
    path.join(home, '.gemini', 'antigravity', 'brain'),
  ];
  return candidates.filter((d) => fs.existsSync(/*turbopackIgnore: true*/ d));
}

export interface ConvoSummaryMeta {
  title?: string;
  projectPath?: string;
  isSubagent?: boolean;
  parentConversationId?: string;
  nestingDepth?: number;
  agentName?: string;
}

/**
 * Carga metadatos de títulos, rutas de proyectos y jerarquía de subagentes desde conversation_summaries.db de Antigravity.
 */
export function loadAntigravitySummariesMeta(): Map<string, ConvoSummaryMeta> {
  const metaMap = new Map<string, ConvoSummaryMeta>();
  const home = os.homedir();
  const summaryDbPaths = [
    path.join(home, '.gemini', 'antigravity-cli', 'conversation_summaries.db'),
    path.join(home, '.gemini', 'antigravity', 'conversation_summaries.db'),
  ];

  for (const dbPath of summaryDbPaths) {
    try {
      const sumDb = new DatabaseSync(dbPath, { readOnly: true });
      const rows = sumDb.prepare(`
        SELECT conversation_id, title, workspace_uris, parent_conversation_id, nesting_depth, agent_name
        FROM conversation_summaries
      `).all() as Array<{
        conversation_id: string;
        title?: string;
        workspace_uris?: string;
        parent_conversation_id?: string;
        nesting_depth?: number;
        agent_name?: string;
      }>;
      sumDb.close();

      for (const row of rows) {
        if (!row.conversation_id) continue;
        let projectPath: string | undefined;
        if (row.workspace_uris) {
          try {
            const uris: string[] = JSON.parse(row.workspace_uris);
            if (Array.isArray(uris) && uris.length > 0 && uris[0]) {
              const u = uris[0];
              if (u.startsWith('file://')) {
                projectPath = decodeURIComponent(u.slice(7));
              } else if (u.startsWith('/')) {
                projectPath = u;
              }
            }
          } catch {
            // Ignorar JSON inválido
          }
        }

        const isSubagent = Boolean(
          (row.parent_conversation_id && row.parent_conversation_id.trim().length > 0) ||
          (typeof row.nesting_depth === 'number' && row.nesting_depth > 0) ||
          (row.agent_name && row.agent_name.trim().length > 0)
        );

        metaMap.set(row.conversation_id, {
          title: row.title?.trim() || undefined,
          projectPath: projectPath || undefined,
          isSubagent,
          parentConversationId: row.parent_conversation_id || undefined,
          nestingDepth: row.nesting_depth || 0,
          agentName: row.agent_name || undefined,
        });
      }
    } catch {
      // Ignorar errores al leer DB externa
    }
  }

  return metaMap;
}

/**
 * Determina si una conversación corresponde a un subagente interno
 * basándose en metadatos de Antigravity o en el contenido del prompt inicial.
 */
export function isSubagentConversation(
  meta?: ConvoSummaryMeta,
  firstUserPrompt?: string
): boolean {
  if (meta?.isSubagent) return true;

  if (firstUserPrompt) {
    const trimmed = firstUserPrompt.trim();
    if (
      /^(?:Lee\s+[`'"]?(?:src\/|[a-zA-Z0-9_\-\.\/]+\/)?AGENTS\.md|Actúa como el subagente|Actua como el subagente|Tu tarea es aplicar|<SUBAGENT>|Investiga en profundidad la base de código)/i.test(
        trimmed
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Elimina de la base de datos de MUAC (muac.db) todas las conversaciones
 * y mensajes que correspondan a subagentes internos de Antigravity.
 */
export function purgeSubagentConversations(): number {
  const db = getDatabase();
  const summariesMeta = loadAntigravitySummariesMeta();

  const convos = db.prepare('SELECT id, title FROM conversations').all() as Array<{
    id: string;
    title: string;
  }>;

  const toDelete: string[] = [];

  for (const convo of convos) {
    const meta = summariesMeta.get(convo.id);
    if (meta?.isSubagent) {
      toDelete.push(convo.id);
      continue;
    }

    // Comprobar si el primer mensaje en la BD es de subagente
    const firstMsg = db.prepare(
      "SELECT content FROM messages WHERE conversation_id = ? AND role = 'user' ORDER BY created_at ASC LIMIT 1"
    ).get(convo.id) as { content?: string } | undefined;

    if (isSubagentConversation(meta, firstMsg?.content || convo.title)) {
      toDelete.push(convo.id);
    }
  }

  if (toDelete.length === 0) return 0;

  const placeholders = toDelete.map(() => '?').join(',');
  db.prepare(`DELETE FROM messages WHERE conversation_id IN (${placeholders})`).run(...toDelete);
  db.prepare(`DELETE FROM conversations WHERE id IN (${placeholders})`).run(...toDelete);

  return toDelete.length;
}

/**
 * Escanea y sincroniza todas las conversaciones de Antigravity con MUAC.
 */
export async function syncAntigravityConversations(): Promise<SyncResult> {
  const brainDirs = getAntigravityBrainDirs();
  const summariesMeta = loadAntigravitySummariesMeta();
  const db = getDatabase();

  const result: SyncResult = {
    totalScanned: 0,
    conversationsImported: 0,
    conversationsUpdated: 0,
    messagesImported: 0,
    errors: [],
  };

  const processedConvoIds = new Set<string>();

  // 1. Purgar previamente cualquier conversación de subagentes existente en muac.db
  purgeSubagentConversations();

  for (const brainDir of brainDirs) {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(/*turbopackIgnore: true*/ brainDir);
    } catch (readErr) {
      result.errors.push(`Error al leer directorio ${brainDir}: ${(readErr as Error).message}`);
      continue;
    }

    for (const convoId of entries) {
      if (processedConvoIds.has(convoId)) continue;

      const summaryMeta = summariesMeta.get(convoId);
      // Omitir subagentes identificados por metadatos (parent_conversation_id, nesting_depth, agent_name)
      if (summaryMeta?.isSubagent) {
        continue;
      }

      const transcriptPath = path.join(brainDir, convoId, '.system_generated', 'logs', 'transcript.jsonl');
      if (!fs.existsSync(/*turbopackIgnore: true*/ transcriptPath)) continue;

      result.totalScanned++;
      processedConvoIds.add(convoId);
      ensureTrajectoryInCli(convoId);

      try {
        const fileContent = fs.readFileSync(/*turbopackIgnore: true*/ transcriptPath, 'utf-8');
        const lines = fileContent.split('\n').filter((l) => l.trim().length > 0);
        if (lines.length === 0) continue;

        const parsedMessages: Array<{
          id: string;
          role: 'user' | 'assistant';
          content: string;
          createdAt: string;
          stepIndex: number;
          inputTokens?: number;
          outputTokens?: number;
          thinkingTokens?: number;
          totalTokens?: number;
        }> = [];

        let firstUserPrompt = '';
        let earliestTimestamp = '';
        let latestTimestamp = '';
        let accumulatedTokens = 0;

        for (const line of lines) {
          try {
            const step: TranscriptStep = JSON.parse(line);
            const createdAt = step.created_at || new Date().toISOString();

            if (!earliestTimestamp) earliestTimestamp = createdAt;
            latestTimestamp = createdAt;

            if (step.usage && step.usage.total_tokens) {
              accumulatedTokens = step.usage.total_tokens;
            }

            // Mensaje de usuario
            if (step.type === 'USER_INPUT') {
              const cleaned = cleanUserInputContent(step.content || '');
              if (cleaned.length > 0) {
                if (!firstUserPrompt) firstUserPrompt = cleaned;
                parsedMessages.push({
                  id: `msg_${convoId}_step_${step.step_index}`,
                  role: 'user',
                  content: cleaned,
                  createdAt,
                  stepIndex: step.step_index,
                });
              }
            } else if (
              (step.type === 'PLANNER_RESPONSE' || step.source === 'MODEL') &&
              step.content &&
              step.content.trim().length > 0
            ) {
              // Respuesta textual del asistente
              parsedMessages.push({
                id: `msg_${convoId}_step_${step.step_index}`,
                role: 'assistant',
                content: step.content.trim(),
                createdAt,
                stepIndex: step.step_index,
                inputTokens: step.usage?.input_tokens,
                outputTokens: step.usage?.output_tokens,
                thinkingTokens: step.usage?.thinking_tokens,
                totalTokens: step.usage?.total_tokens,
              });
            }
          } catch {
            // Ignorar líneas individuales malformadas en JSONL
          }
        }

        if (parsedMessages.length === 0) continue;

        // Omitir si el contenido inicial corresponde a una sesión de subagente
        if (isSubagentConversation(summaryMeta, firstUserPrompt)) {
          continue;
        }

        const convoProjectPath = summaryMeta?.projectPath || null;

        // Determinar título
        let convoTitle = summaryMeta?.title || '';
        if (!convoTitle && firstUserPrompt) {
          const singleLine = firstUserPrompt.split('\n')[0].replace(/^[#\s*-]+/, '').trim();
          convoTitle = singleLine.slice(0, 45) + (singleLine.length > 45 ? '...' : '');
        }
        if (!convoTitle) {
          convoTitle = 'Conversación de Antigravity';
        }

        const convoCreatedAt = earliestTimestamp || new Date().toISOString();
        const convoUpdatedAt = latestTimestamp || convoCreatedAt;

        // Comprobar si ya existe la conversación en la base de datos de MUAC
        const existingConvo = db.prepare('SELECT id, is_pinned FROM conversations WHERE id = ?').get(convoId) as
          | { id: string; is_pinned: number }
          | undefined;

        if (!existingConvo) {
          db.prepare(`
            INSERT INTO conversations (
              id, title, created_at, updated_at, model_id, total_tokens, is_pinned, reasoning_effort, project_path
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
          `).run(
            convoId,
            convoTitle,
            convoCreatedAt,
            convoUpdatedAt,
            'gemini-3.8-flash',
            accumulatedTokens,
            'high',
            convoProjectPath
          );
          result.conversationsImported++;
        } else {
          db.prepare(`
            UPDATE conversations
            SET updated_at = ?,
                total_tokens = MAX(total_tokens, ?),
                title = CASE WHEN (title IS NULL OR title = 'Conversación de Antigravity' OR title = 'Nueva conversación') AND ? != '' THEN ? ELSE title END,
                project_path = COALESCE(project_path, ?)
            WHERE id = ?
          `).run(convoUpdatedAt, accumulatedTokens, convoTitle, convoTitle, convoProjectPath, convoId);
          result.conversationsUpdated++;
        }

        // Insertar mensajes sin duplicados
        const insertMsgStmt = db.prepare(`
          INSERT INTO messages (
            id, conversation_id, role, content, created_at,
            input_tokens, output_tokens, thinking_tokens, total_tokens
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const msg of parsedMessages) {
          const msgExists = db.prepare('SELECT id FROM messages WHERE id = ?').get(msg.id);
          if (!msgExists) {
            insertMsgStmt.run(
              msg.id,
              convoId,
              msg.role,
              msg.content,
              msg.createdAt,
              msg.inputTokens || 0,
              msg.outputTokens || 0,
              msg.thinkingTokens || 0,
              msg.totalTokens || 0
            );
            result.messagesImported++;
          }
        }
      } catch (convoErr) {
        result.errors.push(`Error al sincronizar conversación ${convoId}: ${(convoErr as Error).message}`);
      }
    }
  }

  return result;
}
