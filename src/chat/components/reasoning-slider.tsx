'use client';

import React from 'react';
import { Brain, Sparkles, Sliders } from 'lucide-react';
import { findModel } from '@/shared/types/model';

interface ReasoningSliderProps {
  modelId: string;
  effort: 'low' | 'medium' | 'high';
  onChangeEffort: (effort: 'low' | 'medium' | 'high') => void;
}

export function ReasoningSlider({
  modelId,
  effort,
  onChangeEffort,
}: ReasoningSliderProps) {
  const model = findModel(modelId);

  // Si el modelo no soporta configuración de esfuerzo (ej. Claude o GPT-OSS)
  if (!model.effortSupported) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-elevated/40 border border-surface-border/50 text-xs text-slate-500 cursor-not-allowed select-none shadow-sm"
        title="El esfuerzo de razonamiento para este modelo está fijado por la arquitectura y no es configurable"
      >
        <Brain className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-[11px] font-medium text-slate-400">Esfuerzo:</span>
        <span className="text-[11px] font-mono text-slate-500">Auto</span>
      </div>
    );
  }

  const supported = model.supportedEfforts && model.supportedEfforts.length > 0
    ? model.supportedEfforts
    : ['low', 'medium', 'high'];

  const levels: Array<{ id: 'low' | 'medium' | 'high'; label: string; short: string }> = [
    { id: 'low', label: 'Bajo', short: 'Bajo' },
    { id: 'medium', label: 'Medio', short: 'Medio' },
    { id: 'high', label: 'Alto', short: 'Alto' },
  ];

  // Filtrar según soporte del modelo (por ejemplo Gemini 3.1 Pro solo tiene low y high)
  const availableLevels = levels.filter((l) => supported.includes(l.id));

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-elevated/70 hover:bg-surface-elevated border border-surface-border text-xs transition-all shadow-sm select-none"
      title="Nivel de esfuerzo de razonamiento del modelo"
    >
      <div className="flex items-center gap-1 text-slate-400 pr-1">
        <Sliders className="w-3 h-3 text-purple-400" />
        <span className="text-[11px] font-medium hidden sm:inline">Esfuerzo:</span>
      </div>

      <div className="flex items-center gap-0.5 bg-slate-900/60 p-0.5 rounded-md border border-surface-border/60">
        {availableLevels.map((lvl) => {
          const isActive = effort === lvl.id;
          return (
            <button
              key={lvl.id}
              type="button"
              onClick={() => onChangeEffort(lvl.id)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                isActive
                  ? 'bg-purple-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {lvl.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
