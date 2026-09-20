'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ANTIGRAVITY_MODELS, AntigravityModel, findModel } from '@/shared/types/model';
import { ChevronDown, Cpu, Check, AlertTriangle } from 'lucide-react';

interface ModelSelectorProps {
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
}

export function ModelSelector({ selectedModelId, onSelectModel }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingModel, setPendingModel] = useState<AntigravityModel | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeModel = findModel(selectedModelId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-xs text-slate-300 hover:text-white px-2.5 py-1.5 transition-colors shadow-sm"
      >
        <Cpu className="w-3.5 h-3.5 text-accent" />
        <span className="max-w-[130px] truncate">{activeModel.name}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-72 max-h-80 overflow-y-auto bg-surface-elevated border border-surface-border rounded-lg shadow-xl p-1.5 text-xs flex flex-col gap-1">
          <div className="px-2.5 py-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase font-mono">
            Modelos de Antigravity Pro
          </div>

          {ANTIGRAVITY_MODELS.map((model) => {
            const isSelected = model.id === selectedModelId;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  if (model.id === selectedModelId) {
                    setIsOpen(false);
                    return;
                  }
                  setPendingModel(model);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-2.5 p-2 rounded-md transition-colors text-left ${
                  isSelected
                    ? 'bg-accent/15 border border-accent/30 text-white'
                    : 'hover:bg-surface-hover text-slate-300 hover:text-white border border-transparent'
                }`}
              >
                <div className="mt-0.5 p-1 rounded-md bg-surface border border-surface-border/50 text-accent">
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold truncate">{model.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{model.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-surface text-slate-400 border border-surface-border/50">
                      {Math.round(model.contextLimit / 1000)}k ctx
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-surface text-slate-400 border border-surface-border/50 capitalize">
                      {model.group === 'gemini' ? 'Google' : 'Terceros'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Modal emergente de advertencia por pérdida de contexto */}
      {pendingModel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface-elevated border border-surface-border rounded-xl shadow-2xl p-5 flex flex-col gap-4 text-left">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white mb-1">
                  Confirmar cambio de modelo
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Al cambiar de modelo se pierde el contexto de la conversación, ¿estás seguro?
                </p>
                <div className="mt-3 p-2.5 rounded-lg bg-surface border border-surface-border text-xs flex items-center justify-between">
                  <span className="text-slate-400">Nuevo modelo:</span>
                  <span className="font-semibold text-accent">{pendingModel.name}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setPendingModel(null)}
                className="px-3.5 py-1.5 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-xs font-medium text-slate-300 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectModel(pendingModel.id);
                  setPendingModel(null);
                }}
                className="px-4 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-xs font-semibold text-white transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
