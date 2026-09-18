'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Message, ContextWindowUsage } from '@/shared/types/chat';
import type { AccountWithQuota } from '@/shared/types/account';
import { ContextRing } from './context-ring';
import { ModelSelector } from './model-selector';
import { AccountSelector } from '@/cuentas/components/account-selector';
import { WorkspaceSelector } from './workspace-selector';
import { calculateContextUsage } from '../context-calc';
import { ANTIGRAVITY_MODELS } from '@/shared/types/model';
import {
  Send,
  Sparkles,
  Bot,
  User,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  CornerDownLeft,
  Clock,
  Zap,
  CheckCircle2,
} from 'lucide-react';

interface ChatCanvasProps {
  messages: Message[];
  activeModelId: string;
  onSelectModel: (modelId: string) => void;
  accounts: AccountWithQuota[];
  activeAccountId: string;
  onSelectAccount: (accountId: string) => void;
  onSendMessage: (text: string) => Promise<void>;
  isStreaming: boolean;
  streamingDelta: string;
  rotationNotice: { fromEmail: string; toEmail: string; reason: string } | null;
  onOpenSettings: (tab: 'cuentas' | 'rotacion') => void;
  projectPath?: string;
  onUpdateProjectPath?: (path: string) => Promise<void>;
  onRotateNext?: () => void;
  verificationAlert?: { error: string; url?: string } | null;
  onDismissVerificationAlert?: () => void;
}

