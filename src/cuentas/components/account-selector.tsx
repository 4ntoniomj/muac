'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { AccountWithQuota } from '@/shared/types/account';
import { User, ChevronDown, Check, Plus, RefreshCw, Zap, ExternalLink } from 'lucide-react';

interface AccountSelectorProps {
  accounts: AccountWithQuota[];
  activeAccountId: string;
  onSelectAccount: (accountId: string) => void;
  onOpenSettings: (tab: 'cuentas' | 'rotacion') => void;
  onRotateNext?: () => void;
}

export function AccountSelector({
  accounts,
  activeAccountId,
  onSelectAccount,
  onOpenSettings,
  onRotateNext,
}: AccountSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-medium text-amber-300 transition-all shadow-sm"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Vincular Cuenta</span>
      </button>
    );
  }

  // Quota rápida de la cuenta activa
  const gemini5h = activeAccount?.quota ? Math.round(activeAccount.quota.gemini5hRemaining * 100) : null;
  const geminiWeekly = activeAccount?.quota ? Math.round(activeAccount.quota.geminiWeeklyRemaining * 100) : null;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-elevated/70 hover:bg-surface-elevated border border-surface-border text-xs font-medium text-slate-300 hover:text-white transition-all shadow-sm"
      >
        <div className="w-4 h-4 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center text-[10px] font-bold">
          {activeAccount.email[0]?.toUpperCase() || 'U'}
        </div>
        <span className="max-w-[120px] truncate">{activeAccount.email}</span>

        {gemini5h !== null && (
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
              gemini5h < 10
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : gemini5h < 30
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {gemini5h}% 5h
          </span>
        )}

        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-80 bg-surface-elevated border border-surface-border rounded-xl shadow-2xl backdrop-blur-md p-1.5 flex flex-col gap-1">
          <div className="px-2.5 py-1.5 flex items-center justify-between text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            <span>Cuentas Vinculadas ({accounts.length})</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenSettings('rotacion');
              }}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 normal-case font-normal"
            >
              <Zap className="w-3 h-3" />
              <span>Pool de rotación</span>
            </button>
          </div>

          {accounts.map((acc) => {
            const isSelected = acc.id === activeAccountId;
            const q5h = acc.quota ? Math.round(acc.quota.gemini5hRemaining * 100) : null;
            const qWeekly = acc.quota ? Math.round(acc.quota.geminiWeeklyRemaining * 100) : null;

            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  onSelectAccount(acc.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                  isSelected
                    ? 'bg-blue-600/15 border border-blue-500/30 text-white'
                    : 'hover:bg-slate-800/60 text-slate-300 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
                    {acc.email[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{acc.email}</span>
                      {acc.inRotationPool && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Incluida en Pool" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                      <span>5h: {q5h !== null ? `${q5h}%` : '—'}</span>
                      <span>Semanal: {qWeekly !== null ? `${qWeekly}%` : '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={`/api/auth/verify?accountId=${acc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded text-slate-400 hover:text-blue-300 hover:bg-slate-700/60 transition-all"
                    title="Abrir verificación oficial de Google en una pestaña nueva"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                </div>
              </button>
            );
          })}

          <div className="mt-1 pt-1.5 border-t border-slate-800 flex items-center justify-between px-2 py-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenSettings('cuentas');
              }}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
            >
              <Plus className="w-3 h-3" />
              <span>Añadir cuenta Google</span>
            </button>

            {onRotateNext && accounts.filter((a) => a.inRotationPool).length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onRotateNext();
                }}
                className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px] font-medium bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded border border-amber-500/20 transition-all"
                title="Conmutar de inmediato a la siguiente cuenta del pool"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Iterar a siguiente</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
