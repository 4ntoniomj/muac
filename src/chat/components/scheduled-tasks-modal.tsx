'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ScheduledTask, TaskStatus, ScheduleType } from '@/shared/types/task';
import { ANTIGRAVITY_MODELS, findModel } from '@/shared/types/model';
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
  ArrowLeft,
  Sparkles,
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
  { label: 'Cron personalizado', value: 'custom' },
];

const QUICK_PROMPTS = [
  {
    label: 'Revisión de errores y logs',
    prompt:
      'Revisa los logs del proyecto y el estado de la aplicación. Si encuentras errores no controlados o advertencias críticas, genera un reporte detallado con soluciones propuestas.',
  },
  {
    label: 'Ejecutar suite de tests',
    prompt:
      'Ejecuta la suite completa de pruebas del proyecto (npm test o pytest) y analiza si ha ocurrido alguna regresión o fallo en el código reciente.',
  },
  {
    label: 'Auditoría de dependencias',
    prompt:
      'Verifica si existen dependencias con vulnerabilidades de seguridad conocidas o paquetes desactualizados en el proyecto y elabora un resumen ejecutivo.',
  },
  {
    label: 'Resumen de cambios git',
    prompt:
      'Analiza los últimos commits en la rama de desarrollo y genera un resumen claro de los avances técnicos y tareas completadas durante las últimas horas.',
  },
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
  const [modelId, setModelId] = useState(ANTIGRAVITY_MODELS[0]?.id || 'gemini-3.8-flash');
  const [useCurrentProject, setUseCurrentProject] = useState(Boolean(currentProjectPath));
  const [projectPathInput, setProjectPathInput] = useState(currentProjectPath || '');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Escuchar tecla Escape para cerrar modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    } else {
      setIsCreating(false);
      setDeleteConfirmId(null);
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
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
          Pausada
        </span>
      );
    }
    switch (status) {
      case 'running':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-accent/15 text-accent border border-accent/30 flex items-center gap-1.5 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            En ejecución
          </span>
        );
      case 'success':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" />
            Completada con éxito
          </span>
        );
      case 'error':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3" />
            Error en ejecución
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700">
            Pendiente
          </span>
        );
    }
  };

  const selectedModel = findModel(modelId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative max-w-5xl w-full h-[88vh] max-h-[900px] flex flex-col overflow-hidden bg-surface-elevated border border-surface-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-150 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Superior del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-sidebar/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-surface border border-surface-border flex items-center justify-center text-accent">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-white">Tareas Programadas</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface text-accent font-mono border border-surface-border">
                  {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automatiza revisiones de código, pruebas y tareas periódicas en segundo plano con la IA.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {!isCreating ? (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors active:scale-[0.98] shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva tarea</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white text-xs font-medium transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver al listado</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white text-xs font-medium transition-colors"
              title="Cerrar ventana (Esc)"
            >
              <X className="w-4 h-4" />
              <span>Cerrar</span>
              <kbd className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated border border-surface-border text-slate-400 font-mono">
                Esc
              </kbd>
            </button>
          </div>
        </div>

        {/* Cuerpo Principal del Modal */}
        {isCreating ? (
          /* Vista de Creación de Tarea Amplia y Cómoda */
          <form
            onSubmit={handleCreateTask}
            className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col gap-6"
          >
            {/* Cabecera del Formulario */}
            <div className="flex items-start justify-between pb-4 border-b border-surface-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Nueva Tarea Automatizada</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configura la frecuencia, el modelo y la instrucción que el asistente ejecutará de forma autónoma.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white text-xs font-medium transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>
            </div>

            {/* Cuadrícula de Configuración (2 columnas) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nombre identificativo */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-200">
                  Nombre identificativo:
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej: Revisión horaria de errores en tests y cobertura de código"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-surface-border text-slate-100 text-xs focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors placeholder:text-slate-500"
                />
                <p className="text-[11px] text-slate-500">
                  Un título descriptivo para identificar rápidamente la tarea en el panel.
                </p>
              </div>

              {/* Frecuencia de ejecución */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-200">
                  Frecuencia de ejecución:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                  {SCHEDULE_PRESETS.map((p) => {
                    const isSelected = schedulePreset === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setSchedulePreset(p.value)}
                        className={`px-2 py-2 rounded-lg text-xs font-mono font-medium transition-colors border text-center ${
                          isSelected
                            ? 'bg-accent text-white border-accent shadow-sm'
                            : 'bg-surface hover:bg-surface-hover text-slate-300 border-surface-border'
                        }`}
                        title={p.label}
                      >
                        {p.value === 'custom' ? 'Cron' : p.value}
                      </button>
                    );
                  })}
                </div>

                {schedulePreset === 'custom' ? (
                  <div className="pt-1.5 space-y-1">
                    <label className="block text-[11px] font-mono text-slate-400">
                      Expresión cron estándar (minuto hora día mes día-semana):
                    </label>
                    <input
                      type="text"
                      value={customCron}
                      onChange={(e) => setCustomCron(e.target.value)}
                      placeholder="0 9 * * *"
                      className="w-full px-3.5 py-2 rounded-lg bg-surface border border-surface-border text-slate-100 text-xs font-mono focus:outline-none focus:border-accent transition-colors"
                    />
                    <p className="text-[11px] text-slate-500 font-mono">
                      Ej: 0 9 * * * (a diario a las 09:00 AM) | */30 * * * * (cada 30 min)
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    {SCHEDULE_PRESETS.find((p) => p.value === schedulePreset)?.label}
                  </p>
                )}
              </div>

              {/* Modelo de Inteligencia */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-200">
                  Modelo de Inteligencia:
                </label>
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-surface-border text-slate-100 text-xs focus:outline-none focus:border-accent transition-colors cursor-pointer"
                >
                  {ANTIGRAVITY_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.group === 'gemini' ? 'Google' : '3P'}) — {(m.contextLimit / 1000).toFixed(0)}k tokens
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-surface/50 p-2.5 rounded-lg border border-surface-border">
                  <Cpu className="w-4 h-4 text-accent shrink-0" />
                  <span className="truncate">{selectedModel.description}</span>
                  <span className="ml-auto font-mono text-[10px] text-slate-400 shrink-0">
                    {(selectedModel.contextLimit / 1024).toLocaleString()}k ctx
                  </span>
                </div>
              </div>

              {/* Workspace / Directorio de trabajo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-200">
                    Workspace / Directorio de trabajo:
                  </label>
                  {currentProjectPath && (
                    <button
                      type="button"
                      onClick={() => {
                        setProjectPathInput(currentProjectPath);
                        setUseCurrentProject(true);
                      }}
                      className="text-[11px] text-accent hover:underline flex items-center gap-1"
                    >
                      Usar proyecto actual
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={projectPathInput}
                  onChange={(e) => {
                    setProjectPathInput(e.target.value);
                    setUseCurrentProject(Boolean(e.target.value.trim()));
                  }}
                  placeholder="/ruta/absoluta/al/proyecto (opcional)"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-surface-border text-slate-100 text-xs focus:outline-none focus:border-accent font-mono transition-colors placeholder:text-slate-500"
                />
                <p className="text-[11px] text-slate-500">
                  Ruta absoluta de la carpeta en la que el modelo ejecutará herramientas y lecturas de código.
                </p>
              </div>
            </div>

            {/* Prompt / Instrucción a ejecutar */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="block text-xs font-semibold text-slate-200">
                  Prompt / Instrucción a ejecutar:
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Sugerencias de prompt:
                  </span>
                  {QUICK_PROMPTS.map((qp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPrompt(qp.prompt)}
                      className="px-2.5 py-1 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white text-[11px] transition-colors"
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                required
                rows={8}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe qué debe comprobar, generar o auditar el asistente en cada ciclo de ejecución desatendido..."
                className="w-full p-4 rounded-lg bg-surface border border-surface-border text-slate-100 text-xs focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-y font-mono leading-relaxed transition-colors placeholder:text-slate-500"
              />
              <p className="text-[11px] text-slate-500">
                La IA ejecutará esta instrucción completa en cada intervalo establecido y registrará la salida para su posterior consulta.
              </p>
            </div>

            {/* Barra de Acciones del Formulario */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white text-xs font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-accent hover:bg-accent-hover text-white px-5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 shadow-sm active:scale-[0.98]"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Guardar y Programar Tarea</span>
              </button>
            </div>
          </form>
        ) : (
          /* Vista de Listado de Tareas Existentes */
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col gap-4">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                <RefreshCw className="w-7 h-7 animate-spin text-accent" />
                <span className="text-xs">Cargando tareas programadas...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center p-8 text-slate-400 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-surface border border-surface-border flex items-center justify-center text-slate-500 shadow-inner">
                  <Clock className="w-8 h-8" />
                </div>
                <div className="max-w-md">
                  <h4 className="text-sm font-semibold text-slate-200 mb-1.5">
                    No hay tareas programadas actualmente
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Automatiza revisiones periódicas de código, ejecución de pruebas, resúmenes diarios o sincronización desatendida en tus proyectos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear primera tarea programada</span>
                </button>
              </div>
            ) : (
              tasks.map((task) => {
                const isRunning = runningTaskId === task.id || task.lastStatus === 'running';
                const isExpanded = expandedResults.has(task.id);

                return (
                  <div
                    key={task.id}
                    className={`p-5 bg-surface border border-surface-border rounded-xl text-xs flex flex-col gap-3.5 transition-all ${
                      task.isEnabled
                        ? 'hover:border-surface-border-hover shadow-sm'
                        : 'opacity-65'
                    }`}
                  >
                    {/* Fila Superior: Datos de Cabecera y Acciones Rápidas */}
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-center text-accent shrink-0 mt-0.5">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h4 className="text-sm font-semibold text-slate-100 truncate">
                              {task.name}
                            </h4>
                            <span className="px-2.5 py-0.5 rounded-md bg-surface-elevated border border-surface-border text-slate-300 text-[11px] font-mono">
                              {task.scheduleType === 'cron'
                                ? `Cron: ${task.scheduleValue}`
                                : `Cada ${task.scheduleValue}`}
                            </span>
                            {getStatusBadge(task.lastStatus, task.isEnabled)}
                          </div>

                          {/* Metadatos en columnas legibles */}
                          <div className="flex items-center gap-4 text-[11px] text-slate-400 mt-1.5 flex-wrap font-mono">
                            <span className="flex items-center gap-1.5">
                              <Cpu className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-slate-300">{task.modelId}</span>
                            </span>
                            {task.projectPath && (
                              <span
                                className="flex items-center gap-1.5 truncate max-w-[280px]"
                                title={task.projectPath}
                              >
                                <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="text-slate-300">
                                  {task.projectPath.split('/').filter(Boolean).pop() || task.projectPath}
                                </span>
                              </span>
                            )}
                            {task.lastRunAt && (
                              <span className="text-slate-400">
                                Última ejecución: {formatRelativeTime(task.lastRunAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botones de Acción Rápida */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRunNow(task.id)}
                          disabled={isRunning}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors disabled:opacity-50"
                          title="Ejecutar tarea ahora"
                        >
                          {isRunning ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          <span>{isRunning ? 'Ejecutando...' : 'Ejecutar'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggle(task.id, task.isEnabled)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
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
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-500/30 transition-colors"
                          title="Eliminar tarea programada"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Prompt de la Tarea en bloque amplio */}
                    <div className="text-xs text-slate-200 bg-surface-elevated p-3.5 rounded-lg border border-surface-border font-sans leading-relaxed">
                      <span className="font-semibold text-slate-400 block mb-1 text-[10px] uppercase tracking-wider">
                        Instrucción / Prompt configurado:
                      </span>
                      <p className="whitespace-pre-wrap font-mono text-[11px] text-slate-300">
                        {task.prompt}
                      </p>
                    </div>

                    {/* Acordeón de Último Resultado de Ejecución */}
                    {task.lastResult && (
                      <div className="flex flex-col gap-2 pt-1 border-t border-surface-border">
                        <button
                          type="button"
                          onClick={() => toggleExpandResult(task.id)}
                          className="flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span>Última salida generada</span>
                            {task.lastRunAt && (
                              <span className="text-[10px] text-slate-500 font-normal">
                                ({formatRelativeTime(task.lastRunAt)})
                              </span>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="p-3.5 rounded-lg bg-canvas border border-surface-border text-xs font-mono text-slate-300 max-h-60 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
                            {task.lastResult}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Diálogo de Confirmación de Borrado */}
                    {deleteConfirmId === task.id && (
                      <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 flex items-center justify-between text-xs animate-in fade-in">
                        <div className="flex items-center gap-2 text-rose-300">
                          <AlertTriangle className="w-4 h-4" />
                          <span>¿Seguro que deseas eliminar definitivamente esta tarea programada?</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1 rounded-md bg-surface-elevated hover:bg-surface-hover border border-surface-border text-slate-300 text-xs transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(task.id)}
                            className="px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors"
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
        )}

        {/* Barra Inferior / Pie del Modal */}
        <div className="px-6 py-3 border-t border-surface-border bg-sidebar/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="hidden sm:inline">Sistema de automatización en segundo plano con IA</span>
            <span className="text-slate-500 font-mono text-[11px]">
              ({tasks.length} {tasks.length === 1 ? 'tarea registrada' : 'tareas registradas'})
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cerrar ventana</span>
          </button>
        </div>
      </div>
    </div>
  );
}
