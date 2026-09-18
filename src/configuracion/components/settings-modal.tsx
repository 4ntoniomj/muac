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
  ExternalLink,
  Clock,
} from 'lucide-react';
import { formatTimeUntilReset, isQuotaExhausted } from '@/shared/quota-utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountWithQuota[];
  settings: GlobalSettings;
  rotationLogs: RotationEvent[];
  initialTab?: 'rotacion' | 'cuentas' | 'permisos';
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
  const [activeTab, setActiveTab] = useState<'rotacion' | 'cuentas' | 'permisos'>(initialTab);
  const [defaultModelId, setDefaultModelId] = useState(settings.defaultModelId);
  const [reasoningEffort, setReasoningEffort] = useState(settings.reasoningEffort);
  const [autoRotate5h, setAutoRotate5h] = useState(settings.autoRotateOn5h);
  const [autoRotateWeekly, setAutoRotateWeekly] = useState(settings.autoRotateOnWeekly);
  const [threshold, setThreshold] = useState(settings.rotationThresholdFraction * 100);
  const [dangerouslySkipPermissions, setDangerouslySkipPermissions] = useState(settings.dangerouslySkipPermissions ?? true);
  const [agentMode, setAgentMode] = useState<'default' | 'accept-edits' | 'plan'>(settings.agentMode || 'default');
  const [sandboxMode, setSandboxMode] = useState(settings.sandboxMode ?? false);
  const [defaultProjectPath, setDefaultProjectPath] = useState(settings.defaultProjectPath || '');
  const [toolPerms, setToolPerms] = useState(
    settings.allowedPermissions || {
      terminalCommands: true,
      fileEdits: true,
      fileReads: true,
      webAccess: true,
      subagents: true,
    }
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [isImportingToken, setIsImportingToken] = useState(false);
  const [verifyingAccountId, setVerifyingAccountId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVerifyAccount = async (accId: string) => {
    setVerifyingAccountId(accId);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_verification', accountId: accId }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.eligible) {
          alert(`¡La cuenta ${data.email} ya está verificada y activa en Google Antigravity!`);
        } else if (data.verificationUrl) {
          window.open(data.verificationUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        alert(data.error || 'No se pudo comprobar la elegibilidad.');
      }
    } catch {
      alert('Error de conexión al verificar elegibilidad.');
    } finally {
      setVerifyingAccountId(null);
    }
  };

  const handleSaveGeneral = async () => {
    await onUpdateSettings({
      defaultModelId,
      reasoningEffort,
      autoRotateOn5h: autoRotate5h,
      autoRotateOnWeekly: autoRotateWeekly,
      rotationThresholdFraction: threshold / 100,
      dangerouslySkipPermissions,
      agentMode,
      sandboxMode,
      defaultProjectPath,
      allowedPermissions: toolPerms,
    });
    alert('Configuración guardada correctamente.');
  };

  const handleManualTokenImport = async () => {
    if (!manualTokenInput.trim()) return;
    setIsImportingToken(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_token', tokenJson: manualTokenInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Token importado exitosamente.');
        setManualTokenInput('');
        await onRefreshQuotas();
      } else {
        alert(data.error || 'Fallo al importar token');
      }
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    } finally {
      setIsImportingToken(false);
    }
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
            onClick={() => setActiveTab('permisos')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'permisos'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Permisos y Agente</span>
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
                    const isExhausted = isQuotaExhausted(
                      acc.quota?.gemini5hRemaining,
                      acc.quota?.geminiWeeklyRemaining,
                      acc.quota?.gemini5hReset,
                      acc.quota?.geminiWeeklyReset
                    );
                    const reset5hText = formatTimeUntilReset(acc.quota?.gemini5hReset);
                    const resetWeeklyText = formatTimeUntilReset(acc.quota?.geminiWeeklyReset);

                    return (
                      <div
                        key={acc.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col gap-3 ${
                          isExhausted
                            ? 'bg-slate-950/80 border-slate-800/80 opacity-60 grayscale-[35%]'
                            : acc.inRotationPool
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
                                <span className={`font-semibold ${isExhausted ? 'text-slate-400' : 'text-slate-200'}`}>
                                  {acc.email}
                                </span>
                                {isExhausted && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-mono border border-red-500/30">
                                    AGOTADA
                                  </span>
                                )}
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
                            {reset5hText && (
                              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400 font-mono">
                                <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                                <span>Reset: {reset5hText}</span>
                              </div>
                            )}
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
                            {resetWeeklyText && (
                              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400 font-mono">
                                <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                                <span>Reset: {resetWeeklyText}</span>
                              </div>
                            )}
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
                      <a
                        href={`/api/auth/verify?accountId=${acc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-[11px] font-medium transition-all"
                        title="Abrir activación en Google en una pestaña nueva"
                      >
                        <ExternalLink className="w-3 h-3 text-blue-400" />
                        <span>Activar en Google ↗</span>
                      </a>

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

              {/* Importación manual de Token / JSON */}
              <div className="p-4 rounded-xl bg-surface-elevated/70 border border-surface-border flex flex-col gap-2.5 mt-2">
                <h5 className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-400" />
                  <span>Importar token manualmente (Avanzado)</span>
                </h5>
                <p className="text-[11px] text-slate-400">
                  Si deseas importar un token o credenciales JSON directamente sin pasar por el navegador:
                </p>
                <textarea
                  rows={2}
                  value={manualTokenInput}
                  onChange={(e) => setManualTokenInput(e.target.value)}
                  placeholder='Pega aquí el JSON del token (ej: {"token": {"access_token": "...", "refresh_token": "..."}})...'
                  className="w-full px-3 py-2 rounded-xl bg-background border border-surface-border text-slate-200 text-[11px] font-mono resize-none focus:outline-none focus:border-blue-500"
                />
                <div>
                  <button
                    type="button"
                    onClick={handleManualTokenImport}
                    disabled={!manualTokenInput.trim() || isImportingToken}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-all disabled:opacity-50"
                  >
                    {isImportingToken ? 'Importando...' : 'Importar Token'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. Pestaña Permisos y Agente */}
          {activeTab === 'permisos' && (
            <div className="flex flex-col gap-5">
              <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-800/40 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-indigo-300 mb-1">
                    Permisos y Configuración del Agente
                  </h4>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Configura el modelo por defecto, nivel de razonamiento, instrucciones de sistema y los permisos
                    de ejecución con herramientas en el workspace.
                  </p>
                </div>
              </div>

              {/* Modelo por defecto y Nivel de Razonamiento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex flex-col gap-2">
                  <label className="text-slate-200 font-semibold text-xs">
                    Modelo por defecto de Antigravity:
                  </label>
                  <select
                    value={defaultModelId}
                    onChange={(e) => setDefaultModelId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-surface-border text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                  >
                    {ANTIGRAVITY_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({Math.round(m.contextLimit / 1000)}k ctx)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex flex-col gap-2">
                  <label className="text-slate-200 font-semibold text-xs">
                    Nivel de Razonamiento (Thinking Effort):
                  </label>
                  <select
                    value={reasoningEffort}
                    onChange={(e) => setReasoningEffort(e.target.value as 'low' | 'medium' | 'high')}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-surface-border text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                  >
                    <option value="low">Bajo (Low) - Respuestas rápidas</option>
                    <option value="medium">Medio (Medium) - Razonamiento balanceado</option>
                    <option value="high">Alto (High) - Pensamiento exhaustivo</option>
                  </select>
                </div>
              </div>

              {/* Permisos y Capacidades Seleccionables del Agente */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex flex-col gap-3">
                <div>
                  <h5 className="font-semibold text-slate-200 text-xs mb-1">
                    Permisos y Capacidades del Agente
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    Selecciona individualmente las acciones y herramientas que el agente tiene autorización para ejecutar:
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-surface border border-surface-border hover:border-slate-700 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={toolPerms.terminalCommands}
                      onChange={(e) => setToolPerms({ ...toolPerms, terminalCommands: e.target.checked })}
                      className="w-4 h-4 mt-0.5 accent-blue-600 rounded cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-medium text-slate-200 block text-xs">Ejecución en Terminal (Shell)</span>
                      <span className="text-[10px] text-slate-400">Comandos bash, tests, npm, git y compilaciones del sistema.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-surface border border-surface-border hover:border-slate-700 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={toolPerms.fileEdits}
                      onChange={(e) => setToolPerms({ ...toolPerms, fileEdits: e.target.checked })}
                      className="w-4 h-4 mt-0.5 accent-blue-600 rounded cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-medium text-slate-200 block text-xs">Escritura y Edición de Archivos</span>
                      <span className="text-[10px] text-slate-400">Crear nuevos ficheros, refactorizar código y aplicar cambios.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-surface border border-surface-border hover:border-slate-700 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={toolPerms.fileReads}
                      onChange={(e) => setToolPerms({ ...toolPerms, fileReads: e.target.checked })}
                      className="w-4 h-4 mt-0.5 accent-blue-600 rounded cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-medium text-slate-200 block text-xs">Lectura del Workspace</span>
                      <span className="text-[10px] text-slate-400">Examinar carpetas, búsquedas grep y lectura de archivos.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-surface border border-surface-border hover:border-slate-700 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={toolPerms.webAccess}
                      onChange={(e) => setToolPerms({ ...toolPerms, webAccess: e.target.checked })}
                      className="w-4 h-4 mt-0.5 accent-blue-600 rounded cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-medium text-slate-200 block text-xs">Búsqueda y Navegación Web</span>
                      <span className="text-[10px] text-slate-400">Consultas de información técnica y descarga de URLs externas.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-surface border border-surface-border hover:border-slate-700 cursor-pointer transition-all md:col-span-2">
                    <input
                      type="checkbox"
                      checked={toolPerms.subagents}
                      onChange={(e) => setToolPerms({ ...toolPerms, subagents: e.target.checked })}
                      className="w-4 h-4 mt-0.5 accent-blue-600 rounded cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-medium text-slate-200 block text-xs">Invocación de Subagentes</span>
                      <span className="text-[10px] text-slate-400">Delegar tareas en subagentes en paralelo y coordinar ejecución.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 1. Dangerously Skip Permissions */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-between">
                <div className="max-w-[80%]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-200">Auto-aprobar permisos de herramientas</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                      --dangerously-skip-permissions
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Permite al agente leer y escribir archivos, ejecutar tests y comandos en terminal sin pausar ni esperar confirmación interactiva. Imprescindible para operar como agente autónomo en streaming web.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={dangerouslySkipPermissions}
                  onChange={(e) => setDangerouslySkipPermissions(e.target.checked)}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              {/* 2. Modo de Ejecución */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">Modo de Ejecución del Agente</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                    --mode
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Define el comportamiento predeterminado del modelo al abordar tareas de desarrollo:
                </p>
                <select
                  value={agentMode}
                  onChange={(e) => setAgentMode(e.target.value as 'default' | 'accept-edits' | 'plan')}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-surface-border text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                >
                  <option value="default">Por defecto (Ejecución estándar interactiva)</option>
                  <option value="accept-edits">Aceptar ediciones (accept-edits: aplica cambios de código directamente)</option>
                  <option value="plan">Modo Planificación (plan: solo elabora planes sin modificar código)</option>
                </select>
              </div>

              {/* 3. Sandbox */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-between">
                <div className="max-w-[80%]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-200">Ejecución en Sandbox de Terminal</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                      --sandbox
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Aplica restricciones de seguridad a las llamadas de terminal ejecutadas por el agente.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={sandboxMode}
                  onChange={(e) => setSandboxMode(e.target.checked)}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              {/* 4. Ruta por defecto para proyectos */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex flex-col gap-2">
                <span className="font-semibold text-slate-200">Ruta de Proyecto por Defecto (Workspace)</span>
                <p className="text-[11px] text-slate-400">
                  Directorio local que se usará como base para nuevas conversaciones si no se especifica uno concreto:
                </p>
                <input
                  type="text"
                  value={defaultProjectPath}
                  onChange={(e) => setDefaultProjectPath(e.target.value)}
                  placeholder="/home/usuario/mi-proyecto"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-surface-border text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveGeneral}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-md shadow-blue-600/20"
                >
                  Guardar Configuración
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
