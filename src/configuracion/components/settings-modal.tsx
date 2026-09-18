'use client';

import React, { useState } from 'react';
import type { AccountWithQuota } from '@/shared/types/account';
import type { GlobalSettings } from '@/shared/types/settings';
import type { RotationEvent } from '@/shared/types/quota';
import { ANTIGRAVITY_MODELS } from '@/shared/types/model';
import {
  X,
  Zap,
  Users,
  Sliders,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldCheck,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountWithQuota[];
  settings: GlobalSettings;
  rotationLogs: RotationEvent[];
  initialTab?: 'rotacion' | 'cuentas' | 'general';
  onUpdateSettings: (newSettings: Partial<GlobalSettings>) => Promise<void>;
  onTogglePool: (accountId: string, inPool: boolean) => Promise<void>;
  onSetActiveAccount: (accountId: string) => Promise<void>;
  onDeleteAccount: (accountId: string) => Promise<void>;
  onImportSystemAccount: () => Promise<void>;
  onRefreshQuotas: () => Promise<void>;
}

export function SettingsModal({
  isOpen,
  onClose,
  accounts,
  settings,
  rotationLogs,
  initialTab = 'rotacion',
  onUpdateSettings,
  onTogglePool,
  onSetActiveAccount,
  onDeleteAccount,
  onImportSystemAccount,
  onRefreshQuotas,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'rotacion' | 'cuentas' | 'general'>(initialTab);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [defaultModelId, setDefaultModelId] = useState(settings.defaultModelId);
  const [reasoningEffort, setReasoningEffort] = useState(settings.reasoningEffort);
  const [autoRotate5h, setAutoRotate5h] = useState(settings.autoRotateOn5h);
  const [autoRotateWeekly, setAutoRotateWeekly] = useState(settings.autoRotateOnWeekly);
  const [threshold, setThreshold] = useState(settings.rotationThresholdFraction * 100);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleSaveGeneral = async () => {
    await onUpdateSettings({
      systemPrompt,
      defaultModelId,
      reasoningEffort,
      autoRotateOn5h: autoRotate5h,
      autoRotateOnWeekly: autoRotateWeekly,
      rotationThresholdFraction: threshold / 100,
    });
    alert('Configuración guardada correctamente.');
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshQuotas();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-surface border border-surface-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Encabezado del Modal */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">Configuración Global</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Pestañas */}
        <div className="px-6 border-b border-surface-border flex gap-4 bg-surface/50">
          <button
            type="button"
            onClick={() => setActiveTab('rotacion')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'rotacion'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Pool de Rotación ({accounts.filter((a) => a.inRotationPool).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cuentas')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'cuentas'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Cuentas Google OAuth ({accounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'general'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Ajustes Generales</span>
          </button>
        </div>

        {/* Contenido de la Pestaña */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6 text-xs text-slate-300">
          {/* 1. Pestaña Pool de Rotación */}
          {activeTab === 'rotacion' && (
            <div className="flex flex-col gap-5">
              <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-800/40 flex items-start gap-3">
                <Zap className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-300 mb-1">
                    Conmutación Automática por Límite de Tokens
                  </h4>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Selecciona qué cuentas deben participar en el pool. Cuando la cuenta activa alcance el límite
                    de 5 horas o el límite semanal de Antigravity Pro, el sistema conmutará automáticamente a la
                    siguiente cuenta seleccionada sin interrumpir el chat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-slate-700 text-slate-300 hover:text-white border border-surface-border text-[11px] font-medium flex items-center gap-1.5 transition-all shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
                  <span>Refrescar cuotas</span>
                </button>
              </div>

              {/* Lista de cuentas en el Pool */}
              <div className="flex flex-col gap-2.5">
                <h4 className="font-semibold text-slate-200">
                  Cuentas participantes en la iteración:
                </h4>

                {accounts.length === 0 ? (
                  <div className="p-4 rounded-xl bg-surface-elevated/40 border border-surface-border text-center text-slate-500">
                    No tienes cuentas añadidas. Ve a la pestaña «Cuentas Google OAuth» para añadir cuentas.
                  </div>
                ) : (
                  accounts.map((acc) => {
                    const q5h = acc.quota ? Math.round(acc.quota.gemini5hRemaining * 100) : 100;
                    const qWeekly = acc.quota ? Math.round(acc.quota.geminiWeeklyRemaining * 100) : 100;

                    return (
                      <div
                        key={acc.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col gap-3 ${
                          acc.inRotationPool
                            ? 'bg-surface-elevated/80 border-blue-500/40 shadow-sm'
                            : 'bg-surface-elevated/30 border-surface-border opacity-70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={acc.inRotationPool}
                              onChange={(e) => onTogglePool(acc.id, e.target.checked)}
                              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-200">{acc.email}</span>
                                {acc.isActive && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                                    ACTIVA
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {acc.displayName || 'Cuenta Google'}
                              </span>
                            </div>
                          </label>

                          {!acc.isActive && (
                            <button
                              type="button"
                              onClick={() => onSetActiveAccount(acc.id)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-all border border-slate-700"
                            >
                              Activar ahora
                            </button>
                          )}
                        </div>

                        {/* Barras de progreso de cuota real */}
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                          <div>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-slate-400">Límite 5 Horas:</span>
                              <span
                                className={`font-mono font-medium ${
                                  q5h < 15 ? 'text-red-400' : q5h < 35 ? 'text-amber-400' : 'text-emerald-400'
                                }`}
                              >
                                {q5h}% restante
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  q5h < 15 ? 'bg-red-500' : q5h < 35 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${q5h}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-slate-400">Límite Semanal:</span>
                              <span
                                className={`font-mono font-medium ${
                                  qWeekly < 15 ? 'text-red-400' : qWeekly < 35 ? 'text-amber-400' : 'text-emerald-400'
                                }`}
                              >
                                {qWeekly}% restante
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  qWeekly < 15 ? 'bg-red-500' : qWeekly < 35 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${qWeekly}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Historial de rotaciones recientes */}
              <div className="flex flex-col gap-2 pt-3">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  <span>Historial de Rotaciones Automáticas</span>
                </div>

                {rotationLogs.length === 0 ? (
                  <div className="text-[11px] text-slate-500 italic">
                    Aún no se han producido conmutaciones automáticas en esta sesión.
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-surface-border divide-y divide-slate-800/80 bg-surface-elevated/40">
                    {rotationLogs.map((log) => (
                      <div key={log.id} className="p-2.5 flex items-center justify-between text-[11px]">
                        <div>
                          <div className="text-slate-200">
                            <span className="font-mono text-red-300">{log.fromEmail}</span> ➔{' '}
                            <span className="font-mono text-emerald-300">{log.toEmail}</span>
                          </div>
                          <div className="text-slate-400 text-[10px]">{log.reason}</div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. Pestaña Cuentas Google OAuth */}
          {activeTab === 'cuentas' && (
            <div className="flex flex-col gap-5">
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/30 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-emerald-300 mb-1">
                    Multi-Cuenta Google sin colisión de sesión
                  </h4>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    El botón «Añadir cuenta Google» abre la autorización con <code className="text-slate-300 bg-slate-800 px-1 py-0.5 rounded">prompt=select_account</code>.
                    Esto fuerza a Google a mostrar el selector de cuentas ("Elige una cuenta / Usar otra cuenta")
                    para que puedas iniciar sesión con tu segunda o tercera cuenta sin que Google tome automáticamente la primera.
                  </p>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-3">
                <a
                  href="/api/auth/google"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-md shadow-blue-600/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir nueva cuenta de Google</span>
                </a>

                <button
                  type="button"
                  onClick={onImportSystemAccount}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-elevated hover:bg-slate-700 text-slate-200 border border-surface-border font-medium transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Importar cuenta activa del sistema</span>
                </button>
              </div>

              {/* Listado de cuentas */}
              <div className="flex flex-col gap-2">
                <h4 className="font-semibold text-slate-200">Cuentas vinculadas actualmente:</h4>

                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
                        {acc.email[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-200">{acc.email}</span>
                          {acc.isActive && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                              ACTIVA
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {acc.displayName || 'Google Account'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!acc.isActive && (
                        <button
                          type="button"
                          onClick={() => onSetActiveAccount(acc.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-all"
                        >
                          Usar como activa
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Eliminar la cuenta ${acc.email}?`)) {
                            onDeleteAccount(acc.id);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                        title="Eliminar cuenta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Pestaña Ajustes Generales */}
          {activeTab === 'general' && (
            <div className="flex flex-col gap-4">
              <p className="text-[11px] text-slate-400">
                Estas configuraciones son globales y se mantienen de forma idéntica sin importar con qué
                cuenta estés operando en cada momento.
              </p>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Modelo por defecto de Antigravity:
                </label>
                <select
                  value={defaultModelId}
                  onChange={(e) => setDefaultModelId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {ANTIGRAVITY_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({Math.round(m.contextLimit / 1000)}k ctx)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Nivel de Razonamiento (Thinking Effort):
                </label>
                <select
                  value={reasoningEffort}
                  onChange={(e) => setReasoningEffort(e.target.value as 'low' | 'medium' | 'high')}
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="low">Bajo (Low) - Respuestas más rápidas</option>
                  <option value="medium">Medio (Medium) - Razonamiento balanceado</option>
                  <option value="high">Alto (High) - Pensamiento exhaustivo</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Instrucciones de Sistema (System Prompt):
                </label>
                <textarea
                  rows={4}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-[11px] resize-none"
                  placeholder="Instrucciones para el asistente..."
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveGeneral}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-md shadow-blue-600/20"
                >
                  Guardar Preferencias
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