export function ChatCanvas({
  messages,
  activeModelId,
  onSelectModel,
  accounts,
  activeAccountId,
  onSelectAccount,
  onSendMessage,
  isStreaming,
  streamingDelta,
  rotationNotice,
  onOpenSettings,
  projectPath = '',
  onUpdateProjectPath,
  onRotateNext,
  verificationAlert,
  onDismissVerificationAlert,
}: ChatCanvasProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeModel =
    ANTIGRAVITY_MODELS.find((m) => m.id === activeModelId) || ANTIGRAVITY_MODELS[0];

  // Cálculo en tiempo real de la ventana de contexto para el aro
  const contextUsage: ContextWindowUsage = calculateContextUsage(
    messages,
    inputText,
    activeModelId
  );

  // Auto-scroll al final
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingDelta]);

  // Ajuste automático de altura del textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!inputText.trim() || isStreaming) return;
    const text = inputText;
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await onSendMessage(text);
  };

  return (
    <main className="flex-1 h-full flex flex-col bg-background relative overflow-hidden">
      {/* Alerta de Elegibilidad / Verificación de Cuenta Google */}
      {verificationAlert && (
        <div className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-950/70 border border-amber-500/50 text-xs text-amber-200 shadow-2xl flex items-center justify-between animate-in slide-in-from-top duration-300 backdrop-blur-md">
          <div className="flex items-start gap-3 flex-1 min-w-0 mr-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white mb-0.5">Activación requerida en Google Antigravity</div>
              <div className="text-[11px] text-amber-300 leading-relaxed break-words">
                {verificationAlert.error}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {verificationAlert.url && (
              <a
                href={verificationAlert.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md transition-all"
              >
                <span>Completar verificación en Google</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {onDismissVerificationAlert && (
              <button
                type="button"
                onClick={onDismissVerificationAlert}
                className="px-2 py-1.5 rounded-lg hover:bg-amber-900/40 text-amber-300 text-xs transition-all"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Aviso de Rotación Automática Flotante */}
      {rotationNotice && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-blue-950/60 border border-blue-500/40 text-xs text-blue-200 shadow-xl flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-blue-400 shrink-0 animate-pulse" />
            <div>
              <span className="font-semibold text-white">Rotación automática de cuenta:</span> Se
              conmutó de <span className="font-mono text-red-300">{rotationNotice.fromEmail}</span> a{' '}
              <span className="font-mono text-emerald-300">{rotationNotice.toEmail}</span> ({rotationNotice.reason}).
            </div>
          </div>
        </div>
      )}

      {/* Área de Mensajes */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6 max-w-4xl w-full mx-auto">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-blue-500/20 text-white font-bold text-2xl mb-4">
              μ
            </div>
            <h3 className="text-xl font-bold text-white mb-2">muac · Antigravity Pro</h3>
            <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
              Chat con inteligencia artificial y rotación automática de cuentas al agotar límites de
              5 horas o semanales.
            </p>

            <div className="grid grid-cols-2 gap-3 max-w-lg w-full text-left">
              <button
                type="button"
                onClick={() => setInputText('Explícame cómo funciona la rotación automática de cuentas en muac')}
                className="p-3 rounded-xl bg-surface-elevated/60 hover:bg-surface-elevated border border-surface-border text-xs text-slate-300 hover:text-white transition-all text-left"
              >
                <div className="font-semibold text-blue-400 mb-1">Rotación automática</div>
                <div className="text-[11px] text-slate-400">¿Cómo conmuta entre cuentas de 5h?</div>
              </button>

              <button
                type="button"
                onClick={() => setInputText('Escribe un script en TypeScript para monitorear límites de API')}
                className="p-3 rounded-xl bg-surface-elevated/60 hover:bg-surface-elevated border border-surface-border text-xs text-slate-300 hover:text-white transition-all text-left"
              >
                <div className="font-semibold text-emerald-400 mb-1">Código técnico</div>
                <div className="text-[11px] text-slate-400">Script de TypeScript para monitoreo</div>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 text-xs leading-relaxed ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-md ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-surface-elevated border border-surface-border text-slate-200 rounded-tl-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans text-xs break-words">
                    {msg.content}
                  </div>

                  {/* Metadatos del mensaje */}
                  {!isUser && msg.usage && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                      {msg.durationSeconds !== undefined && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{msg.durationSeconds.toFixed(1)}s</span>
                        </span>
                      )}
                      {msg.usage.totalTokens > 0 && (
                        <span>
                          {msg.usage.totalTokens.toLocaleString()} tokens (
                          {msg.usage.inputTokens.toLocaleString()} in /{' '}
                          {msg.usage.outputTokens.toLocaleString()} out)
                        </span>
                      )}
                      {msg.accountEmail && (
                        <span className="text-slate-500 truncate max-w-[140px]">
                          {msg.accountEmail}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Mensaje en Streaming */}
        {isStreaming && streamingDelta && (
          <div className="flex gap-3.5 text-xs leading-relaxed justify-start">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>

            <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3 bg-surface-elevated border border-surface-border text-slate-200 shadow-md">
              <div className="whitespace-pre-wrap font-sans text-xs break-words">
                {streamingDelta}
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-blue-400 animate-pulse align-middle" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Barra Inferior de Entrada (Input Bar) */}
      <div className="p-4 border-t border-surface-border bg-surface/50 backdrop-blur-md">
        <div className="max-w-4xl w-full mx-auto flex flex-col gap-2">
          {/* Controles Superiores: Desplegables de Modelos, Cuentas, Workspace y Aro de Contexto */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ModelSelector selectedModelId={activeModelId} onSelectModel={onSelectModel} />
              <AccountSelector
                accounts={accounts}
                activeAccountId={activeAccountId}
                onSelectAccount={onSelectAccount}
                onOpenSettings={onOpenSettings}
                onRotateNext={onRotateNext}
              />
              {onUpdateProjectPath && (
                <WorkspaceSelector
                  projectPath={projectPath}
                  onUpdateProjectPath={onUpdateProjectPath}
                />
              )}
            </div>

            {/* Aro de Ventana de Contexto (Objetivo #1) */}
            <div className="flex items-center gap-2">
              <ContextRing usage={contextUsage} modelName={activeModel.name} />
            </div>
          </div>

          {/* Caja de Redacción */}
          <div className="relative flex items-end gap-2 p-2 rounded-2xl bg-surface border border-surface-border focus-within:border-blue-500/70 focus-within:ring-1 focus-within:ring-blue-500/40 transition-all shadow-inner">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder="Envía un mensaje a Antigravity Pro... (Enter para enviar, Shift+Enter para salto de línea)"
              className="flex-1 bg-transparent text-slate-200 text-xs px-2 py-1.5 focus:outline-none resize-none max-h-44 placeholder:text-slate-500 leading-relaxed font-sans"
            />

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!inputText.trim() || isStreaming}
              className={`p-2 rounded-xl text-white font-semibold transition-all shrink-0 ${
                inputText.trim() && !isStreaming
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
              }`}
              title="Enviar mensaje"
            >
              {isStreaming ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
