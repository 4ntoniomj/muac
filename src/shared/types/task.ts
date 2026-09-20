export type ScheduleType = 'interval' | 'cron';

export type TaskStatus = 'idle' | 'running' | 'success' | 'error';

export interface ScheduledTask {
  id: string;
  name: string;
  prompt: string;
  scheduleType: ScheduleType;
  scheduleValue: string; // '15m', '30m', '1h', '6h', '12h', '24h' o expresión cron '0 9 * * *'
  modelId: string;
  projectPath?: string;
  isEnabled: boolean;
  lastRunAt?: string | null;
  lastStatus: TaskStatus;
  lastResult?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  name: string;
  prompt: string;
  scheduleType?: ScheduleType;
  scheduleValue: string;
  modelId?: string;
  projectPath?: string;
}
