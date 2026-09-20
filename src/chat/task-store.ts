import crypto from 'node:crypto';
import { getDatabase } from '@/shared/db';
import type { ScheduledTask, CreateTaskInput, TaskStatus, ScheduleType } from '@/shared/types/task';
import { streamPromptWithAgy } from './agy-bridge';

interface ScheduledTaskRow {
  id: string;
  name: string;
  prompt: string;
  schedule_type: string;
  schedule_value: string;
  model_id: string;
  project_path: string | null;
  is_enabled: number;
  last_run_at: string | null;
  last_status: string;
  last_result: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: ScheduledTaskRow): ScheduledTask {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    scheduleType: row.schedule_type as ScheduleType,
    scheduleValue: row.schedule_value,
    modelId: row.model_id,
    projectPath: row.project_path || undefined,
    isEnabled: Boolean(row.is_enabled),
    lastRunAt: row.last_run_at,
    lastStatus: (row.last_status as TaskStatus) || 'idle',
    lastResult: row.last_result,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listScheduledTasks(): ScheduledTask[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC').all() as unknown as ScheduledTaskRow[];
  return rows.map(rowToTask);
}

export function getScheduledTaskById(id: string): ScheduledTask | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id) as unknown as ScheduledTaskRow | undefined;
  return row ? rowToTask(row) : null;
}

export function createScheduledTask(input: CreateTaskInput): ScheduledTask {
  const db = getDatabase();
  const id = `task_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  const scheduleType = input.scheduleType || 'interval';
  const scheduleValue = input.scheduleValue || '1h';
  const modelId = input.modelId || 'gemini-3.8-flash-high';

  db.prepare(`
    INSERT INTO scheduled_tasks (
      id, name, prompt, schedule_type, schedule_value,
      model_id, project_path, is_enabled, last_run_at,
      last_status, last_result, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, 'idle', NULL, ?, ?)
  `).run(
    id,
    input.name.trim(),
    input.prompt.trim(),
    scheduleType,
    scheduleValue.trim(),
    modelId,
    input.projectPath || null,
    now,
    now
  );

  return getScheduledTaskById(id)!;
}

export function updateScheduledTask(id: string, partial: Partial<ScheduledTask>): ScheduledTask | null {
  const db = getDatabase();
  const current = getScheduledTaskById(id);
  if (!current) return null;

  const now = new Date().toISOString();
  const name = partial.name !== undefined ? partial.name.trim() : current.name;
  const prompt = partial.prompt !== undefined ? partial.prompt.trim() : current.prompt;
  const scheduleType = partial.scheduleType || current.scheduleType;
  const scheduleValue = partial.scheduleValue !== undefined ? partial.scheduleValue.trim() : current.scheduleValue;
  const modelId = partial.modelId || current.modelId;
  const projectPath = partial.projectPath !== undefined ? partial.projectPath : current.projectPath;
  const isEnabled = partial.isEnabled !== undefined ? (partial.isEnabled ? 1 : 0) : (current.isEnabled ? 1 : 0);

  db.prepare(`
    UPDATE scheduled_tasks SET
      name = ?,
      prompt = ?,
      schedule_type = ?,
      schedule_value = ?,
      model_id = ?,
      project_path = ?,
      is_enabled = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    name,
    prompt,
    scheduleType,
    scheduleValue,
    modelId,
    projectPath || null,
    isEnabled,
    now,
    id
  );

  return getScheduledTaskById(id);
}

export function toggleScheduledTask(id: string, isEnabled: boolean): ScheduledTask | null {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare('UPDATE scheduled_tasks SET is_enabled = ?, updated_at = ? WHERE id = ?').run(
    isEnabled ? 1 : 0,
    now,
    id
  );
  return getScheduledTaskById(id);
}

export function deleteScheduledTask(id: string): boolean {
  const db = getDatabase();
  const info = db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id);
  return info.changes > 0;
}

export async function executeScheduledTaskNow(id: string): Promise<ScheduledTask> {
  const db = getDatabase();
  const task = getScheduledTaskById(id);
  if (!task) {
    throw new Error(`Tarea con id ${id} no encontrada`);
  }

  // Marcar en ejecución
  const startIso = new Date().toISOString();
  db.prepare("UPDATE scheduled_tasks SET last_status = 'running', updated_at = ? WHERE id = ?").run(
    startIso,
    id
  );

  let outputText = '';
  try {
    const generator = streamPromptWithAgy(
      task.prompt,
      task.modelId,
      `cron_${id.slice(-8)}`,
      undefined,
      {
        projectPath: task.projectPath,
        agentMode: 'accept-edits',
        dangerouslySkipPermissions: true,
      }
    );

    for await (const chunk of generator) {
      if (chunk.type === 'delta' && chunk.text) {
        outputText += chunk.text;
      }
    }

    const endIso = new Date().toISOString();
    const truncatedResult = outputText.trim().slice(0, 3000) || 'Ejecución completada sin salida textual.';

    db.prepare(`
      UPDATE scheduled_tasks SET
        last_run_at = ?,
        last_status = 'success',
        last_result = ?,
        updated_at = ?
      WHERE id = ?
    `).run(endIso, truncatedResult, endIso, id);
  } catch (err) {
    const endIso = new Date().toISOString();
    const errorMsg = (err as Error).message || 'Fallo desconocido en la ejecución de la tarea';

    db.prepare(`
      UPDATE scheduled_tasks SET
        last_run_at = ?,
        last_status = 'error',
        last_result = ?,
        updated_at = ?
      WHERE id = ?
    `).run(endIso, errorMsg, endIso, id);
  }

  return getScheduledTaskById(id)!;
}
