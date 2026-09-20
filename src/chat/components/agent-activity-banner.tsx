'use client';

import React, { useState } from 'react';
import {
  Brain,
  Terminal,
  Folder,
  FileCode,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Loader2,
} from 'lucide-react';
import type { AgentActivity } from '@/chat/agy-bridge';

interface AgentActivityBannerProps {
  activities: AgentActivity[];
  isStreaming: boolean;
}

export function AgentActivityBanner({ activities, isStreaming }: AgentActivityBannerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!activities || activities.length === 0) {
    if (!isStreaming) return null;
    return (
      <div className="flex items-center gap-2 rounded-md bg-surface/70 border border-surface-border p-3 text-slate-400 text-xs animate-pulse mb-3 max-w-fit">
        <Brain className="w-3.5 h-3.5 text-accent animate-bounce" />
        <span className="font-medium font-sans">Iniciando razonamiento con Antigravity...</span>
      </div>
    );
  }

  const latestActivity = activities[activities.length - 1];
  const isThinking = latestActivity.stepType === 'thinking';
  const isTool = latestActivity.stepType === 'tool';

  const getToolIcon = (name?: string) => {
    if (!name) return <Cpu className="w-3.5 h-3.5 text-accent" />;
    if (name.includes('command') || name.includes('terminal')) return <Terminal className="w-3.5 h-3.5 text-emerald-400" />;
    if (name.includes('dir') || name.includes('file')) return <Folder className="w-3.5 h-3.5 text-amber-400" />;
    if (name.includes('edit') || name.includes('write')) return <FileCode className="w-3.5 h-3.5 text-purple-400" />;
    return <Cpu className="w-3.5 h-3.5 text-accent" />;
  };

  const getToolParamSummary = (params?: Record<string, unknown>) => {
    if (!params) return '';
    if (typeof params.CommandLine === 'string') return params.CommandLine;
    if (typeof params.DirectoryPath === 'string') return params.DirectoryPath;
    if (typeof params.AbsolutePath === 'string') return params.AbsolutePath;
    if (typeof params.TargetFile === 'string') return params.TargetFile;
    if (typeof params.query === 'string') return params.query;
    return '';
  };

  return (
    <div className="mb-3.5 rounded-md bg-surface/70 border border-surface-border p-3 text-slate-400 text-xs backdrop-blur-sm max-w-xl">
      {/* Cabecera / Píldora de estado principal */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:text-slate-200 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isStreaming ? (
            <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}

          <span className="font-semibold text-slate-200 truncate font-sans">
            {isThinking && 'Razonando respuesta...'}
            {isTool && `Herramienta: ${latestActivity.toolName || 'tool'}`}
            {!isThinking && !isTool && 'Procesando paso...'}
          </span>

          {latestActivity.durationSeconds !== undefined && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-surface-border text-slate-400 font-mono">
              {latestActivity.durationSeconds.toFixed(2)}s
            </span>
          )}

          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
            ({activities.length} {activities.length === 1 ? 'acción' : 'acciones'})
          </span>
        </div>

        <div className="text-slate-400 p-0.5 hover:text-white transition-colors">
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Detalle desplegable de pasos ejecutados */}
      {isExpanded && (
        <div className="mt-2.5 pt-2 border-t border-surface-border flex flex-col gap-1.5 max-h-56 overflow-y-auto font-mono text-[11px]">
          {activities.map((act, idx) => {
            const summary = getToolParamSummary(act.toolParameters);
            return (
              <div
                key={idx}
                className="flex items-start gap-2 p-1.5 rounded-md bg-surface-elevated border border-surface-border text-slate-300"
              >
                <div className="mt-0.5 shrink-0">{getToolIcon(act.toolName)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-200 font-sans">
                      {act.stepType === 'thinking' ? 'Razonamiento' : act.toolName || act.stepType}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 shrink-0 font-mono">
                      {act.state === 'ACTIVE' && isStreaming && (
                        <span className="text-accent animate-pulse">en progreso</span>
                      )}
                      {act.durationSeconds !== undefined && (
                        <span>{act.durationSeconds.toFixed(2)}s</span>
                      )}
                    </div>
                  </div>

                  {summary && (
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate bg-canvas px-1.5 py-0.5 rounded border border-surface-border/50 font-mono">
                      {summary}
                    </div>
                  )}

                  {act.toolOutput && (
                    <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2 italic font-mono">
                      {act.toolOutput}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
