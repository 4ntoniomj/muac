'use client';

import React from 'react';
import { Brain, Sliders } from 'lucide-react';
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
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface border border-surface-border text-xs text-slate-500 cursor-not-allowed select-none"
        title="El esfuerzo de razonamiento para este modelo está fijado por la arquitectura y no es configurable"
      >
        <Brain className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-[11px] font-medium text-slate-500">Esfuerzo:</span>
        <span className="text-[11px] font-mono text-slate-600">Auto</span>
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
      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-surface-border text-xs select-none transition-colors"
      title="Nivel de esfuerzo de razonamiento del modelo"
    >
      <div className="flex items-center gap-1 text-slate-400 pr-1">
        <Sliders className="w-3 h-3 text-slate-400" />
        <span className="text-[11px] font-medium hidden sm:inline">Esfuerzo:</span>
      </div>

      <div className="flex items-center gap-0.5 bg-surface-elevated p-0.5 rounded-md border border-surface-border">
        {availableLevels.map((lvl) => {
          const isActive = effort === lvl.id;
          return (
            <button
              key={lvl.id}
              type="button"
              onClick={() => onChangeEffort(lvl.id)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                isActive
                  ? 'bg-accent/20 text-accent font-semibold border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover border border-transparent'
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
