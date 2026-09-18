import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getDatabase } from '@/shared/db';

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

interface ConvoSummaryMeta {
  title?: string;
  projectPath?: string;
}

/**
 * Carga metadatos de títulos y rutas de proyectos desde conversation_summaries.db de Antigravity.
 */
export function loadAntigravitySummariesMeta(): Map<string, ConvoSummaryMeta> {
  const metaMap = new Map<string, ConvoSummaryMeta>();
  const home = os.homedir();
  const summaryDbPaths = [
    path.join(home, '.gemini', 'antigravity-cli', 'conversation_summaries.db'),
    path.join(home, '.gemini', 'antigravity', 'conversation_summaries.db'),
  ];

  for (const dbPath of summaryDbPaths) {
    if (!fs.existsSync(/*turbopackIgnore: true*/ dbPath)) continue;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require('better-sqlite3');
      const sumDb = new Database(dbPath, { readonly: true });
      const rows = sumDb.prepare('SELECT conversation_id, title, workspace_uris FROM conversation_summaries').all() as Array<{
        conversation_id: string;
        title?: string;
        workspace_uris?: string;
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
        metaMap.set(row.conversation_id, {
          title: row.title?.trim() || undefined,
          projectPath: projectPath || undefined,
        });
      }
    } catch {
      // Ignorar errores al leer DB externa
    }
  }

  return metaMap;
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

      const transcriptPath = path.join(brainDir, convoId, '.system_generated', 'logs', 'transcript.jsonl');
      if (!fs.existsSync(/*turbopackIgnore: true*/ transcriptPath)) continue;

      result.totalScanned++;
      processedConvoIds.add(convoId);

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

        const summaryMeta = summariesMeta.get(convoId);
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
