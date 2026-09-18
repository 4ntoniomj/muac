'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { Conversation } from '@/shared/types/chat';
import { formatRelativeTime } from '@/shared/time-utils';
import {
  Plus,
  Trash2,
  Settings,
  Pin,
  CheckSquare,
  Square,
  AlertTriangle,
  X,
  RefreshCw,
  Folder,
  FolderOpen,
  History,
  Clock,
  SlidersHorizontal,
  FolderPlus,
} from 'lucide-react';

export interface ProjectItem {
  id: string;
  name: string;
  path: string;
  conversationsCount?: number;
}

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: (projectPath?: string) => void;
  onDeleteConversation: (id: string) => Promise<void> | void;
  onTogglePinConversation: (id: string, isPinned?: boolean) => Promise<void> | void;
  onBulkPin: (ids: string[], isPinned: boolean) => Promise<void> | void;
  onBulkDelete: (ids: string[]) => Promise<void> | void;
  onOpenSettings: () => void;
  activeAccountEmail?: string;
  onSyncAntigravity?: () => Promise<void> | void;
  isSyncing?: boolean;
}

export function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onTogglePinConversation,
  onBulkPin,
  onBulkDelete,
  onOpenSettings,
  activeAccountEmail,
  onSyncAntigravity,
  isSyncing = false,
}: SidebarProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    ids: string[];
    title: string;
  } | null>(null);

  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [registeredProjects, setRegisteredProjects] = useState<ProjectItem[]>([]);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');

  // Cargar proyectos registrados desde la API
  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects');
        const data = await res.json();
        if (data.success && data.projects) {
          setRegisteredProjects(data.projects);
        }
      } catch (err) {
        console.error('Error al cargar proyectos:', err);
      }
    }
    fetchProjects();
  }, [conversations.length]);

  const allSelected = conversations.length > 0 && selectedIds.size === conversations.length;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      setIsSelectMode(false);
    } else {
      setSelectedIds(new Set(conversations.map((c) => c.id)));
      setIsSelectMode(true);
    }
  };

  const handleToggleSelectOne = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) setIsSelectMode(false);
      } else {
        next.add(id);
        setIsSelectMode(true);
      }
      return next;
    });
  };

  const handleRequestSingleDelete = (convo: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      ids: [convo.id],
      title: convo.title,
    });
  };

  const handleRequestBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      isOpen: true,
      ids: Array.from(selectedIds),
      title: `${selectedIds.size} conversaciones`,
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmModal || confirmModal.ids.length === 0) return;
    const idsToDelete = confirmModal.ids;
    setConfirmModal(null);

    if (idsToDelete.length === 1) {
      await onDeleteConversation(idsToDelete[0]);
    } else {
      await onBulkDelete(idsToDelete);
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      idsToDelete.forEach((id) => next.delete(id));
      if (next.size === 0) setIsSelectMode(false);
      return next;
    });
  };

  const handleBulkPin = async (isPinned: boolean) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await onBulkPin(ids, isPinned);
    setSelectedIds(new Set());
    setIsSelectMode(false);
  };

  const handleCreateNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectPath.trim()) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim(), path: newProjectPath.trim() }),
      });
      const data = await res.json();
      if (data.success && data.project) {
        setRegisteredProjects((prev) => [...prev, data.project]);
        setNewProjectName('');
        setNewProjectPath('');
        setIsAddingProject(false);
      }
    } catch (err) {
      console.error('Error al registrar proyecto:', err);
    }
  };

  // Normalizador de ruta de proyecto para emparejar
  const normalizePath = (p?: string | null) => {
    if (!p) return '';
    return p.trim().replace(/\/+$/, '');
  };

  // 1. Separación de conversaciones según la lógica de Antigravity:
  // - Proyectos: conversaciones que pertenecen a un workspace conocido
  // - Standalone (Conversations): conversaciones sin proyecto o marcadas como outside-of-project
  const { standaloneConversations, projectMap } = useMemo(() => {
    const standalone: Conversation[] = [];
    const pMap = new Map<string, Conversation[]>();

    for (const c of conversations) {
      const rawPath = c.projectPath ? c.projectPath.trim() : '';
      if (!rawPath || rawPath === 'outside-of-project' || rawPath === 'undefined') {
        standalone.push(c);
      } else {
        const norm = normalizePath(rawPath);
        // Si pertenece a la ruta personal CLI y existe CLI Project
        let key = norm;
        if (norm === '/home/antonio') {
          key = 'default-cli-project';
        }

        if (!pMap.has(key)) {
          pMap.set(key, []);
        }
        pMap.get(key)!.push(c);
      }
    }

    return { standaloneConversations: standalone, projectMap: pMap };
  }, [conversations]);

  // Lista consolidada de proyectos mostrados (incluyendo los que tienen 0 conversaciones)
  const displayProjects = useMemo(() => {
    const list: Array<{ id: string; name: string; path: string; convos: Conversation[] }> = [];
    const seenPaths = new Set<string>();

    // Primero los proyectos registrados oficialmente
    for (const p of registeredProjects) {
      const norm = normalizePath(p.path);
      seenPaths.add(norm);
      const convos = projectMap.get(norm) || projectMap.get(p.path) || [];
      list.push({
        id: p.id,
        name: p.name,
        path: p.path,
        convos,
      });
    }

    // Añadir cualquier otro proyecto que aparezca en las conversaciones pero no esté en registeredProjects
    projectMap.forEach((convos, pathKey) => {
      if (!seenPaths.has(pathKey) && pathKey !== 'default-cli-project') {
        const parts = pathKey.split('/').filter(Boolean);
        const name = parts[parts.length - 1] || pathKey;
        list.push({
          id: 'proj_' + pathKey,
          name,
          path: pathKey,
          convos,
        });
      }
    });

    return list;
  }, [registeredProjects, projectMap]);

  const toggleProjectCollapse = (key: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <aside className="w-64 h-full bg-[#111317] border-r border-[#1e222b] flex flex-col select-none shrink-0 relative font-sans text-xs">
      {/* Botón Principal: + New Conversation */}
      <div className="p-3">
        <button
          type="button"
          onClick={() => onNewConversation()}
          className="w-full flex items-center justify-start gap-2.5 py-2 px-3.5 rounded-xl bg-[#1a1d24] hover:bg-[#222731] border border-[#262c37] text-slate-200 hover:text-white text-xs font-medium shadow-sm transition-all active:scale-[0.99]"
        >
          <Plus className="w-4 h-4 text-slate-400" />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Navegación Superior: Conversation History y Scheduled Tasks */}
      <div className="px-3 pb-2 flex flex-col gap-0.5 border-b border-[#1e222b]/80">
        <button
          type="button"
          onClick={handleToggleSelectAll}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1a1d24] transition-colors text-xs text-left"
        >
          <History className="w-3.5 h-3.5 text-slate-400" />
          <span>Conversation History</span>
        </button>

        <button
          type="button"
          onClick={() => alert('Scheduled Tasks: No hay tareas programadas en curso.')}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1a1d24] transition-colors text-xs text-left"
        >
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Scheduled Tasks</span>
        </button>
      </div>

      {/* Acciones en Lote cuando hay conversaciones seleccionadas */}
      {selectedIds.size > 0 && (
        <div className="p-2 mx-2 my-1.5 rounded-xl bg-blue-950/80 border border-blue-500/40 shadow-xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between text-[11px] text-blue-200 px-1">
            <span className="font-semibold">{selectedIds.size} seleccionados</span>
            <button
              type="button"
              onClick={() => {
                setSelectedIds(new Set());
                setIsSelectMode(false);
              }}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => handleBulkPin(true)}
              className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 text-[10px] text-blue-200"
            >
              <Pin className="w-2.5 h-2.5" />
              <span>Anclar</span>
            </button>
            <button
              type="button"
              onClick={() => handleBulkPin(false)}
              className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
            >
              <span>Desanclar</span>
            </button>
            <button
              type="button"
              onClick={handleRequestBulkDelete}
              className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-[10px] text-red-300"
            >
              <Trash2 className="w-2.5 h-2.5" />
              <span>Eliminar</span>
            </button>
          </div>
        </div>
      )}

      {/* Formulario emergente para añadir un nuevo proyecto */}
      {isAddingProject && (
        <form onSubmit={handleCreateNewProject} className="p-3 mx-2 my-1.5 rounded-xl bg-[#1a1d24] border border-[#2a303c] flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
            <span>Nuevo Proyecto Workspace</span>
            <button type="button" onClick={() => setIsAddingProject(false)} className="text-slate-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Nombre (ej. nuevo-proyecto)"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            className="px-2 py-1 rounded bg-[#111317] border border-[#2a303c] text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <input
            type="text"
            placeholder="Ruta absoluta (ej. /home/antonio/...)"
            value={newProjectPath}
            onChange={(e) => setNewProjectPath(e.target.value)}
            className="px-2 py-1 rounded bg-[#111317] border border-[#2a303c] text-slate-200 text-xs focus:outline-none focus:border-blue-500"
          />
          <div className="flex justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingProject(false)}
              className="px-2 py-1 rounded text-slate-400 hover:text-white text-[10px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[10px]"
            >
              Añadir
            </button>
          </div>
        </form>
      )}

      {/* Área Central con Scroll: Projects y Conversations */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-4">
        {/* SECCIÓN 1: PROJECTS */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-1 py-1 text-slate-400 text-xs font-medium">
            <span>Projects</span>
            <div className="flex items-center gap-2 text-slate-500">
              <button
                type="button"
                onClick={() => setIsSelectMode(!isSelectMode)}
                className="hover:text-slate-300 transition-colors"
                title="Filtrar / Selección múltiple"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsAddingProject(true)}
                className="hover:text-slate-300 transition-colors"
                title="Añadir nuevo proyecto"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Carpetas de Proyectos */}
          <div className="flex flex-col gap-1 mt-0.5">
            {displayProjects.map((project) => {
              const isCollapsed = collapsedProjects.has(project.name);
              return (
                <div key={project.id} className="flex flex-col">
                  {/* Fila del Proyecto / Carpeta */}
                  <button
                    type="button"
                    onClick={() => toggleProjectCollapse(project.name)}
                    className="flex items-center justify-between px-1.5 py-1 text-slate-400 hover:text-slate-200 transition-colors rounded-lg group text-left"
                    title={project.path}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isCollapsed ? (
                        <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      ) : (
                        <FolderOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="font-normal text-slate-300 truncate text-[13px]">
                        {project.name}
                      </span>
                    </div>
                  </button>

                  {/* Lista de Conversaciones bajo el proyecto */}
                  {!isCollapsed && (
                    <div className="flex flex-col gap-0.5 ml-2 pl-2 border-l border-[#1f242e]">
                      {project.convos.length === 0 ? (
                        <div className="py-1 text-slate-500 text-[11px] italic">
                          No conversations yet
                        </div>
                      ) : (
                        project.convos.map((convo) => renderConversationItem(convo))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SECCIÓN 2: CONVERSATIONS (Globales / Sin Proyecto) */}
        <div className="flex flex-col gap-1 pt-1 border-t border-[#1e222b]/80">
          <div className="flex items-center justify-between px-1 py-1 text-slate-400 text-xs font-medium">
            <span>Conversations</span>
            <button
              type="button"
              onClick={() => onNewConversation('outside-of-project')}
              className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
              title="Nueva conversación sin proyecto"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-0.5 mt-0.5">
            {standaloneConversations.length === 0 ? (
              <div className="px-1 py-1 text-slate-500 text-[11px] italic">
                No conversations yet
              </div>
            ) : (
              standaloneConversations.map((convo) => renderConversationItem(convo))
            )}
          </div>
        </div>
      </div>

      {/* Pie del Sidebar: Cuenta activa y Botón Settings */}
      <div className="p-3 border-t border-[#1e222b] bg-[#111317] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {activeAccountEmail ? (
            <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[#1a1d24] border border-[#262c37] text-[11px] min-w-0 flex-1 mr-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-slate-300 truncate font-mono">{activeAccountEmail}</span>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">Sin cuenta activa</div>
          )}

          {onSyncAntigravity && (
            <button
              type="button"
              onClick={onSyncAntigravity}
              disabled={isSyncing}
              className="p-1.5 rounded-lg bg-[#1a1d24] hover:bg-[#222731] text-slate-400 hover:text-white border border-[#262c37] transition-all shrink-0"
              title="Sincronizar con Antigravity Desktop"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#1a1d24]/60 hover:bg-[#1a1d24] text-slate-300 hover:text-white transition-all text-xs font-medium border border-[#262c37]"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Configuración</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Pool / Permisos</span>
        </button>
      </div>

      {/* Modal de Confirmación para Eliminación */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1a1d24] border border-[#2a303c] rounded-2xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Eliminar conversación</h3>
                <p className="text-[11px] text-slate-400">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ¿Estás seguro de que deseas eliminar permanentemente{' '}
              <span className="font-semibold text-white">«{confirmModal.title}»</span>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#262c37]">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );

  function renderConversationItem(convo: Conversation) {
    const isActive = convo.id === activeConversationId;
    const isSelected = selectedIds.has(convo.id);
    const relTime = formatRelativeTime(convo.updatedAt || convo.createdAt);

    return (
      <div
        key={convo.id}
        className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-all text-xs ${
          isActive
            ? 'bg-[#222731] text-white font-normal shadow-sm'
            : isSelected
            ? 'bg-blue-900/40 text-blue-200'
            : 'text-slate-300 hover:text-white hover:bg-[#1a1d24]/70'
        }`}
        onClick={() => {
          if (isSelectMode) {
            handleToggleSelectOne(convo.id);
          } else {
            onSelectConversation(convo.id);
          }
        }}
      >
        <div className="flex items-center gap-2 min-w-0 pr-8 flex-1">
          {/* Checkbox de selección si está en modo selección o seleccionado */}
          {(isSelectMode || isSelected) && (
            <button
              type="button"
              onClick={(e) => handleToggleSelectOne(convo.id, e)}
              className="p-0.5 rounded text-slate-400 hover:text-white shrink-0"
            >
              {isSelected ? (
                <CheckSquare className="w-3 h-3 text-blue-400" />
              ) : (
                <Square className="w-3 h-3 text-slate-500" />
              )}
            </button>
          )}

          {convo.isPinned && (
            <Pin className="w-2.5 h-2.5 text-amber-400 fill-amber-400 rotate-45 shrink-0" />
          )}

          <span className="truncate text-[12px]">{convo.title}</span>
        </div>

        {/* Tiempo relativo a la derecha (como en Antigravity: "4m", "59m", "6h") */}
        <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-slate-500 group-hover:opacity-0 transition-opacity font-mono">
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
          )}
          <span>{relTime}</span>
        </div>

        {/* Acciones Rápidas en Hover (Anclar y Eliminar) */}
        <div className="flex items-center gap-0.5 absolute right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[#222731] px-1 py-0.5 rounded">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePinConversation(convo.id, !convo.isPinned);
            }}
            className="p-1 rounded text-slate-400 hover:text-amber-300"
            title={convo.isPinned ? 'Desanclar' : 'Anclar'}
          >
            <Pin className={`w-3 h-3 ${convo.isPinned ? 'fill-current text-amber-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={(e) => handleRequestSingleDelete(convo, e)}
            className="p-1 rounded text-slate-400 hover:text-red-400"
            title="Eliminar"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }
}
