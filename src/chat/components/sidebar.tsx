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
  Search,
  ArrowUpDown,
} from 'lucide-react';
import { ScheduledTasksModal } from './scheduled-tasks-modal';

export interface ProjectItem {
  id: string;
  name: string;
  path: string;
  createdAt?: string;
  conversationsCount?: number;
  lastActivity?: string | null;
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
  isOpen?: boolean;
  onToggleSidebar?: () => void;
  currentProjectPath?: string;
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
  isOpen = true,
  onToggleSidebar,
  currentProjectPath,
}: SidebarProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    ids: string[];
    title: string;
  } | null>(null);

  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [registeredProjects, setRegisteredProjects] = useState<ProjectItem[]>([]);
  const [isBrowsingProject, setIsBrowsingProject] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectSortBy, setProjectSortBy] = useState<'recent' | 'name-asc' | 'name-desc' | 'convos-count'>('recent');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

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

  // Abrir selector nativo de carpetas y crear proyecto automáticamente con el nombre de la carpeta
  const handleBrowseAndAddProject = async () => {
    setIsBrowsingProject(true);
    try {
      const res = await fetch('/api/workspace/browse', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.path) {
        const selectedPath = data.path.trim();
        const folderName = selectedPath.split(/[/\\]+/).filter(Boolean).pop() || 'proyecto';

        const createRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: folderName, path: selectedPath }),
        });
        const createData = await createRes.json();
        if (createData.success && createData.project) {
          setRegisteredProjects((prev) => {
            if (prev.some((p) => p.path === selectedPath)) return prev;
            return [...prev, createData.project];
          });
        }

        if (onNewConversation) {
          onNewConversation(selectedPath);
        }
      }
    } catch (err) {
      console.error('Error al abrir selector de carpetas para nuevo proyecto:', err);
    } finally {
      setIsBrowsingProject(false);
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

  // Lista consolidada de proyectos ordenados según projectSortBy y filtrados por búsqueda
  const displayProjects = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      path: string;
      convos: Conversation[];
      lastActivityTime: number;
    }> = [];
    const seenPaths = new Set<string>();

    // Primero los proyectos registrados oficialmente que tengan conversaciones
    for (const p of registeredProjects) {
      const norm = normalizePath(p.path);
      seenPaths.add(norm);
      const convos = projectMap.get(norm) || projectMap.get(p.path) || [];
      // Omitir si no tiene chats
      if (convos.length === 0) continue;

      const lastTime = Math.max(...convos.map((c) => new Date(c.updatedAt || c.createdAt).getTime()));

      list.push({
        id: p.id,
        name: p.name,
        path: p.path,
        convos,
        lastActivityTime: lastTime,
      });
    }

    // Añadir cualquier otro proyecto que aparezca en las conversaciones pero no esté en registeredProjects
    projectMap.forEach((convos, pathKey) => {
      if (!seenPaths.has(pathKey) && pathKey !== 'default-cli-project' && convos.length > 0) {
        const parts = pathKey.split('/').filter(Boolean);
        const name = parts[parts.length - 1] || pathKey;
        const lastTime = Math.max(...convos.map((c) => new Date(c.updatedAt || c.createdAt).getTime()));

        list.push({
          id: 'proj_' + pathKey,
          name,
          path: pathKey,
          convos,
          lastActivityTime: lastTime,
        });
      }
    });

    // 1. Ordenación de proyectos (Default: Más reciente con el que se ha hablado)
    list.sort((a, b) => {
      if (projectSortBy === 'recent') {
        // El proyecto con interacción más reciente va primero
        return b.lastActivityTime - a.lastActivityTime;
      }
      if (projectSortBy === 'name-asc') {
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      }
      if (projectSortBy === 'name-desc') {
        return b.name.localeCompare(a.name, 'es', { sensitivity: 'base' });
      }
      if (projectSortBy === 'convos-count') {
        return b.convos.length - a.convos.length || b.lastActivityTime - a.lastActivityTime;
      }
      return 0;
    });

    // 2. Filtrado reactivo de búsqueda si hay consulta activa
    if (!searchQuery.trim()) {
      return list;
    }

    const q = searchQuery.toLowerCase().trim();
    return list
      .map((p) => {
        const matchesProject = p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q);
        const matchingConvos = p.convos.filter((c) => c.title.toLowerCase().includes(q));
        if (matchesProject || matchingConvos.length > 0) {
          return {
            ...p,
            convos: matchesProject ? p.convos : matchingConvos,
          };
        }
        return null;
      })
      .filter((p): p is typeof list[0] => p !== null);
  }, [registeredProjects, projectMap, projectSortBy, searchQuery]);

  // Conversaciones sin proyecto filtradas por búsqueda
  const filteredStandalone = useMemo(() => {
    if (!searchQuery.trim()) return standaloneConversations;
    const q = searchQuery.toLowerCase().trim();
    return standaloneConversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [standaloneConversations, searchQuery]);

  const toggleProjectCollapse = (key: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <aside
      className={`${
        isOpen === false
          ? 'w-0 opacity-0 -translate-x-full overflow-hidden border-r-0 pointer-events-none'
          : 'w-64 opacity-100 translate-x-0'
      } transition-all duration-200 ease-in-out h-full bg-sidebar border-r border-surface-border flex flex-col select-none shrink-0 relative font-sans text-xs z-30`}
    >
      {/* Cabecera de Marca con Logo Oficial */}
      <div className="px-3.5 pt-3.5 pb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md overflow-hidden flex items-center justify-center bg-surface border border-surface-border p-0.5 shadow-sm">
            <img src="/logo.png" alt="muac" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white font-sans">muac</span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated text-slate-400 font-normal border border-surface-border">
            PRO
          </span>
        </div>
      </div>

      {/* Acción Principal: + Nueva conversación con atajo ⌘N */}
      <div className="px-3 pb-2 flex items-center">
        <button
          type="button"
          onClick={() => onNewConversation()}
          className="w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-slate-200 hover:text-white text-xs font-medium transition-colors group active:scale-[0.99]"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
            <span>Nueva conversación</span>
          </div>
          <kbd className="text-[10px] font-mono text-slate-500 bg-surface-elevated px-1.5 py-0.5 rounded border border-surface-border/60">
            ⌘N
          </kbd>
        </button>
      </div>

      {/* Buscador de Chats en Tiempo Real */}
      <div className="px-3 pb-2">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en historial..."
            className="w-full pl-8 pr-7 py-1 rounded-lg bg-surface border border-surface-border text-slate-200 placeholder:text-slate-500 text-xs focus:outline-none focus:border-accent/70 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-slate-500 hover:text-white p-0.5 rounded"
              title="Limpiar búsqueda"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Navegación Secundaria: Historial y Tareas */}
      <div className="px-3 pb-2 flex flex-col gap-0.5 border-b border-surface-border/60">
        <button
          type="button"
          onClick={() => {
            if (isSelectMode) {
              setSelectedIds(new Set());
              setIsSelectMode(false);
            } else {
              setIsSelectMode(true);
            }
          }}
          className={`flex items-center justify-between px-2 py-1.5 rounded-md transition-colors text-xs text-left ${
            isSelectMode
              ? 'bg-accent/15 text-blue-300 border border-accent/30 font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover'
          }`}
          title={isSelectMode ? 'Salir de selección múltiple' : 'Activar selección múltiple de chats'}
        >
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>Historial completo</span>
          </div>
          {isSelectMode ? (
            <span className="text-[10px] font-semibold text-blue-400">Selección activa</span>
          ) : (
            <span className="text-[10px] text-slate-500 font-mono">{conversations.length}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsTasksModalOpen(true)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-surface-hover transition-colors text-xs text-left"
        >
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Tareas programadas</span>
        </button>
      </div>

      {/* Acciones en Lote cuando hay conversaciones seleccionadas */}
      {selectedIds.size > 0 && (
        <div className="bg-surface-elevated border border-surface-border rounded-lg shadow-xl p-2.5 mx-2 my-1.5 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150 z-20">
          <div className="flex items-center justify-between text-[11px] text-blue-200 px-1">
            <span className="font-semibold">{selectedIds.size} seleccionada(s)</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-[10px] text-accent hover:underline cursor-pointer"
              >
                {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedIds(new Set());
                  setIsSelectMode(false);
                }}
                className="text-slate-400 hover:text-white p-0.5"
                title="Cerrar selección"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleBulkPin(true)}
              className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-md bg-accent/20 hover:bg-accent/30 border border-accent/40 text-xs text-blue-200 font-medium transition-colors"
              title="Anclar seleccionados"
            >
              <Pin className="w-3 h-3" />
              <span>Anclar</span>
            </button>
            <button
              type="button"
              onClick={() => handleBulkPin(false)}
              className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-xs text-slate-300 font-medium transition-colors"
              title="Desanclar seleccionados"
            >
              <span>Desanclar</span>
            </button>
            <button
              type="button"
              onClick={handleRequestBulkDelete}
              className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-md bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-xs text-rose-300 font-medium transition-colors"
              title="Eliminar seleccionados"
            >
              <Trash2 className="w-3 h-3" />
              <span>Eliminar</span>
            </button>
          </div>
        </div>
      )}



      {/* Área Central con Scroll: Proyectos y Conversaciones */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-4">
        {/* SECCIÓN 1: PROYECTOS */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-1 py-1 text-slate-400 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span>Proyectos</span>
              <span className="text-[10px] text-slate-500 font-mono">({displayProjects.length})</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              {/* Menú Desplegable de Ordenación */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                  className={`p-1 rounded-md hover:text-slate-300 transition-colors ${
                    projectSortBy !== 'recent' ? 'text-accent bg-accent/15' : ''
                  }`}
                  title="Ordenar proyectos (Default: Más reciente con el que se ha hablado)"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>

                {isSortMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-48 bg-surface-elevated border border-surface-border rounded-lg shadow-xl p-1 flex flex-col text-xs backdrop-blur-md animate-in fade-in">
                    <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-surface-border mb-1">
                      Ordenar Proyectos
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectSortBy('recent');
                        setIsSortMenuOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-md text-left transition-colors flex items-center justify-between ${
                        projectSortBy === 'recent'
                          ? 'bg-accent/15 text-accent font-semibold'
                          : 'text-slate-300 hover:bg-surface-hover'
                      }`}
                    >
                      <span>Más reciente (Default)</span>
                      {projectSortBy === 'recent' && <span className="text-[10px]">✓</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectSortBy('name-asc');
                        setIsSortMenuOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-md text-left transition-colors flex items-center justify-between ${
                        projectSortBy === 'name-asc'
                          ? 'bg-accent/15 text-accent font-semibold'
                          : 'text-slate-300 hover:bg-surface-hover'
                      }`}
                    >
                      <span>Alfabético (A - Z)</span>
                      {projectSortBy === 'name-asc' && <span className="text-[10px]">✓</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectSortBy('name-desc');
                        setIsSortMenuOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-md text-left transition-colors flex items-center justify-between ${
                        projectSortBy === 'name-desc'
                          ? 'bg-accent/15 text-accent font-semibold'
                          : 'text-slate-300 hover:bg-surface-hover'
                      }`}
                    >
                      <span>Alfabético (Z - A)</span>
                      {projectSortBy === 'name-desc' && <span className="text-[10px]">✓</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectSortBy('convos-count');
                        setIsSortMenuOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-md text-left transition-colors flex items-center justify-between ${
                        projectSortBy === 'convos-count'
                          ? 'bg-accent/15 text-accent font-semibold'
                          : 'text-slate-300 hover:bg-surface-hover'
                      }`}
                    >
                      <span>Nº de conversaciones</span>
                      {projectSortBy === 'convos-count' && <span className="text-[10px]">✓</span>}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsSelectMode(!isSelectMode)}
                className="hover:text-slate-300 transition-colors p-1 rounded-md"
                title="Filtrar / Selección múltiple"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleBrowseAndAddProject}
                disabled={isBrowsingProject}
                className="hover:text-slate-300 transition-colors p-1 rounded-md"
                title="Seleccionar carpeta para nuevo proyecto workspace"
              >
                {isBrowsingProject ? (
                  <div className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                ) : (
                  <FolderPlus className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Carpetas de Proyectos */}
          <div className="flex flex-col gap-1 mt-0.5">
            {displayProjects.length === 0 ? (
              <div className="px-2 py-1.5 text-slate-500 text-[11px] italic">
                {searchQuery ? 'Sin proyectos coincidentes' : 'Sin proyectos registrados'}
              </div>
            ) : (
              displayProjects.map((project) => {
                const isCollapsed = collapsedProjects.has(project.name);
                return (
                  <div key={project.id} className="flex flex-col">
                    {/* Fila del Proyecto / Carpeta */}
                    <button
                      type="button"
                      onClick={() => toggleProjectCollapse(project.name)}
                      className="flex items-center justify-between px-1.5 py-1 text-slate-400 hover:text-slate-200 hover:bg-surface-hover transition-colors rounded-md group text-left"
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
                      <span className="text-[10px] text-slate-500 font-mono">
                        {project.convos.length}
                      </span>
                    </button>

                    {/* Lista de Conversaciones bajo el proyecto */}
                    {!isCollapsed && (
                      <div className="flex flex-col gap-0.5 ml-2 pl-2 border-l border-surface-border">
                        {project.convos.length === 0 ? (
                          <div className="py-1 text-slate-500 text-[11px] italic">
                            Sin conversaciones aún
                          </div>
                        ) : (
                          project.convos.map((convo) => renderConversationItem(convo))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SECCIÓN 2: CONVERSACIONES (Globales / Sin Proyecto) */}
        <div className="flex flex-col gap-1 pt-1 border-t border-surface-border">
          <div className="flex items-center justify-between px-1 py-1 text-slate-400 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span>Conversaciones</span>
              <span className="text-[10px] text-slate-500 font-mono">({filteredStandalone.length})</span>
            </div>
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
            {filteredStandalone.length === 0 ? (
              <div className="px-1 py-1 text-slate-500 text-[11px] italic">
                {searchQuery ? 'No se encontraron conversaciones coincidentes' : 'Sin conversaciones aún'}
              </div>
            ) : (
              filteredStandalone.map((convo) => renderConversationItem(convo))
            )}
          </div>
        </div>
      </div>

      {/* Pie del Sidebar: Cuenta activa y Botón Settings */}
      <div className="p-2.5 border-t border-surface-border bg-sidebar flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {activeAccountEmail ? (
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-surface border border-surface-border text-slate-300 font-mono text-[11px] min-w-0 flex-1 mr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">{activeAccountEmail}</span>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 font-mono">Sin cuenta activa</div>
          )}

          {onSyncAntigravity && (
            <button
              type="button"
              onClick={onSyncAntigravity}
              disabled={isSyncing}
              className="p-1.5 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-slate-400 hover:text-white transition-colors shrink-0"
              title="Sincronizar con Antigravity Desktop"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-accent' : ''}`} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-xs text-slate-300 hover:text-white transition-colors"
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
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl p-5 max-w-sm w-full flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-9 h-9 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-sans">Eliminar conversación</h3>
                <p className="text-[11px] text-slate-400">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              ¿Estás seguro de que deseas eliminar permanentemente{' '}
              <span className="font-semibold text-white">«{confirmModal.title}»</span>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gestión de Tareas Programadas */}
      <ScheduledTasksModal
        isOpen={isTasksModalOpen}
        onClose={() => setIsTasksModalOpen(false)}
        currentProjectPath={currentProjectPath}
      />
    </aside>
  );

  function renderConversationItem(convo: Conversation) {
    const isActive = convo.id === activeConversationId;
    const isSelected = selectedIds.has(convo.id);
    const relTime = formatRelativeTime(convo.updatedAt || convo.createdAt);

    return (
      <div
        key={convo.id}
        className={`group relative flex items-center justify-between cursor-pointer transition-colors text-xs ${
          isActive
            ? 'bg-surface-active text-white border-l-2 border-accent pl-2.5 pr-2 py-1.5 rounded-md'
            : isSelected
            ? 'bg-accent/15 text-blue-300 border border-accent/30 px-2.5 py-1.5 rounded-md'
            : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover px-2.5 py-1.5 rounded-md'
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
          {/* Checkbox de selección múltiple (visible en hover o si está seleccionado o en modo selección) */}
          <button
            type="button"
            onClick={(e) => handleToggleSelectOne(convo.id, e)}
            className={`p-0.5 rounded text-slate-400 hover:text-white transition-opacity shrink-0 ${
              isSelectMode || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            title={isSelected ? 'Deseleccionar conversación' : 'Seleccionar conversación'}
          >
            {isSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-accent" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
            )}
          </button>

          {convo.isPinned && (
            <Pin className="w-2.5 h-2.5 text-amber-400 fill-amber-400 rotate-45 shrink-0" />
          )}

          <span className="truncate text-[12px]">{convo.title}</span>
        </div>

        {/* Tiempo relativo a la derecha (como en Antigravity: "4m", "59m", "6h") */}
        <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] text-slate-500 group-hover:opacity-0 transition-opacity">
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
          )}
          <span>{relTime}</span>
        </div>

        {/* Acciones Rápidas en Hover (Anclar y Eliminar) */}
        <div className="flex items-center gap-0.5 absolute right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-elevated border border-surface-border rounded px-1 py-0.5 shadow-sm">
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
            className="p-1 rounded text-slate-400 hover:text-rose-400"
            title="Eliminar"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }
}
