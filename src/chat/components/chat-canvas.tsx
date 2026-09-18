'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Message, ContextWindowUsage } from '@/shared/types/chat';
import type { AccountWithQuota } from '@/shared/types/account';
import { ContextRing } from './context-ring';
import { ModelSelector } from './model-selector';
import { AccountSelector } from '@/cuentas/components/account-selector';
import { calculateContextUsage } from '../context-calc';
import { ANTIGRAVITY_MODELS } from '@/shared/types/model';
import {
  Send,
  Sparkles,
  Bot,
  User,
  AlertCircle,
  ArrowRight,
  CornerDownLeft,
  Clock,
  Zap,
  FolderOpen,
  CheckCircle2,
  Edit3,
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
}: ChatCanvasProps) {
  const [inputText, setInputText] = useState('');
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [tempPath, setTempPath] = useState(projectPath);
  const [pathValidation, setPathValidation] = useState<{
    valid: boolean;
    fileCount?: number;
    hasGit?: boolean;
    name?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    setTempPath(projectPath);
    if (projectPath) {
      validatePath(projectPath);
    }
  }, [projectPath]);

  const validatePath = async (p: string) => {
    if (!p.trim()) {
      setPathValidation(null);
      return;
    }
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: p.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setPathValidation({
          valid: true,
          fileCount: data.fileCount,
          hasGit: data.hasGit,
          name: data.name,
        });
      } else {
        setPathValidation({ valid: false, error: data.error });
      }
    } catch {
      setPathValidation({ valid: false, error: 'Error de validación' });
    }
  };

  const handleSavePath = async () => {
    if (onUpdateProjectPath) {
      await onUpdateProjectPath(tempPath.trim());
    }
    setIsEditingPath(false);
    if (tempPath.trim()) {
      validatePath(tempPath.trim());
    }
  };
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
      {/* Barra de Proyecto / Workspace del Agente */}
      <div className="px-6 py-2 border-b border-surface-border bg-surface/30 backdrop-blur-sm flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
          {isEditingPath ? (
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <input
                type="text"
                value={tempPath}
                onChange={(e) => setTempPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSavePath();
                  if (e.key === 'Escape') setIsEditingPath(false);
                }}
                placeholder="Ruta absoluta del proyecto (ej: /home/usuario/proyecto)..."
                className="flex-1 px-2.5 py-1 rounded-lg bg-surface-elevated border border-blue-500/50 text-slate-200 text-xs font-mono focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSavePath}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-all shrink-0"
              >
                Fijar ruta
              </button>
              <button
                type="button"
                onClick={() => setIsEditingPath(false)}
                className="px-2 py-1 rounded-lg hover:bg-slate-800 text-slate-400 text-xs transition-all shrink-0"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-slate-400 font-medium shrink-0">Workspace Agente:</span>
              <button
                type="button"
                onClick={() => setIsEditingPath(true)}
                className="font-mono text-slate-300 hover:text-white truncate hover:underline flex items-center gap-1.5"
                title="Hacer clic para cambiar la ruta de trabajo local"
              >
                <span>{projectPath || 'Sin ruta fijada (haz clic para asignar directorio)...'}</span>
                <Edit3 className="w-3 h-3 text-slate-500 hover:text-slate-300 shrink-0" />
              </button>

              {pathValidation?.valid && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded font-mono shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{pathValidation.name} ({pathValidation.fileCount} archivos)</span>
                </span>
              )}

              {pathValidation?.valid === false && (
                <span className="text-[10px] text-red-400 bg-red-950/40 border border-red-800/40 px-1.5 py-0.5 rounded font-mono shrink-0">
                  {pathValidation.error || 'Ruta no encontrada'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

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
          {/* Controles Superiores: Desplegables de Modelos, Cuentas y Aro de Contexto */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <ModelSelector selectedModelId={activeModelId} onSelectModel={onSelectModel} />
              <AccountSelector
                accounts={accounts}
                activeAccountId={activeAccountId}
                onSelectAccount={onSelectAccount}
                onOpenSettings={onOpenSettings}
                onRotateNext={onRotateNext}
              />
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
