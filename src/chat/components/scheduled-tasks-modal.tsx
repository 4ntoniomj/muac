'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ScheduledTask, TaskStatus, ScheduleType } from '@/shared/types/task';
import { ANTIGRAVITY_MODELS } from '@/shared/types/model';
import { formatRelativeTime } from '@/shared/time-utils';
import {
  Clock,
  Plus,
  Play,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Folder,
  Cpu,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';

interface ScheduledTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectPath?: string;
}

const SCHEDULE_PRESETS = [
  { label: 'Cada 15 minutos', value: '15m' },
  { label: 'Cada 30 minutos', value: '30m' },
  { label: 'Cada 1 hora', value: '1h' },
  { label: 'Cada 6 horas', value: '6h' },
  { label: 'Cada 12 horas', value: '12h' },
  { label: 'Cada 24 horas (Diario)', value: '24h' },
  { label: 'Cron personalizado...', value: 'custom' },
];

export function ScheduledTasksModal({
  isOpen,
  onClose,
  currentProjectPath,
}: ScheduledTasksModalProps) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  // Formulario de nueva tarea
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [schedulePreset, setSchedulePreset] = useState('1h');
  const [customCron, setCustomCron] = useState('0 9 * * *');
  const [modelId, setModelId] = useState('gemini-3.8-flash-high');
  const [useCurrentProject, setUseCurrentProject] = useState(Boolean(currentProjectPath));
  const [projectPathInput, setProjectPathInput] = useState(currentProjectPath || '');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.success && data.tasks) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error('Error cargando tareas programadas:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchTasks();
      if (currentProjectPath) {
        setProjectPathInput(currentProjectPath);
        setUseCurrentProject(true);
      }
    }
  }, [isOpen, currentProjectPath, fetchTasks]);

  if (!isOpen) return null;

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) return;

    const scheduleType: ScheduleType = schedulePreset === 'custom' ? 'cron' : 'interval';
    const scheduleValue = schedulePreset === 'custom' ? customCron.trim() : schedulePreset;
    const finalProjectPath = useCurrentProject ? projectPathInput.trim() : undefined;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          prompt: prompt.trim(),
          scheduleType,
          scheduleValue,
          modelId,
          projectPath: finalProjectPath || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsCreating(false);
        setName('');
        setPrompt('');
        await fetchTasks();
      } else {
        alert(data.error || 'Error al crear la tarea programada');
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleRunNow = async (taskId: string) => {
    setRunningTaskId(taskId);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_now', id: taskId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchTasks();
      } else {
        alert(data.error || 'Error en la ejecución de la tarea');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRunningTaskId(null);
    }
  };

  const handleToggle = async (taskId: string, currentEnabled: boolean) => {
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id: taskId, isEnabled: !currentEnabled }),
      });
      await fetchTasks();
    } catch (err) {
      console.error('Error al conmutar tarea:', err);
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks?id=${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setDeleteConfirmId(null);
        await fetchTasks();
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const toggleExpandResult = (taskId: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const getStatusBadge = (status: TaskStatus, isEnabled: boolean) => {
    if (!isEnabled) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
          Pausada
        </span>
      );
    }
    switch (status) {
      case 'running':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/15 text-accent border border-accent/30 flex items-center gap-1 animate-pulse">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            En ejecución
          </span>
        );
      case 'success':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Éxito
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <AlertCircle className="w-2.5 h-2.5" />
            Error
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700">
            Pendiente
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative bg-surface-elevated border border-surface-border rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150 select-none">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-border bg-sidebar/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface border border-surface-border flex items-center justify-center text-accent">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Tareas Programadas</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface text-accent font-mono border border-surface-border">
                  {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Programa ejecuciones periódicas desatendidas con la IA en tus proyectos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(!isCreating)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreating ? 'Cancelar' : 'Nueva tarea'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-surface-hover transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Formulario de Alta de Tarea */}
        {isCreating && (
          <form
            onSubmit={handleCreateTask}
            className="p-3 m-4 bg-surface border border-surface-border rounded-lg text-xs flex flex-col gap-3 animate-in slide-in-from-top-2 duration-150"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-accent" />
                <span>Configurar nueva tarea programada</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Nombre identificativo:
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej: Revisión horaria de errores en tests"
                  className="w-full px-3 py-1.5 rounded-md bg-surface-elevated border border-surface-border text-slate-200 text-xs focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Frecuencia de ejecución:
                </label>
                <select
                  value={schedulePreset}
                  onChange={(e) => setSchedulePreset(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md bg-surface-elevated border border-surface-border text-slate-200 text-xs focus:outline-none focus:border-accent transition-colors"
                >
                  {SCHEDULE_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {schedulePreset === 'custom' && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Expresión cron (minuto hora día mes día-semana):
                </label>
                <input
                  type="text"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="0 9 * * *"
                  className="w-full px-3 py-1.5 rounded-md bg-surface-elevated border border-surface-border text-slate-200 text-xs font-mono focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Modelo de Inteligencia:
                </label>
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md bg-surface-elevated border border-surface-border text-slate-200 text-xs focus:outline-none focus:border-accent transition-colors"
                >
                  {ANTIGRAVITY_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.group === 'gemini' ? 'Google' : '3P'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Workspace / Directorio:
                </label>
                <input
                  type="text"
                  value={projectPathInput}
                  onChange={(e) => setProjectPathInput(e.target.value)}
                  placeholder="Ruta local (opcional)"
                  className="w-full px-3 py-1.5 rounded-md bg-surface-elevated border border-surface-border text-slate-200 text-xs focus:outline-none focus:border-accent font-mono transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Prompt / Instrucción a ejecutar:
              </label>
              <textarea
                required
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe qué debe comprobar, generar o revisar el asistente en cada ejecución..."
                className="w-full px-3 py-2 rounded-md bg-surface-elevated border border-surface-border text-slate-200 text-xs focus:outline-none focus:border-accent resize-none font-sans transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 rounded-md bg-surface-elevated hover:bg-surface-hover border border-surface-border text-slate-300 text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white font-semibold text-xs transition-colors"
              >
                Guardar tarea
              </button>
            </div>
          </form>
        )}

        {/* Lista de Tareas Existentes */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-accent" />
              <span className="text-xs">Cargando tareas programadas...</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center p-6 text-slate-400 gap-3">
              <div className="w-12 h-12 rounded-xl bg-surface border border-surface-border flex items-center justify-center text-slate-500">
                <Clock className="w-6 h-6" />
              </div>
              <div className="max-w-sm">
                <h4 className="text-xs font-semibold text-slate-200 mb-1">
                  No hay tareas programadas
                </h4>
                <p className="text-[11px] text-slate-400">
                  Crea tu primera tarea programada para automatizar revisiones de código, resúmenes diarios o sincronización desatendida.
                </p>
              </div>
            </div>
          ) : (
            tasks.map((task) => {
              const isRunning = runningTaskId === task.id || task.lastStatus === 'running';
              const isExpanded = expandedResults.has(task.id);

              return (
                <div
                  key={task.id}
                  className={`p-3 bg-surface border border-surface-border rounded-lg text-xs flex flex-col gap-2.5 transition-colors ${
                    task.isEnabled
                      ? 'hover:border-surface-border-hover'
                      : 'opacity-65'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-md bg-surface-elevated border border-surface-border flex items-center justify-center text-accent shrink-0 mt-0.5">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-semibold text-slate-100 truncate">
                            {task.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md bg-surface-elevated border border-surface-border text-slate-300 text-[10px] font-mono">
                            {task.scheduleType === 'cron'
                              ? `Cron: ${task.scheduleValue}`
                              : `Cada ${task.scheduleValue}`}
                          </span>
                          {getStatusBadge(task.lastStatus, task.isEnabled)}
                        </div>

                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1 flex-wrap font-mono">
                          <span className="flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-slate-500" />
                            <span>{task.modelId}</span>
                          </span>
                          {task.projectPath && (
                            <span className="flex items-center gap-1 truncate max-w-[160px]" title={task.projectPath}>
                              <Folder className="w-3 h-3 text-slate-400" />
                              <span>{task.projectPath.split('/').filter(Boolean).pop()}</span>
                            </span>
                          )}
                          {task.lastRunAt && (
                            <span>Última vez: {formatRelativeTime(task.lastRunAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Acciones de la Tarea */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRunNow(task.id)}
                        disabled={isRunning}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium transition-colors disabled:opacity-50"
                        title="Ejecutar tarea ahora"
                      >
                        {isRunning ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        <span>{isRunning ? 'Ejecutando...' : 'Ejecutar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggle(task.id, task.isEnabled)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border ${
                          task.isEnabled
                            ? 'bg-surface-elevated hover:bg-surface-hover text-slate-300 border-surface-border'
                            : 'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25'
                        }`}
                      >
                        {task.isEnabled ? 'Pausar' : 'Activar'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(task.id)}
                        className="p-1 rounded-md hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Eliminar tarea programada"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Prompt de la Tarea */}
                  <div className="text-[11px] text-slate-300 bg-surface-elevated p-2.5 rounded-md border border-surface-border font-sans leading-relaxed">
                    <span className="font-semibold text-slate-400 block mb-0.5 text-[10px]">
                      Instrucción / Prompt:
                    </span>
                    {task.prompt}
                  </div>

                  {/* Último Resultado de Ejecución */}
                  {task.lastResult && (
                    <div className="flex flex-col gap-1 pt-1 border-t border-surface-border">
                      <button
                        type="button"
                        onClick={() => toggleExpandResult(task.id)}
                        className="flex items-center justify-between text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        <span className="font-semibold">Última salida generada</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="p-2.5 rounded-md bg-canvas border border-surface-border text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap select-text">
                          {task.lastResult}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Diálogo de Confirmación de Borrado */}
                  {deleteConfirmId === task.id && (
                    <div className="p-2.5 rounded-md bg-rose-950/20 border border-rose-500/30 flex items-center justify-between text-xs animate-in fade-in">
                      <div className="flex items-center gap-1.5 text-rose-300">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>¿Eliminar definitivamente esta tarea programada?</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-0.5 rounded-md bg-surface-elevated hover:bg-surface-hover border border-surface-border text-slate-300 text-[10px] transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(task.id)}
                          className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[10px] transition-colors"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
