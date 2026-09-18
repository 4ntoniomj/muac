'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/chat/components/sidebar';
import { ChatCanvas } from '@/chat/components/chat-canvas';
import { SettingsModal } from '@/configuracion/components/settings-modal';
import type { Conversation, Message } from '@/shared/types/chat';
import type { AccountWithQuota } from '@/shared/types/account';
import type { GlobalSettings } from '@/shared/types/settings';
import type { RotationEvent } from '@/shared/types/quota';
import type { AgentActivity } from '@/chat/agy-bridge';
import { DEFAULT_SETTINGS } from '@/shared/types/settings';

export default function MuacApp() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [accounts, setAccounts] = useState<AccountWithQuota[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>('');
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [rotationLogs, setRotationLogs] = useState<RotationEvent[]>([]);
  const [activeModelId, setActiveModelId] = useState<string>(DEFAULT_SETTINGS.defaultModelId);
  const [activeReasoningEffort, setActiveReasoningEffort] = useState<'low' | 'medium' | 'high'>(DEFAULT_SETTINGS.reasoningEffort || 'high');
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [activeProjectPath, setActiveProjectPath] = useState<string>('');
  const [authToast, setAuthToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados de streaming y modales
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingDelta, setStreamingDelta] = useState('');
  const [rotationNotice, setRotationNotice] = useState<{
    fromEmail: string;
    toEmail: string;
    reason: string;
  } | null>(null);
  const [verificationAlert, setVerificationAlert] = useState<{
    error: string;
    url?: string;
  } | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'rotacion' | 'cuentas' | 'permisos' | 'general'>('rotacion');

  // 1. Cargar configuración inicial
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        setActiveModelId(data.settings.defaultModelId || DEFAULT_SETTINGS.defaultModelId);
        if (data.settings.reasoningEffort) {
          setActiveReasoningEffort(data.settings.reasoningEffort);
        }
        if (data.settings.defaultProjectPath && !activeProjectPath) {
          setActiveProjectPath(data.settings.defaultProjectPath);
        }
      }
    } catch (err) {
      console.error('Error al cargar configuración:', err);
    }
  }, [activeProjectPath]);

  // 2. Cargar cuentas
  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      if (data.success) {
        setAccounts(data.accounts || []);
        if (data.activeAccount) {
          setActiveAccountId(data.activeAccount.id);
        }
        if (data.rotationLogs) {
          setRotationLogs(data.rotationLogs);
        }

        // Si no hay ninguna cuenta registrada, importar automáticamente la cuenta activa del sistema
        if ((!data.accounts || data.accounts.length === 0)) {
          const importRes = await fetch('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'import_system' }),
          });
          const importData = await importRes.json();
          if (importData.success && importData.account) {
            setAccounts([importData.account]);
            setActiveAccountId(importData.account.id);
          }
        }
      }
    } catch (err) {
      console.error('Error al cargar cuentas:', err);
    }
  }, []);

  // 3. Detectar retornos de OAuth (éxito o error) en la URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const authSuccess = params.get('auth_success');
      const authError = params.get('auth_error');
      const email = params.get('email');

      if (authSuccess === 'true') {
        setAuthToast({
          type: 'success',
          message: `¡Cuenta Google vinculada correctamente! ${email ? `(${decodeURIComponent(email)})` : ''}`,
        });
        loadAccounts();
        window.history.replaceState({}, '', window.location.pathname);
      } else if (authError) {
        setAuthToast({
          type: 'error',
          message: `Error al autenticar con Google: ${decodeURIComponent(authError)}`,
        });
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [loadAccounts]);

  // 4. Cargar conversaciones
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
        if (data.conversations && data.conversations.length > 0 && !activeConversationId) {
          setActiveConversationId(data.conversations[0].id);
          setActiveProjectPath(data.conversations[0].projectPath || '');
        }
      }
    } catch (err) {
      console.error('Error al cargar conversaciones:', err);
    }
  }, [activeConversationId]);

  // 5. Cargar mensajes de la conversación activa
  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
        if (data.conversation?.modelId) {
          setActiveModelId(data.conversation.modelId);
        }
        if (data.conversation?.reasoningEffort) {
          setActiveReasoningEffort(data.conversation.reasoningEffort);
        }
        setActiveProjectPath(data.conversation?.projectPath || '');
      }
    } catch (err) {
      console.error('Error al cargar mensajes:', err);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadAccounts();
    loadConversations();
  }, [loadSettings, loadAccounts, loadConversations]);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, loadMessages]);

  // Manejo de cambio de modelo con persistencia
  const handleSelectModel = async (newModelId: string) => {
    setActiveModelId(newModelId);
    if (activeConversationId) {
      try {
        await fetch(`/api/conversations/${activeConversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId: newModelId }),
        });
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversationId ? { ...c, modelId: newModelId } : c))
        );
      } catch (err) {
        console.error('Error al actualizar modelo:', err);
      }
    }
  };

  // Manejo de cambio de esfuerzo de razonamiento con persistencia
  const handleSelectReasoningEffort = async (newEffort: 'low' | 'medium' | 'high') => {
    setActiveReasoningEffort(newEffort);
    if (activeConversationId) {
      try {
        await fetch(`/api/conversations/${activeConversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reasoningEffort: newEffort }),
        });
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversationId ? { ...c, reasoningEffort: newEffort } : c))
        );
      } catch (err) {
        console.error('Error al actualizar esfuerzo de razonamiento:', err);
      }
    }
  };

  // Manejo de nueva conversación
  const handleNewConversation = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Nueva conversación',
          modelId: activeModelId,
          reasoningEffort: activeReasoningEffort,
          projectPath: activeProjectPath || settings.defaultProjectPath,
        }),
      });
      const data = await res.json();
      if (data.success && data.conversation) {
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConversationId(data.conversation.id);
        if (data.conversation.projectPath) {
          setActiveProjectPath(data.conversation.projectPath);
        }
        setMessages([]);
      }
    } catch (err) {
      console.error('Error al crear conversación:', err);
    }
  };

  // Manejo de actualización de ruta de proyecto (Workspace)
  const handleUpdateProjectPath = async (newPath: string) => {
    setActiveProjectPath(newPath);
    if (activeConversationId) {
      try {
        await fetch(`/api/conversations/${activeConversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath: newPath }),
        });
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversationId ? { ...c, projectPath: newPath } : c))
        );
      } catch (err) {
        console.error('Error al actualizar ruta de proyecto:', err);
      }
    }
  };

  // Manejo de rotación manual directa a la siguiente cuenta del pool
  const handleRotateNext = async () => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rotate_next', accountId: activeAccountId }),
      });
      const data = await res.json();
      if (data.success && data.newAccount) {
        setActiveAccountId(data.newAccount.id);
        await loadAccounts();
        if (data.event) {
          setRotationNotice({
            fromEmail: data.event.fromEmail,
            toEmail: data.event.toEmail,
            reason: data.event.reason,
          });
        }
      } else {
        alert(data.error || 'No se pudo conmutar de cuenta.');
      }
    } catch (err) {
      console.error('Error al iterar cuenta:', err);
      alert('Error de conexión al rotar');
    }
  };

  // Manejo de anclado individual de conversación
  const handleTogglePinConversation = async (id: string, isPinned?: boolean) => {
    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned }),
      });
      await loadConversations();
    } catch (err) {
      console.error('Error al cambiar anclado de conversación:', err);
    }
  };

  // Manejo de anclado masivo de conversaciones
  const handleBulkPin = async (ids: string[], isPinned: boolean) => {
    try {
      await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isPinned ? 'bulk_pin' : 'bulk_unpin', ids }),
      });
      await loadConversations();
    } catch (err) {
      console.error('Error en anclado masivo:', err);
    }
  };

  // Manejo de eliminación masiva de conversaciones
  const handleBulkDelete = async (ids: string[]) => {
    try {
      await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_delete', ids }),
      });
      setConversations((prev) => prev.filter((c) => !ids.includes(c.id)));
      if (activeConversationId && ids.includes(activeConversationId)) {
        const remaining = conversations.filter((c) => !ids.includes(c.id));
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Error en eliminación masiva:', err);
    }
  };

  // Manejo de eliminación individual de conversación
  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Error al eliminar conversación:', err);
    }
  };

  // Manejo de selección de cuenta activa
  const handleSelectAccount = async (accountId: string) => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_active', accountId }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveAccountId(accountId);
        await loadAccounts();
      }
    } catch (err) {
      console.error('Error al cambiar cuenta activa:', err);
    }
  };

  // Manejo de toggle del pool de rotación
  const handleTogglePool = async (accountId: string, inPool: boolean) => {
    try {
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_pool', accountId, inPool }),
      });
      await loadAccounts();
    } catch (err) {
      console.error('Error al alternar pool:', err);
    }
  };

  // Manejo de eliminación de cuenta
  const handleDeleteAccount = async (accountId: string) => {
    try {
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', accountId }),
      });
      await loadAccounts();
    } catch (err) {
      console.error('Error al eliminar cuenta:', err);
    }
  };

  // Manejo de importación de cuenta del sistema
  const handleImportSystemAccount = async () => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_system' }),
      });
      const data = await res.json();
      if (data.success) {
        await loadAccounts();
        alert('Cuenta del sistema importada con éxito.');
      } else {
        alert(data.error || 'No se pudo importar la cuenta.');
      }
    } catch (err) {
      console.error('Error al importar cuenta:', err);
    }
  };

  // Manejo de refresco manual de cuotas
  const handleRefreshQuotas = async () => {
    try {
      await fetch('/api/quota');
      await loadAccounts();
    } catch (err) {
      console.error('Error al refrescar cuotas:', err);
    }
  };

  // Manejo de actualización de configuración global
  const handleUpdateSettings = async (newSettings: Partial<GlobalSettings>) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        if (data.settings.defaultModelId) {
          setActiveModelId(data.settings.defaultModelId);
        }
      }
    } catch (err) {
      console.error('Error al actualizar configuración:', err);
    }
  };

  // Envío de mensaje con streaming
  const handleSendMessage = async (text: string) => {
    let targetConvoId = activeConversationId;

    // Si no hay conversación activa, crear una primero
    if (!targetConvoId) {
      const createRes = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: text.slice(0, 30),
          modelId: activeModelId,
          reasoningEffort: activeReasoningEffort,
          projectPath: activeProjectPath || settings.defaultProjectPath || undefined,
        }),
      });
      const createData = await createRes.json();
      if (!createData.success || !createData.conversation) {
        alert('Error al iniciar conversación');
        return;
      }
      targetConvoId = createData.conversation.id;
      setActiveConversationId(targetConvoId);
      if (createData.conversation.projectPath) {
        setActiveProjectPath(createData.conversation.projectPath);
      }
      setConversations((prev) => [createData.conversation, ...prev]);
    }

    if (!targetConvoId) return;

    // Agregar mensaje de usuario inmediatamente a la interfaz
    const tempUserMsg: Message = {
      id: 'temp_' + Date.now(),
      conversationId: targetConvoId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
      modelId: activeModelId,
      reasoningEffort: activeReasoningEffort,
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    setIsStreaming(true);
    setStreamingDelta('');
    setActivities([]);
    setRotationNotice(null);
    setVerificationAlert(null);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: targetConvoId,
          prompt: text,
          modelId: activeModelId,
          reasoningEffort: activeReasoningEffort,
          accountId: activeAccountId,
          projectPath: activeProjectPath,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Fallo al conectar con el stream del servidor');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullAssistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'activity' && event.activity) {
              setActivities((prev) => {
                const act = event.activity;
                const idx = prev.findIndex(
                  (a) => a.stepIndex === act.stepIndex && a.stepType === act.stepType
                );
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = { ...next[idx], ...act };
                  return next;
                }
                return [...prev, act];
              });
            } else if (event.type === 'delta' && event.text) {
              fullAssistantText += event.text;
              setStreamingDelta(fullAssistantText);
            } else if (event.type === 'rotated' && event.rotationInfo) {
              // Notificación visual de rotación automática
              setRotationNotice(event.rotationInfo);
              await loadAccounts();
            } else if (event.type === 'done') {
              // Completado
            } else if (event.type === 'error') {
              console.error('Error devuelto por stream:', event.error);
              if (event.verificationUrl || (event.error && (event.error.includes('eligible') || event.error.includes('verify')))) {
                setVerificationAlert({
                  error: event.error,
                  url: event.verificationUrl,
                });
              } else {
                alert(event.error);
              }
            }
          } catch (pErr) {
            console.error('Error parseando evento SSE:', pErr);
          }
        }
      }

      // Recargar mensajes persistidos y cuotas actualizadas
      await loadMessages(targetConvoId);
      await loadConversations();
      await loadAccounts();
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      alert((err as Error).message || 'Error en la transmisión');
    } finally {
      setIsStreaming(false);
      setStreamingDelta('');
    }
  };

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background relative">
      {/* Toast flotante de retroalimentación OAuth */}
      {authToast && (
        <div
          className={`fixed top-4 right-6 z-50 p-3.5 rounded-xl border shadow-2xl flex items-center gap-3 text-xs max-w-md animate-in slide-in-from-top duration-300 backdrop-blur-md ${
            authToast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/90 border-red-500/50 text-red-200'
          }`}
        >
          <span className="flex-1 font-medium leading-relaxed">{authToast.message}</span>
          <button
            type="button"
            onClick={() => setAuthToast(null)}
            className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded text-xs transition-all"
          >
            ✕
          </button>
        </div>
      )}

      {/* Barra Lateral Izquierda */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => setActiveConversationId(id)}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onTogglePinConversation={handleTogglePinConversation}
        onBulkPin={handleBulkPin}
        onBulkDelete={handleBulkDelete}
        onOpenSettings={() => {
          setSettingsInitialTab('rotacion');
          setIsSettingsOpen(true);
        }}
        activeAccountEmail={activeAccount?.email}
      />

      {/* Canvas Principal de Conversación */}
      <ChatCanvas
        messages={messages}
        activeModelId={activeModelId}
        onSelectModel={handleSelectModel}
        activeReasoningEffort={activeReasoningEffort}
        onSelectReasoningEffort={handleSelectReasoningEffort}
        activities={activities}
        accounts={accounts}
        activeAccountId={activeAccountId}
        onSelectAccount={handleSelectAccount}
        onSendMessage={handleSendMessage}
        isStreaming={isStreaming}
        streamingDelta={streamingDelta}
        rotationNotice={rotationNotice}
        onOpenSettings={(tab) => {
          setSettingsInitialTab(tab);
          setIsSettingsOpen(true);
        }}
        projectPath={activeProjectPath}
        onUpdateProjectPath={handleUpdateProjectPath}
        onRotateNext={handleRotateNext}
        verificationAlert={verificationAlert}
        onDismissVerificationAlert={() => setVerificationAlert(null)}
      />

      {/* Modal de Configuración Global */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        accounts={accounts}
        settings={settings}
        rotationLogs={rotationLogs}
        initialTab={settingsInitialTab}
        onUpdateSettings={handleUpdateSettings}
        onTogglePool={handleTogglePool}
        onSetActiveAccount={handleSelectAccount}
        onDeleteAccount={handleDeleteAccount}
        onImportSystemAccount={handleImportSystemAccount}
        onRefreshQuotas={handleRefreshQuotas}
      />
    </div>
  );
}
