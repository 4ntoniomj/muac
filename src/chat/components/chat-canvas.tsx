'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Message, ContextWindowUsage, Attachment } from '@/shared/types/chat';
import type { AccountWithQuota } from '@/shared/types/account';
import { ContextRing } from './context-ring';
import { ModelSelector } from './model-selector';
import { ReasoningSlider } from './reasoning-slider';
import { AgentActivityBanner } from './agent-activity-banner';
import { AccountSelector } from '@/cuentas/components/account-selector';
import { WorkspaceSelector } from './workspace-selector';
import { calculateContextUsage } from '../context-calc';
import { findModel } from '@/shared/types/model';
import { formatFileSize } from '@/shared/time-utils';
import type { AgentActivity } from '@/chat/agy-bridge';
import {
  Send,
  Sparkles,
  Bot,
  User,
  AlertCircle,
  ExternalLink,
  Clock,
  Zap,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Film,
  Download,
  X,
  FileCode,
  Square,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';

interface ChatCanvasProps {
  messages: Message[];
  activeModelId: string;
  onSelectModel: (modelId: string) => void;
  activeReasoningEffort: 'low' | 'medium' | 'high';
  onSelectReasoningEffort: (effort: 'low' | 'medium' | 'high') => void;
  activities: AgentActivity[];
  accounts: AccountWithQuota[];
  activeAccountId: string;
  onSelectAccount: (accountId: string) => void;
  onSendMessage: (text: string, attachments?: Attachment[]) => Promise<void>;
  onStopStreaming?: () => void;
  isStreaming: boolean;
  streamingDelta: string;
  rotationNotice: { fromEmail: string; toEmail: string; reason: string } | null;
  onOpenSettings: (tab: 'cuentas' | 'rotacion') => void;
  projectPath?: string;
  onUpdateProjectPath?: (path: string) => Promise<void>;
  onRotateNext?: () => void;
  verificationAlert?: { error: string; url?: string } | null;
  onDismissVerificationAlert?: () => void;
  onRefreshQuotas?: () => Promise<void> | void;
  activeConversationTitle?: string;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function ChatCanvas({
  messages,
  activeModelId,
  onSelectModel,
  activeReasoningEffort,
  onSelectReasoningEffort,
  activities,
  accounts,
  activeAccountId,
  onSelectAccount,
  onSendMessage,
  onStopStreaming,
  isStreaming,
  streamingDelta,
  rotationNotice,
  onOpenSettings,
  projectPath = '',
  onUpdateProjectPath,
  onRotateNext,
  verificationAlert,
  onDismissVerificationAlert,
  onRefreshQuotas,
  activeConversationTitle,
  isSidebarOpen = true,
  onToggleSidebar,
}: ChatCanvasProps) {
  const [inputText, setInputText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeModel = findModel(activeModelId);

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

  // Subir archivos al servidor
  const uploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        if (data.attachments && data.attachments.length > 0) {
          setPendingAttachments((prev) => [...prev, ...data.attachments]);
        } else if (data.attachment) {
          setPendingAttachments((prev) => [...prev, data.attachment]);
        }
      } else {
        alert(data.error || 'Fallo al subir archivos');
      }
    } catch (err) {
      console.error('Error al subir archivos:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Convertir texto de más de 35 líneas automáticamente a archivo
  const convertLongTextToAttachment = async (longText: string, customName?: string): Promise<boolean> => {
    const lines = longText.split('\n');
    if (lines.length <= 35) return false;

    setIsUploading(true);
    try {
      const fileName = customName || 'texto_adjunto.txt';
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: longText, filename: fileName }),
      });
      const data = await res.json();
      if (data.success && data.attachment) {
        setPendingAttachments((prev) => [...prev, data.attachment]);
        return true;
      }
    } catch (err) {
      console.error('Error al convertir texto largo a archivo:', err);
    } finally {
      setIsUploading(false);
    }
    return false;
  };

  // Detección en cambio de texto
  const handleTextChange = async (val: string) => {
    setInputText(val);
    const lines = val.split('\n');
    if (lines.length > 35) {
      const converted = await convertLongTextToAttachment(val, 'documento_texto.txt');
      if (converted) {
        setInputText('');
      }
    }
  };

  // Manejo de pegado en el textarea (detecta archivos, capturas de pantalla y texto de > 35 líneas)
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      await uploadFiles(e.clipboardData.files);
      return;
    }

    const pastedText = e.clipboardData.getData('text');
    if (pastedText && pastedText.split('\n').length > 35) {
      e.preventDefault();
      const converted = await convertLongTextToAttachment(pastedText, 'texto_pegado.txt');
      if (converted && !inputText.trim()) {
        setInputText('Analiza el archivo adjunto.');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async () => {
    if ((!inputText.trim() && pendingAttachments.length === 0) || isStreaming || isUploading) return;

    let textToSend = inputText.trim();
    const attachmentsToSend = [...pendingAttachments];

    // Si el texto final tiene más de 35 líneas, convertirlo a archivo automáticamente antes de enviar
    if (textToSend.split('\n').length > 35) {
      setIsUploading(true);
      try {
        const res = await fetch('/api/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToSend, filename: 'texto_extenso.txt' }),
        });
        const data = await res.json();
        if (data.success && data.attachment) {
          attachmentsToSend.push(data.attachment);
          textToSend = 'Procesa el documento de texto adjunto.';
        }
      } catch (err) {
        console.error('Error al subir texto de más de 35 líneas:', err);
      } finally {
        setIsUploading(false);
      }
    }

    setInputText('');
    setPendingAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await onSendMessage(textToSend, attachmentsToSend.length > 0 ? attachmentsToSend : undefined);
  };

  // Descargar texto o código generado como archivo
  const handleDownloadTextAsFile = (content: string, defaultName: string = 'codigo.txt') => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main
      className="flex-1 h-full flex flex-col bg-background relative overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          await uploadFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Barra Superior del Chat con Título y Botón para Mostrar/Ocultar Historial */}
      <header className="h-12 border-b border-surface-border/70 px-4 flex items-center justify-between bg-surface/40 backdrop-blur-md shrink-0 select-none z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-surface-elevated transition-all border border-transparent hover:border-surface-border"
              title={isSidebarOpen ? 'Ocultar historial de conversaciones' : 'Mostrar historial de conversaciones'}
            >
              {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4 text-blue-400" />}
            </button>
          )}

          <div className="flex items-center gap-2 truncate">
            <h2 className="text-xs font-semibold text-slate-200 truncate">
              {activeConversationTitle || 'Nueva conversación'}
            </h2>
            {projectPath && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-md bg-surface-elevated border border-surface-border text-amber-300 font-mono truncate max-w-[220px]"
                title={projectPath}
              >
                📁 {projectPath.split('/').filter(Boolean).pop() || projectPath}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-elevated/70 border border-surface-border">
            {messages.length} {messages.length === 1 ? 'mensaje' : 'mensajes'}
          </span>
        </div>
      </header>
      {/* Indicador visual de Drag and Drop */}
      {isDragging && (
        <div className="absolute inset-0 z-40 bg-blue-950/70 border-2 border-dashed border-blue-400 backdrop-blur-sm flex flex-col items-center justify-center text-blue-200">
          <Paperclip className="w-12 h-12 mb-2 text-blue-400 animate-bounce" />
          <p className="text-sm font-semibold">Suelta tus fotos, videos o archivos aquí</p>
          <p className="text-xs text-blue-300">Se adjuntarán automáticamente a la conversación</p>
        </div>
      )}

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
                <ExternalLink className="w-3 h-3" />
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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-blue-500/20 text-white mb-4">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">muac · Antigravity Pro</h3>
            <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
              Chat con inteligencia artificial, rotación automática de cuentas y soporte de archivos, fotos y videos.
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
            const linesCount = msg.content ? msg.content.split('\n').length : 0;
            const isLongResponse = linesCount > 35;

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
                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-md flex flex-col gap-2.5 ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-surface-elevated border border-surface-border text-slate-200 rounded-tl-sm'
                  }`}
                >
                  {/* Adjuntos del Mensaje (Fotos, Videos, Archivos) */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-col gap-2 pt-0.5">
                      {msg.attachments.map((att) => (
                        <div key={att.id} className="rounded-xl overflow-hidden">
                          {att.type === 'image' ? (
                            <img
                              src={att.url}
                              alt={att.name}
                              className="max-h-72 max-w-full rounded-xl object-contain bg-black/40 border border-white/10 cursor-pointer hover:opacity-95 transition-opacity"
                              onClick={() => window.open(att.url, '_blank')}
                            />
                          ) : att.type === 'video' ? (
                            <video
                              src={att.url}
                              controls
                              className="max-h-72 max-w-full rounded-xl bg-black border border-white/10"
                            />
                          ) : (
                            <a
                              href={att.url}
                              download={att.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                                isUser
                                  ? 'bg-blue-700/60 border-blue-500/40 hover:bg-blue-700 text-white'
                                  : 'bg-surface border-surface-border hover:border-blue-500/50 hover:bg-surface-elevated text-slate-200'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300 shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold truncate">{att.name}</div>
                                <div className="text-[10px] opacity-75">
                                  {att.lineCount ? `${att.lineCount} líneas • ` : ''}
                                  {formatFileSize(att.size)}
                                </div>
                              </div>
                              <Download className="w-3.5 h-3.5 shrink-0 opacity-80 hover:opacity-100" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Contenido de Texto */}
                  {msg.content && (
                    <div className="whitespace-pre-wrap font-sans text-xs break-words leading-relaxed">
                      {renderMessageContentWithMedia(msg.content)}
                    </div>
                  )}

                  {/* Si el mensaje del asistente es muy extenso (> 35 líneas), botón para descargarlo como archivo */}
                  {!isUser && isLongResponse && (
                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => handleDownloadTextAsFile(msg.content, `respuesta_${msg.id.slice(-6)}.txt`)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-surface-border hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] transition-all"
                        title="Descargar esta respuesta como archivo de texto"
                      >
                        <FileCode className="w-3 h-3 text-blue-400" />
                        <span>Descargar como archivo ({linesCount} líneas)</span>
                      </button>
                    </div>
                  )}

                  {/* Metadatos del mensaje */}
                  {!isUser && msg.usage && (
                    <div className="mt-1 pt-2 border-t border-slate-800/80 flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                      {msg.durationSeconds !== undefined && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{msg.durationSeconds.toFixed(1)}s</span>
                        </span>
                      )}
                      {msg.usage.totalTokens > 0 && (
                        <span>
                          {msg.usage.totalTokens.toLocaleString()} tokens (
                          {msg.usage.inputTokens.toLocaleString()} entrada /{' '}
                          {msg.usage.outputTokens.toLocaleString()} salida)
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

        {/* Mensaje en Streaming y Observabilidad */}
        {isStreaming && (
          <div className="flex flex-col gap-2">
            <AgentActivityBanner activities={activities} isStreaming={isStreaming} />

            {streamingDelta && (
              <div className="flex gap-3.5 text-xs leading-relaxed justify-start">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5 animate-pulse">
                  <Bot className="w-4 h-4" />
                </div>

                <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 bg-surface-elevated border border-surface-border text-slate-200 shadow-md">
                  <div className="whitespace-pre-wrap font-sans text-xs break-words">
                    {streamingDelta}
                    <span className="inline-block w-1.5 h-3.5 ml-1 bg-blue-400 animate-pulse align-middle" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Barra Inferior de Entrada (Input Bar) */}
      <div className="p-4 border-t border-surface-border bg-surface/50 backdrop-blur-md">
        <div className="max-w-4xl w-full mx-auto flex flex-col gap-2">
          {/* Controles Superiores: Desplegables de Modelos, Esfuerzo, Cuentas, Workspace y Aro de Contexto */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ModelSelector selectedModelId={activeModelId} onSelectModel={onSelectModel} />
              <ReasoningSlider
                modelId={activeModelId}
                effort={activeReasoningEffort}
                onChangeEffort={onSelectReasoningEffort}
              />
              <AccountSelector
                accounts={accounts}
                activeAccountId={activeAccountId}
                onSelectAccount={onSelectAccount}
                onOpenSettings={onOpenSettings}
                onRotateNext={onRotateNext}
                activeModelId={activeModelId}
                onRefreshQuotas={onRefreshQuotas}
              />
              {onUpdateProjectPath && (
                <WorkspaceSelector
                  projectPath={projectPath}
                  onUpdateProjectPath={onUpdateProjectPath}
                />
              )}
            </div>

            {/* Aro de Ventana de Contexto (Posición Original) */}
            <div className="flex items-center gap-2 shrink-0">
              <ContextRing usage={contextUsage} modelName={activeModel.name} />
            </div>
          </div>

          {/* Selector oculto de archivos nativo */}
          <input
            type="file"
            ref={fileInputRef}
            multiple
            onChange={(e) => {
              if (e.target.files) uploadFiles(e.target.files);
            }}
            className="hidden"
            accept="image/*,video/*,.pdf,.txt,.md,.json,.ts,.js,.py,.zip,*"
          />

          {/* Contenedor de Redacción con Chips de Adjuntos */}
          <div className="flex flex-col p-2 rounded-2xl bg-surface border border-surface-border focus-within:border-blue-500/70 focus-within:ring-1 focus-within:ring-blue-500/40 transition-all shadow-inner gap-2">
            {/* Chips de Adjuntos Pendientes */}
            {pendingAttachments.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap px-1 pt-1 border-b border-surface-border/50 pb-2">
                {pendingAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-surface-elevated border border-surface-border text-xs text-slate-200 shadow-sm animate-in fade-in"
                  >
                    {att.type === 'image' ? (
                      <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : att.type === 'video' ? (
                      <Film className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}

                    <span className="truncate max-w-[160px] font-medium text-[11px]">{att.name}</span>
                    {att.lineCount ? (
                      <span className="text-[10px] text-slate-400 font-mono">({att.lineCount} lín)</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">({formatFileSize(att.size)})</span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="text-slate-400 hover:text-white ml-0.5"
                      title="Quitar archivo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative flex items-end gap-2">
              {/* Botón de Adjuntar Fotos, Videos o Archivos */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming || isUploading}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors shrink-0"
                title="Adjuntar fotos, videos o archivos (también puedes arrastrarlos o pegar capturas)"
              >
                <Paperclip className={`w-4 h-4 ${isUploading ? 'animate-spin text-blue-400' : ''}`} />
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => handleTextChange(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                placeholder="Envía un mensaje, foto, video o archivo... (textos de >35 líneas se pasan como archivo)"
                className="flex-1 bg-transparent text-slate-200 text-xs px-1 py-1.5 focus:outline-none resize-none max-h-44 placeholder:text-slate-500 leading-relaxed font-sans"
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStopStreaming}
                  className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-all shrink-0 shadow-md shadow-rose-600/30 flex items-center justify-center cursor-pointer animate-pulse"
                  title="Detener respuesta"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={(!inputText.trim() && pendingAttachments.length === 0) || isUploading}
                  className={`p-2 rounded-xl text-white font-semibold transition-all shrink-0 ${
                    (inputText.trim() || pendingAttachments.length > 0) && !isUploading
                      ? 'bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                  title="Enviar mensaje"
                >
                  {isUploading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );

  // Renderizar contenido que pueda contener imágenes o videos en markdown
  function renderMessageContentWithMedia(rawContent: string) {
    // Si contiene markdown de imagen ![alt](url)
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = imgRegex.exec(rawContent)) !== null) {
      if (match.index > lastIndex) {
        parts.push(rawContent.slice(lastIndex, match.index));
      }
      const alt = match[1];
      const src = match[2];
      parts.push(
        <div key={match.index} className="my-2">
          <img
            src={src}
            alt={alt}
            className="max-h-72 max-w-full rounded-xl object-contain bg-black/40 border border-white/10 cursor-pointer hover:opacity-95 transition-opacity shadow-md"
            onClick={() => window.open(src, '_blank')}
          />
        </div>
      );
      lastIndex = imgRegex.lastIndex;
    }

    if (lastIndex < rawContent.length) {
      parts.push(rawContent.slice(lastIndex));
    }

    return parts.length > 0 ? parts : rawContent;
  }
}
