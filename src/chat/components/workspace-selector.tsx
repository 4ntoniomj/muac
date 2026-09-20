'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FolderOpen, CheckCircle2, AlertCircle, X, Check, GitBranch, FolderSearch } from 'lucide-react';

interface WorkspaceSelectorProps {
  projectPath?: string;
  onUpdateProjectPath: (path: string) => Promise<void>;
}

export function WorkspaceSelector({
  projectPath = '',
  onUpdateProjectPath,
}: WorkspaceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempPath, setTempPath] = useState(projectPath);
  const [validation, setValidation] = useState<{
    valid: boolean;
    fileCount?: number;
    hasGit?: boolean;
    name?: string;
    error?: string;
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleBrowseWorkspace = async () => {
    setIsBrowsing(true);
    try {
      const res = await fetch('/api/workspace/browse', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.path) {
        setTempPath(data.path);
        await validatePath(data.path);
        await onUpdateProjectPath(data.path);
        setIsOpen(false);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error('Error abriendo gestor de archivos:', err);
    } finally {
      setIsBrowsing(false);
    }
  };

  useEffect(() => {
    setTempPath(projectPath);
    if (projectPath) {
      validatePath(projectPath);
    } else {
      setValidation(null);
    }
  }, [projectPath]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const validatePath = async (pathToCheck: string) => {
    if (!pathToCheck.trim()) {
      setValidation(null);
      return;
    }
    setIsValidating(true);
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathToCheck.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setValidation({
          valid: true,
          fileCount: data.fileCount,
          hasGit: data.hasGit,
          name: data.name,
        });
      } else {
        setValidation({ valid: false, error: data.error || 'Directorio no accesible' });
      }
    } catch {
      setValidation({ valid: false, error: 'Error al conectar con la verificación' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleApply = async () => {
    await onUpdateProjectPath(tempPath.trim());
    setIsOpen(false);
  };

  const handleClear = async () => {
    setTempPath('');
    setValidation(null);
    await onUpdateProjectPath('');
    setIsOpen(false);
  };

  const folderDisplayName = projectPath
    ? projectPath.split('/').filter(Boolean).pop() || projectPath
    : 'Workspace';

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-xs text-slate-300 hover:text-white px-2.5 py-1.5 transition-colors"
        title={projectPath ? `Workspace activo: ${projectPath}` : 'Asignar ruta de trabajo local para el agente'}
      >
        <FolderOpen className={`w-3.5 h-3.5 ${projectPath ? 'text-accent' : 'text-slate-500'}`} />
        <span className="max-w-[160px] truncate">{folderDisplayName}</span>

        {projectPath && validation?.valid && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Directorio validado" />
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-80 bg-surface-elevated border border-surface-border rounded-lg shadow-xl p-3 text-xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-accent" />
              <span>Workspace de Trabajo</span>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-surface-hover transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-normal">
            Directorio local donde el agente leerá y editará archivos con Antigravity:
          </p>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={tempPath}
              onChange={(e) => {
                setTempPath(e.target.value);
                validatePath(e.target.value);
              }}
              placeholder="/home/usuario/mi-proyecto"
              className="flex-1 bg-surface border border-surface-border focus:border-accent rounded-md px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={handleBrowseWorkspace}
              disabled={isBrowsing}
              title="Abrir el gestor de archivos nativo para elegir carpeta"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-xs text-slate-300 hover:text-white transition-colors shrink-0"
            >
              {isBrowsing ? (
                <div className="w-3.5 h-3.5 border-2 border-slate-500 border-t-accent rounded-full animate-spin" />
              ) : (
                <FolderSearch className="w-3.5 h-3.5 text-accent" />
              )}
              <span>Examinar</span>
            </button>
          </div>

          {/* Resultado de validación en tiempo real */}
          {isValidating && (
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
              <div className="w-3 h-3 border-2 border-slate-500 border-t-accent rounded-full animate-spin" />
              <span>Verificando ruta...</span>
            </div>
          )}

          {!isValidating && validation?.valid && (
            <div className="p-2 rounded-md bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-semibold">{validation.name}</span>
                <span className="text-slate-400 font-mono">({validation.fileCount} archivos)</span>
              </div>
              {validation.hasGit && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-900/40 px-1.5 py-0.5 rounded font-mono">
                  <GitBranch className="w-3 h-3" />
                  git
                </span>
              )}
            </div>
          )}

          {!isValidating && validation?.valid === false && (
            <div className="p-2 rounded-md bg-red-950/30 border border-red-800/40 text-[11px] text-red-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>{validation.error || 'La ruta no existe o no es accesible'}</span>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex items-center justify-between pt-2 border-t border-surface-border text-xs">
            {projectPath ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-red-400 hover:text-red-300 text-[11px] transition-colors"
              >
                Quitar ruta
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2.5 py-1 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-slate-400 hover:text-slate-200 text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex items-center gap-1 px-3 py-1 rounded-md bg-accent hover:bg-accent-hover text-white font-medium text-xs transition-colors shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Aplicar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
