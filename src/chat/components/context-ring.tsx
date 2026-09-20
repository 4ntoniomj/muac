'use client';

import React, { useState } from 'react';
import type { ContextWindowUsage } from '@/shared/types/chat';

interface ContextRingProps {
  usage: ContextWindowUsage;
  modelName: string;
}

export function ContextRing({ usage, modelName }: ContextRingProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const validPercent = Number.isFinite(usage?.percentage) ? usage.percentage : 0;
  // Limitar porcentaje entre 0 y 100 de forma segura
  const clampedPercent = Math.min(100, Math.max(0, validPercent));
  const strokeDashoffset = circumference - (clampedPercent / 100) * circumference;

  let strokeColor = '#10b981'; // safe: emerald-500
  if (usage?.colorState === 'danger') {
    strokeColor = '#ef4444'; // red-500
  } else if (usage?.colorState === 'warning') {
    strokeColor = '#f59e0b'; // amber-500
  }

  const formatNumber = (n: number) => {
    return new Intl.NumberFormat('es-ES').format(Number.isFinite(n) ? n : 0);
  };

  const displayPercent =
    clampedPercent > 0 && clampedPercent < 1 ? '<1%' : `${Math.round(clampedPercent)}%`;

  return (
    <div
      className="relative flex items-center justify-center cursor-pointer group select-none"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={`Ventana de contexto: ${displayPercent} de ${modelName}`}
    >
      <svg className="w-8 h-8 transform -rotate-90">
        {/* Fondo del aro */}
        <circle
          cx="16"
          cy="16"
          r={radius}
          stroke="#1a1e2b"
          strokeWidth="2.5"
          fill="transparent"
        />
        {/* Progreso del aro */}
        <circle
          cx="16"
          cy="16"
          r={radius}
          stroke={strokeColor}
          strokeWidth="2.5"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-out"
        />
      </svg>

      {/* Porcentaje en el centro */}
      <span className="absolute font-mono text-[9px] text-slate-400 group-hover:text-white transition-colors">
        {displayPercent}
      </span>

      {/* Tooltip contextual flotante (hacia arriba) */}
      {showTooltip && (
        <div className="absolute bottom-full mb-2.5 right-0 z-50 bg-surface-elevated border border-surface-border rounded-lg shadow-xl p-2.5 text-xs font-mono whitespace-nowrap pointer-events-none transition-all">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1.5 font-sans">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: strokeColor }}
            />
            <span>Ventana de Contexto ({modelName})</span>
          </div>
          <div className="text-slate-400 text-[11px] flex flex-col gap-0.5">
            <div>
              Consumido:{' '}
              <span className="text-slate-200 font-medium">
                {formatNumber(usage?.usedTokens || 0)}
              </span>{' '}
              / {formatNumber(usage?.maxTokens || 1048576)} tokens
            </div>
            <div>
              Uso actual:{' '}
              <span className="font-medium text-slate-200">{validPercent.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
