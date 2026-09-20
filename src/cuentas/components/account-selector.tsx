'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { AccountWithQuota } from '@/shared/types/account';
import { findModel } from '@/shared/types/model';
import { User, ChevronDown, Check, Plus, RefreshCw, Zap, ExternalLink, Clock } from 'lucide-react';
import { formatTimeUntilReset, isQuotaExhausted } from '@/shared/quota-utils';

interface AccountSelectorProps {
  accounts: AccountWithQuota[];
  activeAccountId: string;
  onSelectAccount: (accountId: string) => void;
  onOpenSettings: (tab: 'cuentas' | 'rotacion') => void;
  onRotateNext?: () => void;
  activeModelId?: string;
  onRefreshQuotas?: () => Promise<void> | void;
}

export function AccountSelector({
  accounts,
  activeAccountId,
  onSelectAccount,
  onOpenSettings,
  onRotateNext,
  activeModelId = 'gemini-3.8-flash',
  onRefreshQuotas,
}: AccountSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (accounts.length === 0) {
    return (
      <button
        type="button"
        onClick={() => onOpenSettings('cuentas')}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-xs font-medium text-accent hover:text-white transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Vincular Cuenta</span>
      </button>
    );
  }

  const activeModel = findModel(activeModelId);
  const is3p = activeModel.group === '3p';

  // Quota rápida de la cuenta activa según el grupo del modelo seleccionado (Gemini vs Claude/GPT)
  const quota5hRemaining = is3p
    ? activeAccount?.quota?.thirdParty5hRemaining
    : activeAccount?.quota?.gemini5hRemaining;
  const quotaWeeklyRemaining = is3p
    ? activeAccount?.quota?.thirdPartyWeeklyRemaining
    : activeAccount?.quota?.geminiWeeklyRemaining;

  const current5hPct = quota5hRemaining !== undefined && quota5hRemaining !== null
    ? Math.round(quota5hRemaining * 100)
    : null;
  const currentWeeklyPct = quotaWeeklyRemaining !== undefined && quotaWeeklyRemaining !== null
    ? Math.round(quotaWeeklyRemaining * 100)
    : null;

  const activeReset5h = is3p ? activeAccount?.quota?.thirdParty5hReset : activeAccount?.quota?.gemini5hReset;
  const activeResetWeekly = is3p ? activeAccount?.quota?.thirdPartyWeeklyReset : activeAccount?.quota?.geminiWeeklyReset;
  const activeReset5hText = formatTimeUntilReset(activeReset5h);
  const activeResetWeeklyText = formatTimeUntilReset(activeResetWeekly);
  const isActiveExhausted = isQuotaExhausted(quota5hRemaining, quotaWeeklyRemaining, activeReset5h, activeResetWeekly);

  const handleTriggerRefresh = async () => {
    if (!onRefreshQuotas || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefreshQuotas();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-xs text-slate-300 hover:text-white px-2.5 py-1.5 transition-colors ${
          isActiveExhausted ? 'opacity-70 grayscale' : ''
        }`}
        title={`Cuenta activa: ${activeAccount.email} | 5h: ${current5hPct ?? '—'}% (Reset: ${activeReset5hText || 'N/A'}) | Semanal: ${currentWeeklyPct ?? '—'}% (Reset: ${activeResetWeeklyText || 'N/A'})`}
      >
        <div className="w-4 h-4 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] font-bold shrink-0">
          {activeAccount.email[0]?.toUpperCase() || 'U'}
        </div>
        <span className="max-w-[120px] truncate">{activeAccount.email}</span>

        {isActiveExhausted ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-red-500/15 text-red-300 border border-red-500/30 flex items-center gap-1">
            <span>AGOTADA</span>
            {activeReset5hText && activeReset5hText !== 'Reestablecido' && (
              <span className="text-[9px] opacity-75">({activeReset5hText})</span>
            )}
          </span>
        ) : current5hPct !== null ? (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1 ${
              current5hPct < 10
                ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                : current5hPct < 30
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            <span>{current5hPct}% {is3p ? '3P' : '5h'}</span>
            {activeReset5hText && activeReset5hText !== 'Reestablecido' && (
              <span className="text-[9px] opacity-75 border-l border-current/30 pl-1">
                {activeReset5hText}
              </span>
            )}
          </span>
        ) : null}

        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-96 bg-surface-elevated border border-surface-border rounded-lg shadow-xl p-1.5 text-xs flex flex-col gap-1">
          <div className="px-2.5 py-1.5 flex items-center justify-between text-[10px] font-semibold tracking-wider text-slate-500 uppercase font-mono">
            <span>Cuentas Vinculadas ({accounts.length})</span>
            <div className="flex items-center gap-2">
              {onRefreshQuotas && (
                <button
                  type="button"
                  onClick={handleTriggerRefresh}
                  disabled={isRefreshing}
                  className="text-slate-400 hover:text-white flex items-center gap-1 normal-case font-normal transition-colors"
                  title="Actualizar porcentajes de cuota desde agy"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-accent' : ''}`} />
                  <span>Refrescar</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings('rotacion');
                }}
                className="text-slate-400 hover:text-accent flex items-center gap-1 normal-case font-normal transition-colors"
              >
                <Zap className="w-3 h-3 text-accent" />
                <span>Pool</span>
              </button>
            </div>
          </div>

          {accounts.map((acc) => {
            const isSelected = acc.id === activeAccountId;
            const q5h = acc.quota
              ? Math.round((is3p ? acc.quota.thirdParty5hRemaining : acc.quota.gemini5hRemaining) * 100)
              : null;
            const qWeekly = acc.quota
              ? Math.round((is3p ? acc.quota.thirdPartyWeeklyRemaining : acc.quota.geminiWeeklyRemaining) * 100)
              : null;

            const accReset5h = is3p ? acc.quota?.thirdParty5hReset : acc.quota?.gemini5hReset;
            const accResetWeekly = is3p ? acc.quota?.thirdPartyWeeklyReset : acc.quota?.geminiWeeklyReset;
            const accReset5hText = formatTimeUntilReset(accReset5h);
            const accResetWeeklyText = formatTimeUntilReset(accResetWeekly);
            const isExhausted = isQuotaExhausted(
              is3p ? acc.quota?.thirdParty5hRemaining : acc.quota?.gemini5hRemaining,
              is3p ? acc.quota?.thirdPartyWeeklyRemaining : acc.quota?.geminiWeeklyRemaining,
              accReset5h,
              accResetWeekly
            );

            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  onSelectAccount(acc.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-md text-left transition-colors ${
                  isExhausted
                    ? 'bg-surface/50 border border-surface-border/40 text-slate-500 opacity-60 grayscale-[35%]'
                    : isSelected
                    ? 'bg-accent/15 border border-accent/30 text-white rounded-md'
                    : 'hover:bg-surface-hover text-slate-300 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-surface border border-surface-border flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                    {acc.email[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-medium truncate ${isExhausted ? 'text-slate-400' : ''}`}>
                        {acc.email}
                      </span>
                      {isExhausted && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-mono border border-red-500/30 shrink-0">
                          AGOTADA
                        </span>
                      )}
                      {acc.inRotationPool && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" title="Incluida en Pool" />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 text-[10px] text-slate-400 font-mono mt-0.5">
                      <div className="flex items-center gap-2">
                        <span>5h ({is3p ? '3P' : 'Gemini'}): {q5h !== null ? `${q5h}%` : '—'}</span>
                        {accReset5hText && (
                          <span className="text-slate-500 text-[9px] flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                            {accReset5hText}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Semanal: {qWeekly !== null ? `${qWeekly}%` : '—'}</span>
                        {accResetWeeklyText && (
                          <span className="text-slate-500 text-[9px] flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                            {accResetWeeklyText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <a
                    href={`/api/auth/verify?accountId=${acc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded-md text-slate-400 hover:text-accent hover:bg-surface transition-colors"
                    title="Abrir verificación oficial de Google en una pestaña nueva"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {isSelected && <Check className="w-4 h-4 text-accent" />}
                </div>
              </button>
            );
          })}

          <div className="mt-1 pt-1.5 border-t border-surface-border flex items-center justify-between px-2 py-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenSettings('cuentas');
              }}
              className="text-slate-400 hover:text-accent flex items-center gap-1 text-[11px] transition-colors"
            >
              <Plus className="w-3 h-3 text-accent" />
              <span>Añadir cuenta Google</span>
            </button>

            {onRotateNext && accounts.filter((a) => a.inRotationPool).length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onRotateNext();
                }}
                className="text-slate-300 hover:text-white flex items-center gap-1 text-[11px] font-medium bg-surface hover:bg-surface-hover px-2 py-1 rounded-md border border-surface-border transition-colors"
                title="Conmutar de inmediato a la siguiente cuenta del pool"
              >
                <Zap className="w-3 h-3 text-accent" />
                <span>Iterar a siguiente</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
