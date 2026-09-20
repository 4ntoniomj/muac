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
  Plus,
  Mic,
  Eye,
  Copy,
  Check,
  Volume2,
  ArrowDown,
  FolderTree,
  Brain,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { FileExplorer } from './file-explorer';
import { MarkdownRenderer } from './markdown-renderer';

/**
 * Extrae bloques de pensamiento <thought>...</thought> o <think>...</think>
 * para representarlos en un acordeón técnico separado de la respuesta final.
 */
function extractThinking(rawContent: string): { thinking: string | null; cleanContent: string } {
  if (!rawContent) return { thinking: null, cleanContent: '' };
  const match = rawContent.match(/<(?:thought|think)>([\s\S]*?)<\/(?:thought|think)>/i);
  if (match) {
    const thinking = match[1].trim();
    const cleanContent = rawContent.replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/gi, '').trim();
    return { thinking, cleanContent };
  }
  return { thinking: null, cleanContent: rawContent };
}

/**
 * Acordeón colapsable con diseño de terminal técnica para el razonamiento del modelo.
 */
function ThinkingAccordion({
  thinkingText,
  thinkingTokens,
  defaultExpanded = false,
}: {
  thinkingText?: string | null;
  thinkingTokens?: number;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!thinkingText && !thinkingTokens) return null;

  return (
    <div className="bg-surface/50 border border-surface-border rounded-md font-mono text-[11px] text-slate-400 p-2.5 my-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left hover:text-slate-200 transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="font-semibold text-slate-300 font-sans text-xs">
            Razonamiento del modelo
          </span>
          {thinkingTokens && thinkingTokens > 0 ? (
            <span className="text-[10px] text-slate-500 font-mono">
              ({thinkingTokens.toLocaleString()} tokens)
            </span>
          ) : null}
        </div>
        <div className="p-0.5 text-slate-400 hover:text-white transition-colors">
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-surface-border/60 text-slate-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto select-text font-mono text-[10.5px]">
          {thinkingText || 'El modelo procesó razonamiento analítico interno durante esta generación.'}
        </div>
      )}
    </div>
  );
}

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
  const [isRecording, setIsRecording] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewFileContent, setPreviewFileContent] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [fileExplorerWidth, setFileExplorerWidth] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('muac_file_explorer_custom_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 260 && parsed <= 1400) {
          return parsed;
        }
      }
    }
    return null;
  });

  useEffect(() => {
    const saved = localStorage.getItem('muac_file_explorer_open');
    if (saved !== null) {
      setIsFileExplorerOpen(saved === 'true');
    } else if (projectPath) {
      setIsFileExplorerOpen(true);
    }
  }, [projectPath]);

  // Atajos ⌘1 - ⌘4 para el Empty State / Command Palette
  useEffect(() => {
    if (messages.length > 0) return;

    const handleKeyDownShortcuts = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          setInputText('Explícame cómo funciona la rotación automática de cuentas en muac');
          textareaRef.current?.focus();
        } else if (e.key === '2') {
          e.preventDefault();
          setInputText('Escribe un script en TypeScript para monitorear límites de API');
          textareaRef.current?.focus();
        } else if (e.key === '3') {
          e.preventDefault();
          setInputText('Inspecciona el espacio de trabajo y genera un resumen de arquitectura');
          textareaRef.current?.focus();
        } else if (e.key === '4') {
          e.preventDefault();
          setInputText('Crea un plan de refactorización según la metodología SDD');
          textareaRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDownShortcuts);
    return () => window.removeEventListener('keydown', handleKeyDownShortcuts);
  }, [messages.length]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const baseTextRef = useRef('');

  // Limpieza al desmontar para no dejar micrófonos abiertos
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
    };
  }, []);

  // Cargar contenido textual para la vista previa cuando se selecciona un archivo
  useEffect(() => {
    if (!previewAttachment) {
      setPreviewFileContent(null);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewAttachment(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const isTextual =
      previewAttachment.type === 'file' &&
      (previewAttachment.mimeType?.startsWith('text/') ||
        previewAttachment.mimeType?.includes('json') ||
        previewAttachment.mimeType?.includes('javascript') ||
        previewAttachment.mimeType?.includes('typescript') ||
        previewAttachment.name.match(/\.(txt|md|json|ts|js|py|html|css|yaml|yml|sh|env)$/i));

    if (isTextual) {
      setIsLoadingPreview(true);
      fetch(previewAttachment.url)
        .then((res) => res.text())
        .then((text) => setPreviewFileContent(text))
        .catch((err) => {
          console.error('Error cargando vista previa de archivo:', err);
          setPreviewFileContent('No se pudo cargar el contenido del archivo.');
        })
        .finally(() => setIsLoadingPreview(false));
    } else {
      setPreviewFileContent(null);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewAttachment]);

  // Manejo de grabación continua por micrófono (dictado sin límite con fallback universal)
  const handleToggleRecording = async () => {
    if (isRecording) {
      isRecordingRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    // 1. Si el navegador cuenta con la API SpeechRecognition (Chrome, Edge, Chromium)
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-ES';

        baseTextRef.current = inputText;
        isRecordingRef.current = true;
        setIsRecording(true);

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          const base = baseTextRef.current.trim();
          const separator = base ? ' ' : '';
          const newText = base + separator + transcript.trim();
          setInputText(newText);

          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition warning:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            alert('Permiso de micrófono denegado. Permite el acceso al micrófono en tu navegador.');
            isRecordingRef.current = false;
            setIsRecording(false);
          }
        };

        recognition.onend = () => {
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch {}
          } else {
            setIsRecording(false);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch (err) {
        console.warn('Fallo al iniciar SpeechRecognition, usando grabadora nativa MediaRecorder:', err);
      }
    }

    // 2. Fallback universal para navegadores sin SpeechRecognition (Firefox, Brave, WebViews)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      alert('Tu navegador no permite la captura de audio.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : '';

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });
        if (audioBlob.size > 0) {
          setIsUploading(true);
          try {
            const formData = new FormData();
            const ext = mediaRecorder.mimeType?.includes('ogg') ? 'ogg' : 'webm';
            const audioFile = new File(
              [audioBlob],
              `nota_de_voz_${Date.now()}.${ext}`,
              { type: mediaRecorder.mimeType || 'audio/webm' }
            );
            formData.append('files', audioFile);

            const res = await fetch('/api/files/upload', {
              method: 'POST',
              body: formData,
            });
            const data = await res.json();
            if (data.success && data.attachments && data.attachments.length > 0) {
              setPendingAttachments((prev) => [...prev, ...data.attachments]);
              if (!inputText.trim()) {
                setInputText('Escucha la nota de voz adjunta y responde a mi consulta.');
              }
            }
          } catch (uploadErr) {
            console.error('Error al subir nota de voz grabada:', uploadErr);
          } finally {
            setIsUploading(false);
          }
        }
      };

      mediaRecorder.start(500);
      isRecordingRef.current = true;
      setIsRecording(true);
    } catch (err) {
      console.error('Error accediendo al micrófono con MediaRecorder:', err);
      alert('No se pudo acceder al micrófono. Por favor concede permisos de micrófono en el navegador.');
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  };

  const activeModel = findModel(activeModelId);

  // Cálculo en tiempo real de la ventana de contexto para el aro
  const contextUsage: ContextWindowUsage = calculateContextUsage(
    messages,
    inputText,
    activeModelId
  );

  // Detección de scroll del usuario para mostrar el botón "Volver abajo"
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isScrolledUp = distanceFromBottom > 140;
    setShowScrollBottom(isScrolledUp);
    isUserScrolledUpRef.current = isScrolledUp;
  };

  // Función para volver abajo del todo
  const scrollToBottom = () => {
    isUserScrolledUpRef.current = false;
    setShowScrollBottom(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll al final respetando si el usuario subió deliberadamente a leer mensajes anteriores
  useEffect(() => {
    if (!isUserScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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

    if (isRecording) {
      isRecordingRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsRecording(false);
    }

    setInputText('');
    setPendingAttachments([]);
    isUserScrolledUpRef.current = false;
    setShowScrollBottom(false);
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
      {/* 1.A. Barra Superior (Top Navigation & Status Bar) */}
      <header className="h-12 border-b border-surface-border bg-sidebar/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 select-none z-10">
        {/* Lado Izquierdo */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-surface-hover transition-colors border border-transparent hover:border-surface-border"
              title={isSidebarOpen ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}
            >
              {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4 text-accent" />}
            </button>
          )}

          <span className="text-slate-600 text-xs select-none">/</span>

          {projectPath ? (
            <>
              {onUpdateProjectPath ? (
                <WorkspaceSelector projectPath={projectPath} onUpdateProjectPath={onUpdateProjectPath} />
              ) : (
                <span
                  className="bg-surface border border-surface-border text-slate-300 font-mono text-[11px] rounded-md px-2 py-0.5 truncate max-w-[200px] flex items-center gap-1.5"
                  title={projectPath}
                >
                  <span>📁</span>
                  <span className="truncate">{projectPath.split(/[/\\]+/).filter(Boolean).pop() || projectPath}</span>
                </span>
              )}
              <span className="text-slate-600 text-xs select-none">/</span>
            </>
          ) : onUpdateProjectPath ? (
            <>
              <WorkspaceSelector projectPath="" onUpdateProjectPath={onUpdateProjectPath} />
              <span className="text-slate-600 text-xs select-none">/</span>
            </>
          ) : null}

          <h2
            className="text-xs font-medium text-slate-200 truncate font-sans max-w-[240px] sm:max-w-sm md:max-w-md"
            title={activeConversationTitle}
          >
            {activeConversationTitle || 'Nueva conversación'}
          </h2>
        </div>

        {/* Lado Derecho */}
        <div className="flex items-center gap-2">
          {/* Selector interactivo de Cuentas Google */}
          <AccountSelector
            accounts={accounts}
            activeAccountId={activeAccountId}
            onSelectAccount={onSelectAccount}
            onOpenSettings={onOpenSettings}
            onRotateNext={onRotateNext}
            activeModelId={activeModelId}
            onRefreshQuotas={onRefreshQuotas}
          />

          {/* Badge de Estado de Rotación */}
          <button
            type="button"
            onClick={() => onOpenSettings('rotacion')}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Abrir configuración del pool de rotación"
          >
            {accounts.length > 1 ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>Pool activo: {accounts.length} cuentas</span>
              </>
            ) : accounts.length === 1 ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                <span>1 cuenta vinculada</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span>Sin cuentas</span>
              </>
            )}
          </button>

          {/* Botón de selector de archivos estilizado y discreto */}
          <button
            type="button"
            onClick={() => {
              const next = !isFileExplorerOpen;
              setIsFileExplorerOpen(next);
              localStorage.setItem('muac_file_explorer_open', String(next));
            }}
            className={`px-2.5 py-1 rounded-md transition-colors border flex items-center gap-1.5 text-xs ${
              isFileExplorerOpen
                ? 'bg-surface-active text-accent border-accent/40 shadow-sm'
                : 'bg-surface text-slate-400 hover:text-white hover:bg-surface-hover border-surface-border'
            }`}
            title={isFileExplorerOpen ? 'Ocultar explorador de archivos' : 'Mostrar explorador de archivos del proyecto'}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium font-sans">Archivos</span>
          </button>
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

      {/* Contenedor Principal: Chat y Gestor Lateral de Archivos */}
      <div className="flex-1 min-h-0 flex overflow-hidden w-full relative">
        {/* Espaciador izquierdo flexible (mantiene el chat centrado cuando el panel está cerrado, y ancla su posición cuando se abre) */}
        <div className="flex-1 min-w-0 hidden xl:block pointer-events-none" />

        {/* Columna Central del Chat (Ancho ergonómico controlado y estable) */}
        <div className="flex-1 min-w-0 xl:flex-none xl:w-full xl:max-w-4xl xl:shrink-0 flex flex-col min-h-0 relative mx-auto xl:mx-0">
          {/* 1.B. Área de Mensajes y Lectura */}
          <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6 w-full scroll-smooth"
            >
              {messages.length === 0 ? (
                /* Empty State: Command Palette / Centro de Trabajo */
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none my-auto">
                  <div className="w-8 h-8 rounded-lg bg-surface border border-surface-border p-1 shadow-sm flex items-center justify-center">
                    <img src="/logo.png" alt="muac" className="w-full h-full object-contain" />
                  </div>
                  <h3 className="text-base font-semibold text-white font-sans mt-2">muac · Antigravity Pro</h3>
                  <p className="text-xs text-slate-400 max-w-sm text-center mb-6 font-sans">
                    Asistente de desarrollo agéntico con rotación automática de cuotas y ejecución contextual.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg w-full text-left">
                    <button
                      type="button"
                      onClick={() => {
                        setInputText('Explícame cómo funciona la rotación automática de cuentas en muac');
                        textareaRef.current?.focus();
                      }}
                      className="group flex items-start justify-between p-3 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border hover:border-surface-border/80 transition-all text-left shadow-sm cursor-pointer"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors font-sans">
                          Rotación automática
                        </span>
                        <span className="text-[11px] text-slate-400 font-sans">
                          ¿Cómo conmuta entre cuentas de 5h y semanales?
                        </span>
                      </div>
                      <kbd className="text-[10px] font-mono text-slate-500 bg-surface-elevated px-1.5 py-0.5 rounded border border-surface-border/60 shrink-0 ml-2">
                        ⌘1
                      </kbd>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInputText('Escribe un script en TypeScript para monitorear límites de API');
                        textareaRef.current?.focus();
                      }}
                      className="group flex items-start justify-between p-3 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border hover:border-surface-border/80 transition-all text-left shadow-sm cursor-pointer"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors font-sans">
                          Código técnico
                        </span>
                        <span className="text-[11px] text-slate-400 font-sans">
                          Script de TypeScript para monitorear cuotas de agy
                        </span>
                      </div>
                      <kbd className="text-[10px] font-mono text-slate-500 bg-surface-elevated px-1.5 py-0.5 rounded border border-surface-border/60 shrink-0 ml-2">
                        ⌘2
                      </kbd>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInputText('Inspecciona el espacio de trabajo y genera un resumen de arquitectura');
                        textareaRef.current?.focus();
                      }}
                      className="group flex items-start justify-between p-3 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border hover:border-surface-border/80 transition-all text-left shadow-sm cursor-pointer"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors font-sans">
                          Explorar Workspace
                        </span>
                        <span className="text-[11px] text-slate-400 font-sans">
                          Estructura de dominios y contratos compartidos
                        </span>
                      </div>
                      <kbd className="text-[10px] font-mono text-slate-500 bg-surface-elevated px-1.5 py-0.5 rounded border border-surface-border/60 shrink-0 ml-2">
                        ⌘3
                      </kbd>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInputText('Crea un plan de refactorización según la metodología SDD');
                        textareaRef.current?.focus();
                      }}
                      className="group flex items-start justify-between p-3 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border hover:border-surface-border/80 transition-all text-left shadow-sm cursor-pointer"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors font-sans">
                          Planificación SDD
                        </span>
                        <span className="text-[11px] text-slate-400 font-sans">
                          Especificar fases, subagentes y testing
                        </span>
                      </div>
                      <kbd className="text-[10px] font-mono text-slate-500 bg-surface-elevated px-1.5 py-0.5 rounded border border-surface-border/60 shrink-0 ml-2">
                        ⌘4
                      </kbd>
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const linesCount = msg.content ? msg.content.split('\n').length : 0;
                  const isLongResponse = linesCount > 35;
                  const { thinking, cleanContent } = extractThinking(msg.content);

                  return (
                    <div
                      key={msg.id}
                      className={`flex text-xs leading-relaxed ${
                        isUser ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`flex flex-col gap-2.5 transition-colors ${
                          isUser
                            ? 'max-w-[80%] rounded-lg px-4 py-2.5 bg-surface-elevated border border-surface-border text-slate-200 shadow-sm leading-relaxed'
                            : 'w-full bg-transparent border-none shadow-none text-slate-200 px-0.5 py-1 leading-relaxed font-sans'
                        }`}
                      >
                        {/* Adjuntos del Mensaje */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-col gap-2 pt-0.5">
                            {msg.attachments.map((att) => (
                              <div key={att.id} className="rounded-lg overflow-hidden">
                                {att.type === 'image' ? (
                                  <div className="relative group cursor-pointer" onClick={() => setPreviewAttachment(att)}>
                                    <img
                                      src={att.url}
                                      alt={att.name}
                                      className="max-h-72 max-w-full rounded-lg object-contain bg-black/40 border border-surface-border hover:opacity-95 transition-opacity"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2 text-white text-xs font-medium">
                                      <Eye className="w-4 h-4" />
                                      <span>Ver imagen completa</span>
                                    </div>
                                  </div>
                                ) : att.type === 'video' ? (
                                  <div className="relative">
                                    <video
                                      src={att.url}
                                      controls
                                      className="max-h-72 max-w-full rounded-lg bg-black border border-surface-border"
                                    />
                                  </div>
                                ) : att.type === 'audio' ? (
                                  <div
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                      isUser
                                        ? 'bg-black/30 border-surface-border text-slate-200'
                                        : 'bg-surface-elevated border-surface-border text-slate-200'
                                    }`}
                                  >
                                    <div className="w-8 h-8 rounded-md bg-accent/20 flex items-center justify-center text-blue-300 shrink-0">
                                      <Volume2 className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-semibold truncate font-sans">{att.name}</div>
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        {formatFileSize(att.size)} • Nota de voz
                                      </div>
                                      <audio controls src={att.url} className="w-full h-8 mt-1.5 accent-blue-500" />
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-colors ${
                                      isUser
                                        ? 'bg-black/30 border-surface-border text-slate-200'
                                        : 'bg-surface-elevated border-surface-border text-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <div className="w-8 h-8 rounded-md bg-accent/20 flex items-center justify-center text-blue-300 shrink-0">
                                        <FileText className="w-4 h-4" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold truncate font-sans">{att.name}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">
                                          {att.lineCount ? `${att.lineCount} líneas • ` : ''}
                                          {formatFileSize(att.size)}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewAttachment(att)}
                                        className="p-1.5 rounded-md hover:bg-surface-hover text-slate-300 hover:text-white transition-colors"
                                        title="Previsualizar contenido"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      <a
                                        href={att.url}
                                        download={att.name}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-md hover:bg-surface-hover text-slate-300 hover:text-white transition-colors"
                                        title="Descargar archivo"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Bloque de Pensamiento / Razonamiento (Thinking) */}
                        {!isUser && (thinking || (msg.usage?.thinkingTokens && msg.usage.thinkingTokens > 0)) && (
                          <ThinkingAccordion
                            thinkingText={thinking}
                            thinkingTokens={msg.usage?.thinkingTokens}
                          />
                        )}

                        {/* Contenido de Texto */}
                        {isUser ? (
                          msg.content && (
                            <div className="whitespace-pre-wrap font-sans text-xs break-words leading-relaxed">
                              {renderMessageContentWithMedia(msg.content)}
                            </div>
                          )
                        ) : (
                          cleanContent && (
                            <div className="font-sans text-xs break-words leading-relaxed">
                              <MarkdownRenderer
                                content={cleanContent}
                                onPreviewImage={(src, alt) =>
                                  setPreviewAttachment({
                                    id: `inline_${Date.now()}`,
                                    name: alt || 'imagen.png',
                                    type: 'image',
                                    url: src,
                                    size: 0,
                                    mimeType: 'image/png',
                                  })
                                }
                              />
                            </div>
                          )
                        )}

                        {/* Si la respuesta del asistente es extensa (> 35 líneas), botón para descargarla */}
                        {!isUser && isLongResponse && (
                          <div className="flex items-center justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => handleDownloadTextAsFile(msg.content, `respuesta_${msg.id.slice(-6)}.txt`)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-surface-border hover:bg-surface-hover text-slate-300 hover:text-white font-mono text-[10px] transition-colors"
                              title="Descargar esta respuesta como archivo de texto"
                            >
                              <FileCode className="w-3 h-3 text-accent" />
                              <span>Descargar como archivo ({linesCount} líneas)</span>
                            </button>
                          </div>
                        )}

                        {/* Metadatos del mensaje */}
                        {!isUser && msg.usage && (
                          <div className="mt-1 pt-2 border-t border-surface-border flex items-center gap-3 font-mono text-[10px] text-slate-500">
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
                    </div>
                  );
                })
              )}

              {/* Mensaje en Streaming y Observabilidad */}
              {isStreaming && (
                <div className="flex flex-col gap-2">
                  <AgentActivityBanner activities={activities} isStreaming={isStreaming} />

                  {streamingDelta && (() => {
                    const { thinking: stThinking, cleanContent: stClean } = extractThinking(streamingDelta);
                    return (
                      <div className="flex text-xs leading-relaxed justify-start">
                        <div className="w-full bg-transparent border-none shadow-none text-slate-200 px-0.5 py-1 flex flex-col gap-2.5 font-sans">
                          {stThinking && (
                            <ThinkingAccordion thinkingText={stThinking} defaultExpanded={true} />
                          )}
                          <div className="font-sans text-xs break-words">
                            <MarkdownRenderer
                              content={stClean}
                              isStreaming={true}
                              onPreviewImage={(src, alt) =>
                                setPreviewAttachment({
                                  id: `inline_${Date.now()}`,
                                  name: alt || 'imagen.png',
                                  type: 'image',
                                  url: src,
                                  size: 0,
                                  mimeType: 'image/png',
                                })
                              }
                            />
                            <span className="inline-block w-1.5 h-3.5 ml-1 bg-accent animate-pulse align-middle" />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Composer (Input Bar) (con w-full p-4 pt-2) */}
          <div className="p-4 pt-2 w-full relative">
            {/* Botón flotante para volver abajo (solo icono, encima de la barra de escribir mensaje) */}
            {showScrollBottom && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-30 animate-in fade-in zoom-in-95 duration-200">
                <button
                  type="button"
                  onClick={scrollToBottom}
                  className="w-9 h-9 rounded-full bg-surface-elevated hover:bg-surface-hover text-slate-200 hover:text-white border border-surface-border shadow-xl hover:shadow-2xl transition-all flex items-center justify-center backdrop-blur-md group hover:border-accent/60 cursor-pointer relative hover:scale-105"
                  title="Volver abajo del todo"
                >
                  <ArrowDown className="w-4 h-4 text-accent group-hover:translate-y-0.5 transition-transform" />
                  {isStreaming && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent border border-surface-elevated" />
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* 1.C. Composer (Input Bar) - Estilo Raycast / Cursor (Caja Contenedora Unificada) */}
            <div className="w-full rounded-xl bg-surface border border-surface-border focus-within:border-accent shadow-lg transition-all p-2.5 flex flex-col gap-2">
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

          {/* Zona Superior: Textarea transparente, sin bordes propios, expandible */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => handleTextChange(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Envía un mensaje, consulta técnica o adjunta archivos... (Enter para enviar)"
            className="resize-none min-h-[44px] max-h-48 text-xs text-slate-200 placeholder:text-slate-500 font-sans leading-relaxed focus:outline-none w-full bg-transparent px-1 py-1"
          />

          {/* Zona Media: Previsualizaciones de Adjuntos Pendientes */}
          {pendingAttachments.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap px-1 pt-1 border-t border-surface-border/50 pb-1">
              {pendingAttachments.map((att) => (
                <div
                  key={att.id}
                  className="bg-surface-elevated border border-surface-border rounded-md p-1.5 text-xs group relative flex items-center gap-2 shadow-sm transition-colors animate-in fade-in"
                >
                  {att.type === 'image' ? (
                    <div
                      className="relative w-7 h-7 rounded overflow-hidden bg-black/40 border border-surface-border shrink-0 cursor-pointer group-hover:border-accent/50 transition-colors"
                      onClick={() => setPreviewAttachment(att)}
                      title="Clic para previsualizar imagen"
                    >
                      <img
                        src={att.url}
                        alt={att.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Eye className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  ) : att.type === 'video' ? (
                    <div
                      className="relative w-7 h-7 rounded overflow-hidden bg-purple-950/40 border border-purple-500/30 shrink-0 flex items-center justify-center cursor-pointer group-hover:border-purple-500/60 transition-colors"
                      onClick={() => setPreviewAttachment(att)}
                      title="Clic para previsualizar video"
                    >
                      <Film className="w-3 h-3 text-purple-400" />
                    </div>
                  ) : att.type === 'audio' ? (
                    <div
                      className="w-7 h-7 rounded bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 cursor-pointer group-hover:border-amber-500/60 transition-colors"
                      onClick={() => setPreviewAttachment(att)}
                      title="Clic para escuchar audio"
                    >
                      <Volume2 className="w-3 h-3" />
                    </div>
                  ) : (
                    <div
                      className="w-7 h-7 rounded bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 cursor-pointer group-hover:border-emerald-500/60 transition-colors"
                      onClick={() => setPreviewAttachment(att)}
                      title="Clic para ver contenido del archivo"
                    >
                      <FileText className="w-3 h-3" />
                    </div>
                  )}

                  <div className="flex flex-col min-w-0 max-w-[130px]">
                    <span className="text-[11px] font-medium text-slate-200 truncate font-sans">{att.name}</span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {att.lineCount ? `${att.lineCount} lín • ` : ''}
                      {formatFileSize(att.size)}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 ml-1">
                    <button
                      type="button"
                      onClick={() => setPreviewAttachment(att)}
                      className="p-1 rounded hover:bg-surface-hover text-slate-400 hover:text-white transition-colors"
                      title="Previsualizar"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Quitar"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Zona Inferior: Toolbar integrada dentro del composer */}
          <div className="flex items-center justify-between pt-1.5 border-t border-surface-border/50">
            {/* A la izquierda */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <ModelSelector selectedModelId={activeModelId} onSelectModel={onSelectModel} />
              <ReasoningSlider
                modelId={activeModelId}
                effort={activeReasoningEffort}
                onChangeEffort={onSelectReasoningEffort}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming || isUploading}
                className="p-1.5 rounded-md hover:bg-surface-hover text-slate-400 hover:text-white transition-colors shrink-0"
                title="Adjuntar fotos, videos o archivos"
              >
                {isUploading ? (
                  <div className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                ) : (
                  <Paperclip className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleToggleRecording}
                disabled={isStreaming}
                className={`p-1.5 rounded-md transition-colors shrink-0 flex items-center justify-center gap-1 ${
                  isRecording
                    ? 'bg-rose-950/90 border border-rose-500/60 text-rose-300 shadow-sm hover:bg-rose-900/90'
                    : 'hover:bg-surface-hover text-slate-400 hover:text-white'
                }`}
                title={
                  isRecording
                    ? 'Grabando voz... Haz clic para detener'
                    : 'Dictar mensaje con el micrófono'
                }
              >
                {isRecording ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
                    </span>
                    <Mic className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                  </>
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* A la derecha */}
            <div className="flex items-center gap-2 shrink-0">
              <ContextRing usage={contextUsage} modelName={activeModel.name} />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStopStreaming}
                  className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  title="Detener respuesta"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Detener</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={(!inputText.trim() && pendingAttachments.length === 0) || isUploading}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors ${
                    (inputText.trim() || pendingAttachments.length > 0) && !isUploading
                      ? 'bg-accent hover:bg-accent-hover text-white cursor-pointer'
                      : 'bg-surface-elevated text-slate-500 cursor-not-allowed border border-surface-border/50'
                  }`}
                  title="Enviar mensaje (Enter)"
                >
                  {isUploading ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Enviar</span>
                      <kbd className="text-[10px] font-mono opacity-70">↵</kbd>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

        {/* Zona Derecha: Espaciador o Explorador de Archivos */}
        {projectPath && isFileExplorerOpen ? (
          <div
            style={fileExplorerWidth ? { width: `${fileExplorerWidth}px`, flex: 'none' } : undefined}
            className={`${fileExplorerWidth ? '' : 'flex-1'} min-w-[320px] h-full overflow-hidden border-l border-surface-border flex flex-col z-20 animate-in fade-in slide-in-from-right-2 duration-150`}
          >
            <FileExplorer
              workspacePath={projectPath}
              isOpen={isFileExplorerOpen}
              onClose={() => {
                setIsFileExplorerOpen(false);
                localStorage.setItem('muac_file_explorer_open', 'false');
              }}
              onSelectFile={(file) => {
                setInputText((prev) => `${prev ? prev + ' ' : ''}@${file.relativePath || file.name}`);
              }}
              onResizeWidth={setFileExplorerWidth}
            />
          </div>
        ) : (
          /* Si está cerrado, espaciador simétrico para que el chat quede exactamente en el centro */
          <div className="flex-1 min-w-0 hidden xl:block pointer-events-none" />
        )}
      </div>

      {/* Modal / Lightbox de Vista Previa de Adjuntos (Fotos, Videos, Audios, Archivos) */}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] bg-surface-elevated border border-surface-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barra superior del modal */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-border bg-surface">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-accent/20 border border-accent/30 flex items-center justify-center text-accent shrink-0">
                  {previewAttachment.type === 'image' && <ImageIcon className="w-4 h-4" />}
                  {previewAttachment.type === 'video' && <Film className="w-4 h-4" />}
                  {previewAttachment.type === 'audio' && <Volume2 className="w-4 h-4" />}
                  {previewAttachment.type === 'file' && <FileText className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-slate-100 truncate font-sans">{previewAttachment.name}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {previewAttachment.lineCount ? `${previewAttachment.lineCount} líneas • ` : ''}
                    {formatFileSize(previewAttachment.size)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {previewFileContent && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(previewFileContent);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface border border-surface-border hover:bg-surface-hover text-slate-300 hover:text-white text-xs transition-colors"
                    title="Copiar contenido"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                )}

                <a
                  href={previewAttachment.url}
                  download={previewAttachment.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors shadow-sm"
                  title="Descargar archivo original"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </a>

                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-surface-hover transition-colors ml-1"
                  title="Cerrar vista previa (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Contenido del modal */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[260px] bg-black/30">
              {previewAttachment.type === 'image' && (
                <div className="relative max-h-[75vh] flex items-center justify-center">
                  <img
                    src={previewAttachment.url}
                    alt={previewAttachment.name}
                    className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-lg border border-surface-border"
                  />
                </div>
              )}

              {previewAttachment.type === 'video' && (
                <div className="w-full flex items-center justify-center">
                  <video
                    src={previewAttachment.url}
                    controls
                    autoPlay
                    className="max-h-[75vh] max-w-full rounded-lg shadow-lg border border-surface-border bg-black"
                  />
                </div>
              )}

              {previewAttachment.type === 'audio' && (
                <div className="w-full max-w-md p-6 rounded-xl bg-surface border border-surface-border flex flex-col items-center gap-4 text-center shadow-xl">
                  <div className="w-12 h-12 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                    <Volume2 className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100 font-sans">{previewAttachment.name}</h4>
                    <p className="text-xs text-slate-400 font-mono mt-1">Nota de voz • {formatFileSize(previewAttachment.size)}</p>
                  </div>
                  <audio controls autoPlay src={previewAttachment.url} className="w-full mt-2 accent-amber-500" />
                </div>
              )}

              {previewAttachment.type === 'file' && (
                <div className="w-full h-full flex flex-col">
                  {isLoadingPreview ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                      <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                      <span className="text-xs font-sans">Cargando vista previa...</span>
                    </div>
                  ) : previewFileContent !== null ? (
                    <div className="relative w-full max-h-[70vh] overflow-auto rounded-lg bg-canvas p-4 border border-surface-border text-slate-200 font-mono text-xs leading-relaxed select-text">
                      <pre className="whitespace-pre-wrap break-words">{previewFileContent}</pre>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                      <div className="w-12 h-12 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-100 mb-1 font-sans">{previewAttachment.name}</h4>
                        <p className="text-xs text-slate-400 max-w-sm font-sans">
                          Este archivo binario no tiene vista previa de texto directo. Puedes descargarlo para visualizarlo en tu equipo.
                        </p>
                      </div>
                      <a
                        href={previewAttachment.url}
                        download={previewAttachment.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-md transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Descargar archivo</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
      const currentAlt = match[1];
      const currentSrc = match[2];
      const currentIdx = match.index;
      parts.push(
        <div key={currentIdx} className="my-2">
          <img
            src={currentSrc}
            alt={currentAlt}
            className="max-h-72 max-w-full rounded-xl object-contain bg-black/40 border border-white/10 cursor-pointer hover:opacity-95 transition-opacity shadow-md"
            onClick={() =>
              setPreviewAttachment({
                id: `inline_${currentIdx}`,
                name: currentAlt || 'imagen_chat.png',
                type: 'image',
                url: currentSrc,
                size: 0,
                mimeType: 'image/png',
              })
            }
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
