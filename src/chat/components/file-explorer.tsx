'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Search,
  Copy,
  Info,
  MessageSquare,
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
  onResizeWidth?: (width: number | null) => void;
}

export function FileExplorer({
  workspacePath,
  isOpen,
  onClose,
  onSelectFile,
  onResizeWidth,
}: FileExplorerProps) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [workspaceName, setWorkspaceName] = useState<string>('');

  // Ancho opcional si se redimensiona manualmente (null = flex-1 fluido que aprovecha todo el espacio disponible)
  const [manualWidth, setManualWidth] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('muac_file_explorer_custom_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 260 && parsed <= 1200) {
          return parsed;
        }
      }
    }
    return null;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Estados para búsqueda y filtrado rápido
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Estado para el archivo o carpeta actualmente seleccionado para inspeccionar
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);
  const [isCopiedPath, setIsCopiedPath] = useState(false);

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

  // Manejo de redimensionado interactivo del panel mediante arrastre del separador izquierdo
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Al estar en el lateral derecho, el ancho es la distancia desde el cursor hasta el borde derecho de la ventana
      const newWidth = Math.max(260, Math.min(window.innerWidth - e.clientX, window.innerWidth - 450));
      if (onResizeWidth) {
        onResizeWidth(newWidth);
      } else {
        setManualWidth(newWidth);
      }
      try {
        localStorage.setItem('muac_file_explorer_custom_width', newWidth.toString());
      } catch {}
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onResizeWidth]);

  // Copiar ruta de archivo al portapapeles
  const handleCopyPath = (pathText: string) => {
    navigator.clipboard.writeText(pathText);
    setIsCopiedPath(true);
    setTimeout(() => setIsCopiedPath(false), 2000);
  };

  // Filtrar el árbol de archivos recursivamente según el término de búsqueda
  const filterTree = useCallback((nodes: FileItem[], query: string): FileItem[] => {
    if (!query.trim()) return nodes;
    const q = query.toLowerCase().trim();

    return nodes.reduce<FileItem[]>((acc, node) => {
      if (node.isDirectory) {
        const filteredChildren = node.children ? filterTree(node.children, query) : [];
        if (node.name.toLowerCase().includes(q) || filteredChildren.length > 0) {
          acc.push({
            ...node,
            children: filteredChildren,
          });
        }
      } else {
        if (node.name.toLowerCase().includes(q)) {
          acc.push(node);
        }
      }
      return acc;
    }, []);
  }, []);

  const displayedItems = useMemo(() => {
    return filterTree(items, searchQuery);
  }, [items, searchQuery, filterTree]);

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
    const isSelected = selectedItem?.path === item.path;

    return (
      <div key={item.path} className="flex flex-col select-none">
        <div
          className={`group flex items-center justify-between py-1 px-2 rounded-md transition-colors cursor-pointer text-xs ${
            isSelected
              ? 'bg-surface-active text-white border-l-2 border-accent pl-2 font-medium'
              : 'hover:bg-surface-hover text-slate-300'
          } ${item.isHidden ? 'opacity-60' : ''}`}
          style={{ paddingLeft: isSelected ? `${Math.max(8, depth * 14 + 6)}px` : `${depth * 14 + 8}px` }}
          onClick={() => {
            setSelectedItem(item);
            if (item.isDirectory) {
              toggleDirectory(item.relativePath);
            }
          }}
          onDoubleClick={() => {
            if (!item.isDirectory && onSelectFile) {
              onSelectFile(item);
            }
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            {item.isDirectory ? (
              <button
                type="button"
                className="p-0.5 hover:bg-surface-hover rounded text-slate-400 hover:text-white"
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
                <FolderOpen className="w-4 h-4 text-accent shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-accent shrink-0" />
              )
            ) : (
              getFileIcon(item.extension, item.name)
            )}

            <span className="truncate text-slate-300 group-hover:text-white font-sans text-xs">
              {item.name}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto pr-2">
            {!item.isDirectory && (
              <div className="flex items-center gap-3 font-mono text-[10px] text-slate-500">
                {item.modifiedAt && (
                  <span
                    className="hidden sm:inline text-slate-600 group-hover:text-slate-500 transition-colors"
                    title={`Modificado: ${new Date(item.modifiedAt).toLocaleString()}`}
                  >
                    {new Date(item.modifiedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
                <span className="text-right">
                  {formatFileSize(item.size)}
                </span>
              </div>
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
                    className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white"
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
                    className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white"
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
                className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white"
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
                className="p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400"
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
    <aside
      style={!onResizeWidth && manualWidth ? { width: `${manualWidth}px`, flex: 'none' } : undefined}
      className={`w-full h-full flex-1 flex flex-col bg-sidebar select-none relative font-sans text-xs z-20 overflow-hidden ${
        isResizing ? '' : 'transition-[width] duration-150'
      }`}
    >
      {/* Separador arrastrable (Drag Handle) en el borde izquierdo */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        onDoubleClick={() => {
          if (onResizeWidth) {
            onResizeWidth(null);
          } else {
            setManualWidth(null);
          }
          try {
            localStorage.removeItem('muac_file_explorer_custom_width');
            localStorage.removeItem('muac_file_explorer_width');
          } catch {}
        }}
        className={`absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize z-30 group flex items-center justify-center transition-colors ${
          isResizing ? 'bg-accent/80' : 'hover:bg-accent/40'
        }`}
        title="Arrastra para redimensionar el panel (doble clic para auto-ajustar al espacio disponible)"
      >
        <div
          className={`w-0.5 h-10 rounded-full transition-colors ${
            isResizing ? 'bg-white' : 'bg-surface-border group-hover:bg-accent'
          }`}
        />
      </div>

      {/* Cabecera del Gestor de Archivos */}
      <div className="h-12 border-b border-surface-border bg-sidebar/90 px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <Folder className="w-4 h-4 text-accent shrink-0" />
          <span className="font-semibold text-slate-200 truncate text-xs" title={workspaceName || workspacePath}>
            {workspaceName || 'Workspace'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-1.5 rounded-md transition-colors ${
              isSearchOpen || searchQuery
                ? 'bg-accent/15 text-accent border border-accent/30'
                : 'hover:bg-surface-hover text-slate-400 hover:text-white'
            }`}
            title="Buscar o filtrar archivos"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => loadDirectory('', false)}
            disabled={isLoading}
            className="p-1.5 rounded-md hover:bg-surface-hover text-slate-400 hover:text-white transition-colors"
            title="Actualizar archivos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-accent' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowHidden(!showHidden)}
            className={`p-1.5 rounded-md transition-colors ${
              showHidden
                ? 'bg-accent/15 text-accent border border-accent/30'
                : 'hover:bg-surface-hover text-slate-400 hover:text-white'
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
            className="p-1.5 rounded-md hover:bg-surface-hover text-slate-400 hover:text-white transition-colors"
            title="Nuevo archivo en la raíz"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() =>
              setCreateModal({ isOpen: true, type: 'directory', targetDir: '', name: '' })
            }
            className="p-1.5 rounded-md hover:bg-surface-hover text-slate-400 hover:text-white transition-colors"
            title="Nueva carpeta en la raíz"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-surface-hover text-slate-400 hover:text-white transition-colors"
            title="Cerrar panel de archivos"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Campo de búsqueda / filtro rápido */}
      {isSearchOpen && (
        <div className="p-2 border-b border-surface-border bg-sidebar">
          <div className="relative flex items-center animate-in fade-in slide-in-from-top-1 duration-150">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar por nombre de archivo..."
              className="w-full bg-surface border border-surface-border focus:border-accent rounded-md pl-8 pr-7 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none transition-colors"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-white p-0.5 rounded"
                title="Limpiar búsqueda"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Indicador de filtro activo */}
      {searchQuery && (
        <div className="px-3 py-1 bg-surface-elevated border-b border-surface-border text-[10px] text-accent flex items-center justify-between font-mono">
          <span>Filtrando por: &quot;{searchQuery}&quot;</span>
          <span>{displayedItems.length} resultados</span>
        </div>
      )}

      {/* Lista del Árbol de Archivos con scroll independiente */}
      <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5 min-h-[140px]">
        {!workspacePath ? (
          <div className="p-4 text-center text-slate-500 text-xs">
            Selecciona un proyecto para explorar sus archivos.
          </div>
        ) : displayedItems.length === 0 && !isLoading ? (
          <div className="p-4 text-center text-slate-500 text-xs">
            {searchQuery
              ? `No se encontraron archivos con "${searchQuery}"`
              : 'No hay archivos en este directorio.'}
          </div>
        ) : (
          displayedItems.map((item) => renderTreeItem(item, 0))
        )}
      </div>

      {/* Panel Inferior: Inspector del Archivo Seleccionado o Resumen del Workspace */}
      <div className="shrink-0 bg-surface border-t border-surface-border p-2.5 text-xs flex flex-col gap-2">
        {selectedItem ? (
          <div className="flex flex-col gap-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {selectedItem.isDirectory ? (
                  <Folder className="w-3.5 h-3.5 text-accent shrink-0" />
                ) : (
                  getFileIcon(selectedItem.extension, selectedItem.name)
                )}
                <span className="font-semibold text-slate-200 truncate text-[11px]" title={selectedItem.name}>
                  {selectedItem.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-md hover:bg-surface-hover text-slate-400 hover:text-white transition-colors"
                title="Cerrar detalles"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="flex flex-col gap-1 text-[11px] text-slate-400 font-mono bg-surface-elevated p-2 rounded-md border border-surface-border">
              <div className="flex items-center justify-between truncate">
                <span className="text-slate-500 shrink-0">Ruta:</span>
                <span className="text-slate-300 truncate flex-1 text-right ml-2" title={selectedItem.relativePath}>
                  /{selectedItem.relativePath}
                </span>
              </div>
              {!selectedItem.isDirectory && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Tamaño:</span>
                  <span className="text-slate-300">{formatFileSize(selectedItem.size)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Modificado:</span>
                <span className="text-slate-400 text-[10px]">
                  {new Date(selectedItem.modifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => handleCopyPath(selectedItem.relativePath)}
                className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-md bg-surface-elevated hover:bg-surface-hover text-slate-300 hover:text-white border border-surface-border text-[11px] transition-colors"
                title="Copiar ruta relativa"
              >
                {isCopiedPath ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copiada</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-400" />
                    <span>Copiar ruta</span>
                  </>
                )}
              </button>

              {!selectedItem.isDirectory && onSelectFile && (
                <button
                  type="button"
                  onClick={() => onSelectFile(selectedItem)}
                  className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-md bg-accent hover:bg-accent-hover text-white text-[11px] font-medium transition-colors shadow-sm"
                  title="Insertar referencia @archivo en el mensaje"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Insertar @</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 text-[11px] text-slate-400">
            <div className="flex items-center justify-between text-slate-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-accent" />
                <span>Workspace activo</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {items.length} elementos
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 truncate bg-surface-elevated px-2 py-1 rounded-md border border-surface-border" title={workspacePath}>
              {workspacePath}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight pt-0.5">
              Haz clic en cualquier archivo para ver sus detalles o insertarlo en el chat con @.
            </p>
          </div>
        )}
      </div>

      {/* Modal / Diálogo para Crear Archivo o Carpeta */}
      {createModal.isOpen && (
        <div className="absolute inset-x-2 top-14 p-5 rounded-xl bg-surface-elevated border border-surface-border shadow-2xl z-30 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between text-xs text-white font-semibold">
            <span>
              {createModal.type === 'directory' ? 'Nueva carpeta' : 'Nuevo archivo'}
              {createModal.targetDir ? ` en /${createModal.targetDir}` : ''}
            </span>
            <button
              type="button"
              onClick={() =>
                setCreateModal({ isOpen: false, type: 'file', targetDir: '', name: '' })
              }
              className="text-slate-400 hover:text-white p-0.5 rounded-md hover:bg-surface-hover transition-colors"
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
            className="w-full px-2.5 py-1.5 rounded-md bg-surface border border-surface-border text-slate-200 text-xs focus:outline-none focus:border-accent font-mono transition-colors"
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                setCreateModal({ isOpen: false, type: 'file', targetDir: '', name: '' })
              }
              className="px-2.5 py-1 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 text-[11px] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!createModal.name.trim()}
              className="px-2.5 py-1 rounded-md bg-accent hover:bg-accent-hover text-white font-medium text-[11px] disabled:opacity-50 transition-colors"
            >
              Crear
            </button>
          </div>
        </div>
      )}

      {/* Modal / Diálogo para Renombrar */}
      {renameModal.isOpen && (
        <div className="absolute inset-x-2 top-14 p-5 rounded-xl bg-surface-elevated border border-surface-border shadow-2xl z-30 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between text-xs text-white font-semibold">
            <span>Renombrar: {renameModal.currentName}</span>
            <button
              type="button"
              onClick={() =>
                setRenameModal({ isOpen: false, oldPath: '', currentName: '', newName: '' })
              }
              className="text-slate-400 hover:text-white p-0.5 rounded-md hover:bg-surface-hover transition-colors"
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
            className="w-full px-2.5 py-1.5 rounded-md bg-surface border border-surface-border text-slate-200 text-xs focus:outline-none focus:border-accent font-mono transition-colors"
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                setRenameModal({ isOpen: false, oldPath: '', currentName: '', newName: '' })
              }
              className="px-2.5 py-1 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 text-[11px] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleRename}
              disabled={!renameModal.newName.trim() || renameModal.newName === renameModal.currentName}
              className="px-2.5 py-1 rounded-md bg-accent hover:bg-accent-hover text-white font-medium text-[11px] disabled:opacity-50 transition-colors"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Modal / Confirmación de Eliminación */}
      {deleteConfirm.isOpen && (
        <div className="absolute inset-x-2 top-14 p-5 rounded-xl bg-surface-elevated border border-surface-border shadow-2xl z-30 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
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
              className="px-2.5 py-1 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 text-[11px] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-medium text-[11px] transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
