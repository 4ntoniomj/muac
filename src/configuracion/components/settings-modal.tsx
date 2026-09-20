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
  AlertCircle,
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
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt || '');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [isImportingToken, setIsImportingToken] = useState(false);
  const [verifyingAccountId, setVerifyingAccountId] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState(settings.googleClientId || '');
  const [googleClientSecret, setGoogleClientSecret] = useState(settings.googleClientSecret || '');
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [credsSavedNotice, setCredsSavedNotice] = useState(false);

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
      systemPrompt,
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
      <div className="bg-surface border border-surface-border rounded-xl shadow-2xl overflow-hidden max-w-3xl w-full max-h-[88vh] flex flex-col font-sans">
        {/* Encabezado del Modal */}
        <div className="px-5 py-3.5 border-b border-surface-border bg-sidebar/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-surface-elevated border border-surface-border text-slate-300 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold tracking-tight text-white font-sans">
              Configuración Global
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barra de Pestañas */}
        <div className="px-5 border-b border-surface-border flex gap-4 bg-sidebar/50">
          <button
            type="button"
            onClick={() => setActiveTab('rotacion')}
            className={`py-3 text-xs flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'rotacion'
                ? 'border-accent text-white font-medium'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Pool de Rotación ({accounts.filter((a) => a.inRotationPool).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cuentas')}
            className={`py-3 text-xs flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'cuentas'
                ? 'border-accent text-white font-medium'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Cuentas Google OAuth ({accounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('permisos')}
            className={`py-3 text-xs flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'permisos'
                ? 'border-accent text-white font-medium'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Permisos y Agente</span>
          </button>
        </div>

        {/* Contenido de la Pestaña */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5 text-xs text-slate-300">
          {/* 1. Pestaña Pool de Rotación */}
          {activeTab === 'rotacion' && (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border flex items-start gap-3">
                <Zap className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-200 mb-1 text-xs">
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
                  className="bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white text-xs font-medium rounded-lg px-3 py-2 transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-accent' : ''}`} />
                  <span>Refrescar cuotas</span>
                </button>
              </div>

              {/* Lista de cuentas en el Pool */}
              <div className="flex flex-col gap-2.5">
                <h4 className="font-semibold text-slate-200 text-xs">
                  Cuentas participantes en la iteración:
                </h4>

                {accounts.length === 0 ? (
                  <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border text-center text-slate-500 text-xs">
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
                        className={`p-3.5 rounded-lg border transition-colors flex flex-col gap-3 ${
                          isExhausted
                            ? 'bg-surface border-surface-border opacity-60 grayscale-[30%]'
                            : acc.inRotationPool
                            ? 'bg-surface-elevated border-accent/40 shadow-sm'
                            : 'bg-surface-elevated/40 border-surface-border opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={acc.inRotationPool}
                              onChange={(e) => onTogglePool(acc.id, e.target.checked)}
                              className="w-4 h-4 rounded-md border-surface-border bg-surface text-accent focus:ring-accent focus:ring-offset-surface cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold text-xs ${isExhausted ? 'text-slate-400' : 'text-slate-200'}`}>
                                  {acc.email}
                                </span>
                                {isExhausted && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-400 font-mono border border-red-500/20">
                                    AGOTADA
                                  </span>
                                )}
                                {acc.isActive && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                                    ACTIVA
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-sans">
                                {acc.displayName || 'Cuenta Google'}
                              </span>
                            </div>
                          </label>

                          {!acc.isActive && (
                            <button
                              type="button"
                              onClick={() => onSetActiveAccount(acc.id)}
                              className="bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
                            >
                              Activar ahora
                            </button>
                          )}
                        </div>

                        {/* Barras de progreso de cuota real */}
                        <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-surface-border">
                          <div>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-slate-400 font-sans">Límite 5 Horas:</span>
                              <span
                                className={`font-mono text-[11px] font-medium ${
                                  q5h < 15 ? 'text-red-400' : q5h < 35 ? 'text-amber-400' : 'text-emerald-400'
                                }`}
                              >
                                {q5h}% restante
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-surface border border-surface-border-subtle rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 rounded-full ${
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
                              <span className="text-slate-400 font-sans">Límite Semanal:</span>
                              <span
                                className={`font-mono text-[11px] font-medium ${
                                  qWeekly < 15 ? 'text-red-400' : qWeekly < 35 ? 'text-amber-400' : 'text-emerald-400'
                                }`}
                              >
                                {qWeekly}% restante
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-surface border border-surface-border-subtle rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 rounded-full ${
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
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-1.5 text-slate-200 font-semibold text-xs">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  <span>Historial de Rotaciones Automáticas</span>
                </div>

                {rotationLogs.length === 0 ? (
                  <div className="text-[11px] text-slate-500 italic">
                    Aún no se han producido conmutaciones automáticas en esta sesión.
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-surface-border divide-y divide-surface-border bg-surface-elevated">
                    {rotationLogs.map((log) => (
                      <div key={log.id} className="p-2.5 flex items-center justify-between text-[11px]">
                        <div>
                          <div className="text-slate-200">
                            <span className="font-mono text-red-400">{log.fromEmail}</span> ➔{' '}
                            <span className="font-mono text-emerald-400">{log.toEmail}</span>
                          </div>
                          <div className="text-slate-400 text-[10px] font-sans">{log.reason}</div>
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
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-200 mb-1 text-xs">
                    Multi-Cuenta Google sin colisión de sesión
                  </h4>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    El botón «Añadir cuenta Google» abre la autorización con{' '}
                    <code className="text-slate-300 bg-surface border border-surface-border px-1 py-0.5 rounded-md font-mono text-[10px]">
                      prompt=select_account
                    </code>
                    . Esto fuerza a Google a mostrar el selector de cuentas (&quot;Elige una cuenta / Usar otra cuenta&quot;)
                    para que puedas iniciar sesión con tu segunda o tercera cuenta sin que Google tome automáticamente la primera.
                  </p>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-3">
                <a
                  href="/api/auth/google"
                  className="bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg px-4 py-2 transition-colors shadow-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir nueva cuenta de Google</span>
                </a>

                <button
                  type="button"
                  onClick={onImportSystemAccount}
                  className="bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white text-xs font-medium rounded-lg px-3 py-2 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Importar cuenta activa del sistema</span>
                </button>
              </div>

              {/* Listado de cuentas */}
              <div className="flex flex-col gap-2.5">
                <h4 className="font-semibold text-slate-200 text-xs">Cuentas vinculadas actualmente:</h4>

                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-surface border border-surface-border flex items-center justify-center font-bold text-slate-300 font-mono text-xs">
                        {acc.email[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-200 text-xs">{acc.email}</span>
                          {acc.isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                              ACTIVA
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-sans">
                          {acc.displayName || 'Google Account'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/auth/verify?accountId=${acc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white text-xs font-medium rounded-md px-2.5 py-1.5 transition-colors flex items-center gap-1.5"
                        title="Abrir activación en Google en una pestaña nueva"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-accent" />
                        <span>Activar en Google ↗</span>
                      </a>

                      {!acc.isActive && (
                        <button
                          type="button"
                          onClick={() => onSetActiveAccount(acc.id)}
                          className="bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white text-xs font-medium rounded-md px-2.5 py-1.5 transition-colors"
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
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20"
                        title="Eliminar cuenta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Importación manual de Token / JSON (desanidado) */}
              <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border flex flex-col gap-2.5">
                <h5 className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-accent" />
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
                  className="bg-surface border border-surface-border focus:border-accent rounded-md px-3 py-2 text-xs text-slate-200 font-mono transition-colors w-full resize-none focus:outline-none"
                />
                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={handleManualTokenImport}
                    disabled={!manualTokenInput.trim() || isImportingToken}
                    className="bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white text-xs font-medium rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
                  >
                    {isImportingToken ? 'Importando...' : 'Importar Token'}
                  </button>
                </div>
              </div>

              {/* Configuración de Google Client ID y Client Secret */}
              <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Credenciales Google Cloud OAuth (Client ID & Client Secret)</span>
                  </h5>
                  {credsSavedNotice && (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium animate-in fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>¡Guardado correctamente!</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Si no deseas editar manualmente el archivo{' '}
                  <code className="text-slate-300 bg-surface border border-surface-border px-1 py-0.5 rounded-md font-mono text-[10px]">
                    .env
                  </code>{' '}
                  o colocar un archivo{' '}
                  <code className="text-slate-300 bg-surface border border-surface-border px-1 py-0.5 rounded-md font-mono text-[10px]">
                    client_secret_*.json
                  </code>{' '}
                  en la raíz, puedes guardar tus claves aquí. Para aplicaciones de escritorio (Desktop App) con PKCE, el Client Secret no es necesario.
                </p>

                <div className="flex flex-col gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-sans">
                      Google Client ID:
                    </label>
                    <input
                      type="text"
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                      placeholder="ej: xxxxx-xxxxx.apps.googleusercontent.com"
                      className="bg-surface border border-surface-border focus:border-accent rounded-md px-3 py-2 text-xs text-slate-200 font-mono transition-colors w-full focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-sans">
                      Google Client Secret (Opcional para Desktop App / PKCE):
                    </label>
                    <input
                      type="password"
                      value={googleClientSecret}
                      onChange={(e) => setGoogleClientSecret(e.target.value)}
                      placeholder="ej: GOCSPX-xxxxxxxxxxxxxxxx"
                      className="bg-surface border border-surface-border focus:border-accent rounded-md px-3 py-2 text-xs text-slate-200 font-mono transition-colors w-full focus:outline-none"
                    />
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      disabled={isSavingCreds}
                      onClick={async () => {
                        setIsSavingCreds(true);
                        try {
                          await onUpdateSettings({
                            googleClientId: googleClientId.trim(),
                            googleClientSecret: googleClientSecret.trim(),
                          });
                          setCredsSavedNotice(true);
                          setTimeout(() => setCredsSavedNotice(false), 3500);
                        } finally {
                          setIsSavingCreds(false);
                        }
                      }}
                      className="bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg px-4 py-2 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isSavingCreds ? 'Guardando...' : 'Guardar Credenciales OAuth'}
                    </button>

                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-accent hover:text-accent-hover transition-colors flex items-center gap-1 hover:underline"
                    >
                      <span>Consola de Google Cloud</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Pestaña Permisos y Agente */}
          {activeTab === 'permisos' && (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-200 mb-1 text-xs">
                    Permisos y Configuración del Agente
                  </h4>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Configura el modelo por defecto, nivel de razonamiento, instrucciones de sistema y los permisos
                    de ejecución con herramientas en el workspace.
                  </p>
                </div>
              </div>

              {/* Modelo por defecto y Nivel de Razonamiento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border flex flex-col gap-1.5">
                  <label className="text-slate-200 font-semibold text-xs">
                    Modelo por defecto de Antigravity:
                  </label>
                  <select
                    value={defaultModelId}
                    onChange={(e) => setDefaultModelId(e.target.value)}
                    className="bg-surface border border-surface-border focus:border-accent rounded-md px-3 py-2 text-xs text-slate-200 font-mono transition-colors w-full focus:outline-none cursor-pointer"
                  >
                    {ANTIGRAVITY_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({Math.round(m.contextLimit / 1000)}k ctx)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border flex flex-col gap-1.5">
                  <label className="text-slate-200 font-semibold text-xs">
                    Nivel de Razonamiento (Thinking Effort):
                  </label>
                  <select
                    value={reasoningEffort}
                    onChange={(e) => setReasoningEffort(e.target.value as 'low' | 'medium' | 'high')}
                    className="bg-surface border border-surface-border focus:border-accent rounded-md px-3 py-2 text-xs text-slate-200 font-mono transition-colors w-full focus:outline-none cursor-pointer"
                  >
                    <option value="low">Bajo (Low) - Respuestas rápidas</option>
                    <option value="medium">Medio (Medium) - Razonamiento balanceado</option>
                    <option value="high">Alto (High) - Pensamiento exhaustivo</option>
                  </select>
                </div>
              </div>

              {/* Instrucciones de Sistema (System Prompt) con Advertencia de Modelos */}
              <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-200 font-semibold text-xs flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-accent" />
                    <span>Instrucciones de Sistema (System Prompt):</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Directiva global de comportamiento</span>
                </div>

                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={3}
                  placeholder="Define directivas de comportamiento y directrices técnicas personalizadas para el agente..."
                  className="bg-surface border border-surface-border focus:border-accent rounded-md px-3 py-2 text-xs text-slate-200 font-mono transition-colors w-full resize-y leading-relaxed focus:outline-none"
                />

                {/* Advertencia de Compatibilidad de Modelos */}
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1 text-[11px] leading-relaxed font-sans">
                    <span className="font-semibold text-amber-300">
                      Modelos que NO tomarán en cuenta este System Prompt:
                    </span>
                    <p className="text-amber-200/90">
                      Los modelos de terceros (3P) como <strong className="text-amber-100">Claude Sonnet 4.6</strong>,{' '}
                      <strong className="text-amber-100">Claude Opus 4.6 (Thinking)</strong> y{' '}
                      <strong className="text-amber-100">GPT-OSS 120B</strong> ignoran el System Prompt personalizado debido a las restricciones de aislamiento del harness de Antigravity.
                    </p>
                    <p className="text-emerald-400 font-medium">
                      ✓ Los modelos nativos de <strong className="text-emerald-300">Google Gemini (Gemini 3.8 Flash, Gemini 3.7 Flash, Gemini 3.1 Pro)</strong> sí toman en cuenta e incorporan estas directivas en cada interacción.
                    </p>
                  </div>
                </div>
              </div>

              {/* Permisos y Capacidades Seleccionables del Agente */}
              <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border flex flex-col gap-2.5">
                <div>
                  <h5 className="font-semibold text-slate-200 text-xs mb-1">
                    Permisos y Capacidades del Agente
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    Selecciona individualmente las acciones y herramientas que el agente tiene autorización para ejecutar:
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-md bg-surface border border-surface-border hover:border-surface-border-hover cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={toolPerms.terminalCommands}
                      onChange={(e) => setToolPerms({ ...toolPerms, terminalCommands: e.target.checked })}
                      className="w-4 h-4 mt-0.5 accent-accent rounded-md cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-medium text-slate-200 block text-xs">Ejecución en Terminal (Shell)</span>
                      <span className="text-[10px] text-slate-400 leading-tight">Comandos bash, tests, npm, git y compilaciones del sistema.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-md bg-surface border border-surface-border hover:border-surface-border-hover cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={toolPerms.fileEdits}
                      onChange={(e) => setToolPerms({ ...toolPerms, fileEdits: e.target.checked })}
                      className="w-4 h-4 mt-0.5 accent-accent rounded-md cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-medium text-slate-200 block text-xs">Escritura y Edición de Archivos</span>
                      <span className="text-[10px] text-slate-400 leading-tight">Crear nuevos ficheros, refactorizar código y aplicar cambios.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-md bg-surface border border-surface-border hover:border-surface-border-hover cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={toolPerms.fileReads}
                      onChange={(e) => setToolPerms({ ...toolPerms, fileReads: e.target.checked })}
                      className="w-4 h-4 mt-0.5 accent-accent rounded-md cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-medium text-slate-200 block text-xs">Lectura del Workspace</span>
                      <span className="text-[10px] text-slate-400 leading-tight">Examinar carpetas, búsquedas grep y lectura de archivos.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-md bg-surface border border-surface-border hover:border-surface-border-hover cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={toolPerms.webAccess}
                      onChange={(e) => setToolPerms({ ...toolPerms, webAccess: e.target.checked })}
                      className="w-4 h-4 mt-0.5 accent-accent rounded-md cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-medium text-slate-200 block text-xs">Búsqueda y Navegación Web</span>
                      <span className="text-[10px] text-slate-400 leading-tight">Consultas de información técnica y descarga de URLs externas.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-md bg-surface border border-surface-border hover:border-surface-border-hover cursor-pointer transition-colors md:col-span-2">
                    <input
                      type="checkbox"
                      checked={toolPerms.subagents}
                      onChange={(e) => setToolPerms({ ...toolPerms, subagents: e.target.checked })}
                      className="w-4 h-4 mt-0.5 accent-accent rounded-md cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-medium text-slate-200 block text-xs">Invocación de Subagentes</span>
                      <span className="text-[10px] text-slate-400 leading-tight">Delegar tareas en subagentes en paralelo y coordinar ejecución.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 1. Dangerously Skip Permissions */}
              <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-between gap-4">
                <div className="max-w-[80%]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-200 text-xs">Auto-aprobar permisos de herramientas</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/10 text-accent font-mono border border-accent/20">
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
                  className="w-4 h-4 accent-accent rounded-md cursor-pointer shrink-0"
                />
              </div>

              {/* 2. Modo de Ejecución */}
              <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200 text-xs">Modo de Ejecución del Agente</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-hover text-slate-300 font-mono border border-surface-border">
                    --mode
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Define el comportamiento predeterminado del modelo al abordar tareas de desarrollo:
                </p>
                <select
                  value={agentMode}
                  onChange={(e) => setAgentMode(e.target.value as 'default' | 'accept-edits' | 'plan')}
                  className="bg-surface border border-surface-border focus:border-accent rounded-md px-3 py-2 text-xs text-slate-200 font-mono transition-colors w-full focus:outline-none cursor-pointer"
                >
                  <option value="default">Por defecto (Ejecución estándar interactiva)</option>
                  <option value="accept-edits">Aceptar ediciones (accept-edits: aplica cambios de código directamente)</option>
                  <option value="plan">Modo Planificación (plan: solo elabora planes sin modificar código)</option>
                </select>
              </div>

              {/* 3. Sandbox */}
              <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-between gap-4">
                <div className="max-w-[80%]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-200 text-xs">Ejecución en Sandbox de Terminal</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-hover text-slate-300 font-mono border border-surface-border">
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
                  className="w-4 h-4 accent-accent rounded-md cursor-pointer shrink-0"
                />
              </div>

              {/* 4. Ruta por defecto para proyectos */}
              <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border flex flex-col gap-1.5">
                <span className="font-semibold text-slate-200 text-xs">Ruta de Proyecto por Defecto (Workspace)</span>
                <p className="text-[11px] text-slate-400">
                  Directorio local que se usará como base para nuevas conversaciones si no se especifica uno concreto:
                </p>
                <input
                  type="text"
                  value={defaultProjectPath}
                  onChange={(e) => setDefaultProjectPath(e.target.value)}
                  placeholder="/home/usuario/mi-proyecto"
                  className="bg-surface border border-surface-border focus:border-accent rounded-md px-3 py-2 text-xs text-slate-200 font-mono transition-colors w-full focus:outline-none"
                />
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSaveGeneral}
                  className="bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg px-4 py-2 transition-colors shadow-sm"
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
