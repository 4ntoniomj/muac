'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  FilePlus,
  FolderPlus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  X,
  FileCode,
  FileText,
  Image as ImageIcon,
  File,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { formatFileSize } from '@/shared/time-utils';

export interface FileItem {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  extension: string;
  modifiedAt: string;
  isHidden: boolean;
  children?: FileItem[];
  isLoaded?: boolean;
}

interface FileExplorerProps {
  workspacePath: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectFile?: (file: FileItem) => void;
}

export function FileExplorer({
  workspacePath,
  isOpen,
  onClose,
  onSelectFile,
}: FileExplorerProps) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [workspaceName, setWorkspaceName] = useState<string>('');

  // Estados para creación y edición
  const [createModal, setCreateModal] = useState<{
    isOpen: boolean;
    type: 'file' | 'directory';
    targetDir: string;
    name: string;
  }>({
    isOpen: false,
    type: 'file',
    targetDir: '',
    name: '',
  });

  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean;
    oldPath: string;
    currentName: string;
    newName: string;
  }>({
    isOpen: false,
    oldPath: '',
    currentName: '',
    newName: '',
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    path: string;
    name: string;
    isDirectory: boolean;
  }>({
    isOpen: false,
    path: '',
    name: '',
    isDirectory: false,
  });

  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cargar contenidos de un directorio
  const loadDirectory = useCallback(
    async (subPath = '', silent = false) => {
      if (!workspacePath) return [];
      if (!silent) setIsLoading(true);
      try {
        const res = await fetch(
          `/api/workspace/files?path=${encodeURIComponent(workspacePath)}&subPath=${encodeURIComponent(
            subPath
          )}&showHidden=${showHidden}`
        );
        const data = await res.json();
        if (data.success) {
          if (!subPath) {
            setWorkspaceName(data.workspaceName);
            setItems(data.items);
          }
          return data.items as FileItem[];
        }
      } catch (err) {
        console.error('Error cargando archivos del workspace:', err);
      } finally {
        if (!silent) setIsLoading(false);
      }
      return [];
    },
    [workspacePath, showHidden]
  );

  // Carga inicial y auto-actualización periódica
  useEffect(() => {
    if (!isOpen || !workspacePath) return;

    loadDirectory('', false);

    // Polling ligero cada 4 segundos para detectar cambios en disco
    const interval = setInterval(() => {
      loadDirectory('', true);
    }, 4000);

    return () => clearInterval(interval);
  }, [isOpen, workspacePath, showHidden, loadDirectory]);

  // Alternar expandir/colapsar carpeta
  const toggleDirectory = async (dirRelativePath: string) => {
    const next = new Set(expandedDirs);
    if (next.has(dirRelativePath)) {
      next.delete(dirRelativePath);
      setExpandedDirs(next);
    } else {
      next.add(dirRelativePath);
      setExpandedDirs(next);

      // Cargar contenidos del subdirectorio
      const children = await loadDirectory(dirRelativePath, true);

      // Actualizar árbol con los hijos cargados
      const updateChildren = (list: FileItem[]): FileItem[] => {
        return list.map((item) => {
          if (item.relativePath === dirRelativePath) {
            return { ...item, children, isLoaded: true };
          }
          if (item.children) {
            return { ...item, children: updateChildren(item.children) };
          }
          return item;
        });
      };

      setItems((prev) => updateChildren(prev));
    }
  };

  // Crear archivo o carpeta
  const handleCreate = async () => {
    if (!createModal.name.trim() || !workspacePath) return;

    try {
      const res = await fetch('/api/workspace/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspacePath,
          targetDir: createModal.targetDir,
          name: createModal.name.trim(),
          type: createModal.type,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCreateModal({ isOpen: false, type: 'file', targetDir: '', name: '' });
        await loadDirectory('', false);
      } else {
        alert(data.error || 'Error al crear elemento');
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Renombrar
  const handleRename = async () => {
    if (!renameModal.newName.trim() || !workspacePath) return;

    try {
      const res = await fetch('/api/workspace/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspacePath,
          oldPath: renameModal.oldPath,
          newName: renameModal.newName.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRenameModal({ isOpen: false, oldPath: '', currentName: '', newName: '' });
        await loadDirectory('', false);
      } else {
        alert(data.error || 'Error al renombrar');
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Eliminar
  const handleDelete = async () => {
    if (!deleteConfirm.path || !workspacePath) return;

    try {
      const res = await fetch(
        `/api/workspace/files?workspacePath=${encodeURIComponent(
          workspacePath
        )}&targetPath=${encodeURIComponent(deleteConfirm.path)}`,
        { method: 'DELETE' }
      );

      const data = await res.json();
      if (data.success) {
        setDeleteConfirm({ isOpen: false, path: '', name: '', isDirectory: false });
        await loadDirectory('', false);
      } else {
        alert(data.error || 'Error al eliminar');
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Renderizar icono por extensión de archivo
  const getFileIcon = (ext: string, name: string) => {
    if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
    if (['json'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-amber-400 shrink-0" />;
    }
    if (['css', 'scss', 'postcss'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;
    }
    if (['md', 'txt', 'log'].includes(ext)) {
      return <FileText className="w-4 h-4 text-slate-300 shrink-0" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
      return <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (name.startsWith('.env') || name.startsWith('.git')) {
      return <FileText className="w-4 h-4 text-yellow-300 shrink-0" />;
    }
    return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  // Renderizar nodo del árbol recursivamente
  const renderTreeItem = (item: FileItem, depth = 0) => {
    const isExpanded = expandedDirs.has(item.relativePath);

    return (
      <div key={item.path} className="flex flex-col select-none">
        <div
          className={`group flex items-center justify-between py-1 px-2 rounded-lg hover:bg-[#1f242e] transition-colors cursor-pointer text-xs ${
            item.isHidden ? 'opacity-65' : ''
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          onClick={() => {
            if (item.isDirectory) {
              toggleDirectory(item.relativePath);
            } else if (onSelectFile) {
              onSelectFile(item);
            }
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            {item.isDirectory ? (
              <button
                type="button"
                className="p-0.5 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDirectory(item.relativePath);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-3.5" />
            )}

            {item.isDirectory ? (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-amber-400 shrink-0" />
              )
            ) : (
              getFileIcon(item.extension, item.name)
            )}

            <span className="truncate text-slate-300 group-hover:text-white font-sans text-xs">
              {item.name}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!item.isDirectory && (
              <span className="text-[10px] text-slate-500 font-mono pr-1">
                {formatFileSize(item.size)}
              </span>
            )}

            {/* Acciones flotantes al pasar el cursor */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
              {item.isDirectory && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreateModal({
                        isOpen: true,
                        type: 'file',
                        targetDir: item.relativePath,
                        name: '',
                      });
                    }}
                    title="Nuevo archivo aquí"
                    className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                  >
                    <FilePlus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreateModal({
                        isOpen: true,
                        type: 'directory',
                        targetDir: item.relativePath,
                        name: '',
                      });
                    }}
                    title="Nueva carpeta aquí"
                    className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                  >
                    <FolderPlus className="w-3 h-3" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameModal({
                    isOpen: true,
                    oldPath: item.path,
                    currentName: item.name,
                    newName: item.name,
                  });
                }}
                title="Renombrar"
                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
              >
                <Edit2 className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm({
                    isOpen: true,
                    path: item.path,
                    name: item.name,
                    isDirectory: item.isDirectory,
                  });
                }}
                title="Eliminar"
                className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Subárbol si está expandido */}
        {item.isDirectory && isExpanded && item.children && (
          <div className="flex flex-col">
            {item.children.length === 0 ? (
              <div
                className="py-1 text-[11px] text-slate-500 italic"
                style={{ paddingLeft: `${(depth + 1) * 14 + 16}px` }}
              >
                (Carpeta vacía)
              </div>
            ) : (
              item.children.map((child) => renderTreeItem(child, depth + 1))
            )}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <aside className="w-72 h-full bg-[#111317] border-l border-[#1e222b] flex flex-col select-none shrink-0 relative font-sans text-xs z-20">
      {/* Cabecera del Gestor de Archivos */}
      <div className="p-3 border-b border-[#1e222b] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <Folder className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-slate-200 truncate text-xs">
            {workspaceName || 'Workspace'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => loadDirectory('', false)}
            disabled={isLoading}
            className="p-1.5 rounded-lg hover:bg-[#1a1d24] text-slate-400 hover:text-white transition-colors"
            title="Actualizar archivos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowHidden(!showHidden)}
            className={`p-1.5 rounded-lg transition-colors ${
              showHidden
                ? 'bg-blue-950/60 text-blue-300 border border-blue-500/30'
                : 'hover:bg-[#1a1d24] text-slate-400 hover:text-white'
            }`}
            title={showHidden ? 'Ocultar archivos ocultos (.)' : 'Mostrar archivos ocultos (.)'}
          >
            {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() =>
              setCreateModal({ isOpen: true, type: 'file', targetDir: '', name: '' })
            }
            className="p-1.5 rounded-lg hover:bg-[#1a1d24] text-slate-400 hover:text-white transition-colors"
            title="Nuevo archivo en la raíz"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() =>
              setCreateModal({ isOpen: true, type: 'directory', targetDir: '', name: '' })
            }
            className="p-1.5 rounded-lg hover:bg-[#1a1d24] text-slate-400 hover:text-white transition-colors"
            title="Nueva carpeta en la raíz"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#1a1d24] text-slate-400 hover:text-white transition-colors"
            title="Cerrar panel de archivos"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Lista del Árbol de Archivos */}
      <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5">
        {!workspacePath ? (
          <div className="p-4 text-center text-slate-500 text-xs">
            Selecciona un proyecto para explorar sus archivos.
          </div>
        ) : items.length === 0 && !isLoading ? (
          <div className="p-4 text-center text-slate-500 text-xs">
            No hay archivos en este directorio.
          </div>
        ) : (
          items.map((item) => renderTreeItem(item, 0))
        )}
      </div>

      {/* Modal / Diálogo para Crear Archivo o Carpeta */}
      {createModal.isOpen && (
        <div className="absolute inset-x-2 top-14 p-3 rounded-xl bg-[#1a1e27] border border-blue-500/40 shadow-2xl z-30 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between text-xs text-blue-300 font-semibold">
            <span>
              {createModal.type === 'directory' ? 'Nueva carpeta' : 'Nuevo archivo'}
              {createModal.targetDir ? ` en /${createModal.targetDir}` : ''}
            </span>
            <button
              type="button"
              onClick={() =>
                setCreateModal({ isOpen: false, type: 'file', targetDir: '', name: '' })
              }
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            type="text"
            autoFocus
            value={createModal.name}
            onChange={(e) => setCreateModal((prev) => ({ ...prev, name: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape')
                setCreateModal({ isOpen: false, type: 'file', targetDir: '', name: '' });
            }}
            placeholder={createModal.type === 'directory' ? 'nombre-carpeta' : 'nombre-archivo.ts'}
            className="w-full px-2.5 py-1.5 rounded-lg bg-[#111317] border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                setCreateModal({ isOpen: false, type: 'file', targetDir: '', name: '' })
              }
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!createModal.name.trim()}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] disabled:opacity-50"
            >
              Crear
            </button>
          </div>
        </div>
      )}

      {/* Modal / Diálogo para Renombrar */}
      {renameModal.isOpen && (
        <div className="absolute inset-x-2 top-14 p-3 rounded-xl bg-[#1a1e27] border border-blue-500/40 shadow-2xl z-30 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between text-xs text-blue-300 font-semibold">
            <span>Renombrar: {renameModal.currentName}</span>
            <button
              type="button"
              onClick={() =>
                setRenameModal({ isOpen: false, oldPath: '', currentName: '', newName: '' })
              }
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            type="text"
            autoFocus
            value={renameModal.newName}
            onChange={(e) => setRenameModal((prev) => ({ ...prev, newName: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape')
                setRenameModal({ isOpen: false, oldPath: '', currentName: '', newName: '' });
            }}
            className="w-full px-2.5 py-1.5 rounded-lg bg-[#111317] border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                setRenameModal({ isOpen: false, oldPath: '', currentName: '', newName: '' })
              }
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleRename}
              disabled={!renameModal.newName.trim() || renameModal.newName === renameModal.currentName}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Modal / Confirmación de Eliminación */}
      {deleteConfirm.isOpen && (
        <div className="absolute inset-x-2 top-14 p-3.5 rounded-xl bg-[#1e1518] border border-red-500/40 shadow-2xl z-30 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center gap-2 text-red-400 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Eliminar {deleteConfirm.isDirectory ? 'carpeta' : 'archivo'}</span>
          </div>

          <p className="text-[11px] text-slate-300">
            ¿Seguro que deseas eliminar <code className="text-white font-bold">{deleteConfirm.name}</code>?
            {deleteConfirm.isDirectory && ' Todos sus contenidos serán eliminados permanentemente.'}
          </p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                setDeleteConfirm({ isOpen: false, path: '', name: '', isDirectory: false })
              }
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-[11px]"
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
