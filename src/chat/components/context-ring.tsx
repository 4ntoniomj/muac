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
  let ringGlow = 'rgba(16, 185, 129, 0.3)';
  if (usage?.colorState === 'danger') {
    strokeColor = '#ef4444'; // red-500
    ringGlow = 'rgba(239, 68, 68, 0.4)';
  } else if (usage?.colorState === 'warning') {
    strokeColor = '#f59e0b'; // amber-500
    ringGlow = 'rgba(245, 158, 11, 0.35)';
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
          stroke="#262a3b"
          strokeWidth="3"
          fill="transparent"
        />
        {/* Progreso del aro */}
        <circle
          cx="16"
          cy="16"
          r={radius}
          stroke={strokeColor}
          strokeWidth="3"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-out"
          style={{
            filter: `drop-shadow(0 0 4px ${ringGlow})`,
          }}
        />
      </svg>

      {/* Porcentaje en el centro */}
      <span className="absolute text-[9px] font-mono font-medium text-slate-400 group-hover:text-white transition-colors">
        {displayPercent}
      </span>

      {/* Tooltip contextual flotante (hacia arriba) */}
      {showTooltip && (
        <div className="absolute bottom-full mb-2.5 right-0 z-50 px-3 py-2 bg-slate-900/95 border border-slate-700/80 rounded-lg shadow-xl backdrop-blur-md text-xs whitespace-nowrap pointer-events-none transition-all">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: strokeColor }}
            />
            <span>Ventana de Contexto ({modelName})</span>
          </div>
          <div className="text-slate-400 font-mono text-[11px] flex flex-col gap-0.5">
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
