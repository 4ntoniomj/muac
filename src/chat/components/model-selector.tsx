'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ANTIGRAVITY_MODELS, AntigravityModel, findModel } from '@/shared/types/model';
import { ChevronDown, Sparkles, Cpu, Check, Sliders } from 'lucide-react';

interface ModelSelectorProps {
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
}

export function ModelSelector({ selectedModelId, onSelectModel }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-elevated/70 hover:bg-surface-elevated border border-surface-border text-xs font-medium text-slate-300 hover:text-white transition-all shadow-sm"
      >
        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
        <span className="max-w-[130px] truncate">{activeModel.name}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-72 max-h-80 overflow-y-auto bg-surface-elevated border border-surface-border rounded-xl shadow-2xl backdrop-blur-md p-1.5 flex flex-col gap-1">
          <div className="px-2.5 py-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            Modelos de Antigravity Pro
          </div>

          {ANTIGRAVITY_MODELS.map((model) => {
            const isSelected = model.id === selectedModelId;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  onSelectModel(model.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all ${
                  isSelected
                    ? 'bg-blue-600/15 border border-blue-500/30 text-white'
                    : 'hover:bg-slate-800/60 text-slate-300 hover:text-white border border-transparent'
                }`}
              >
                <div className="mt-0.5 p-1 rounded bg-slate-800/80 text-blue-400">
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold truncate">{model.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{model.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 font-mono text-slate-400">
                      {Math.round(model.contextLimit / 1000)}k ctx
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/70 text-slate-400 capitalize">
                      {model.group === 'gemini' ? 'Google' : 'Third Party'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
