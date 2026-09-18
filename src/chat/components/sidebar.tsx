'use client';

import React, { useState } from 'react';
import type { Conversation } from '@/shared/types/chat';
import {
  Plus,
  MessageSquare,
  Trash2,
  Settings,
  Pin,
  CheckSquare,
  Square,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => Promise<void> | void;
  onTogglePinConversation: (id: string, isPinned?: boolean) => Promise<void> | void;
  onBulkPin: (ids: string[], isPinned: boolean) => Promise<void> | void;
  onBulkDelete: (ids: string[]) => Promise<void> | void;
  onOpenSettings: () => void;
  activeAccountEmail?: string;
}

export function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onTogglePinConversation,
  onBulkPin,
  onBulkDelete,
  onOpenSettings,
  activeAccountEmail,
}: SidebarProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    ids: string[];
    title: string;
  } | null>(null);

  const allSelected = conversations.length > 0 && selectedIds.size === conversations.length;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      setIsSelectMode(false);
    } else {
      setSelectedIds(new Set(conversations.map((c) => c.id)));
      setIsSelectMode(true);
    }
  };

  const handleToggleSelectOne = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) setIsSelectMode(false);
      } else {
        next.add(id);
        setIsSelectMode(true);
      }
      return next;
    });
  };

  const handleRequestSingleDelete = (convo: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      ids: [convo.id],
      title: convo.title,
    });
  };

  const handleRequestBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      isOpen: true,
      ids: Array.from(selectedIds),
      title: `${selectedIds.size} conversaciones`,
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmModal || confirmModal.ids.length === 0) return;
    const idsToDelete = confirmModal.ids;
    setConfirmModal(null);

    if (idsToDelete.length === 1) {
      await onDeleteConversation(idsToDelete[0]);
    } else {
      await onBulkDelete(idsToDelete);
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      idsToDelete.forEach((id) => next.delete(id));
      if (next.size === 0) setIsSelectMode(false);
      return next;
    });
  };

  const handleBulkPin = async (isPinned: boolean) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await onBulkPin(ids, isPinned);
    setSelectedIds(new Set());
    setIsSelectMode(false);
  };

  const pinnedConversations = conversations.filter((c) => c.isPinned);
  const otherConversations = conversations.filter((c) => !c.isPinned);

  return (
    <aside className="w-64 h-full bg-surface border-r border-surface-border flex flex-col select-none shrink-0 relative">
      {/* Cabecera / Marca muac */}
      <div className="p-4 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-base">
            μ
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>muac</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-normal">
                PRO
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">Antigravity Rotation</p>
          </div>
        </div>
      </div>

      {/* Botón de Nuevo Chat */}
      <div className="p-3">
        <button
          type="button"
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Chat</span>
        </button>
      </div>

      {/* Barra de Gestión de Chats: Contador y Selección Total */}
      <div className="px-3 py-1.5 flex items-center justify-between text-[11px] border-b border-surface-border/50 bg-surface/40">
        <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
          Chats ({conversations.length})
        </span>

        {conversations.length > 0 && (
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors text-[10px]"
            title={allSelected ? 'Deseleccionar todos' : 'Seleccionar todos los chats'}
          >
            {allSelected ? (
              <>
                <CheckSquare className="w-3 h-3 text-blue-400" />
                <span className="text-blue-400">Deseleccionar</span>
              </>
            ) : (
              <>
                <Square className="w-3 h-3 text-slate-500" />
                <span>Seleccionar todos</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Barra flotante de Acciones en Lote cuando hay chats seleccionados */}
      {selectedIds.size > 0 && (
        <div className="p-2 mx-2 my-1.5 rounded-xl bg-blue-950/80 border border-blue-500/40 shadow-xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between text-[11px] text-blue-200 px-1">
            <span className="font-semibold">{selectedIds.size} seleccionados</span>
            <button
              type="button"
              onClick={() => {
                setSelectedIds(new Set());
                setIsSelectMode(false);
              }}
              className="text-slate-400 hover:text-white p-0.5"
              title="Cancelar selección"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => handleBulkPin(true)}
              className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 text-[10px] text-blue-200 transition-all"
              title="Anclar seleccionados"
            >
              <Pin className="w-2.5 h-2.5" />
              <span>Anclar</span>
            </button>
            <button
              type="button"
              onClick={() => handleBulkPin(false)}
              className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-all"
              title="Desanclar seleccionados"
            >
              <span>Desanclar</span>
            </button>
            <button
              type="button"
              onClick={handleRequestBulkDelete}
              className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-[10px] text-red-300 transition-all font-medium"
              title="Eliminar seleccionados con asegurar"
            >
              <Trash2 className="w-2.5 h-2.5" />
              <span>Eliminar</span>
            </button>
          </div>
        </div>
      )}

      {/* Lista de Chats (Anclados y Ordinarios) */}
      <div className="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-0.5">
        {conversations.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-500">
            No hay conversaciones previas. Haz clic en «Nuevo Chat» para comenzar.
          </div>
        ) : (
          <>
            {/* Sección de Chats Anclados */}
            {pinnedConversations.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-[9px] font-bold tracking-wider text-amber-400/90 uppercase flex items-center gap-1">
                  <Pin className="w-2.5 h-2.5 rotate-45 fill-amber-400 text-amber-400" />
                  <span>Anclados ({pinnedConversations.length})</span>
                </div>
                {pinnedConversations.map((convo) => renderConversationItem(convo))}
              </div>
            )}

            {/* Sección de Chats Recientes */}
            {otherConversations.length > 0 && (
              <div>
                {pinnedConversations.length > 0 && (
                  <div className="px-2 py-1 text-[9px] font-bold tracking-wider text-slate-500 uppercase">
                    Recientes
                  </div>
                )}
                {otherConversations.map((convo) => renderConversationItem(convo))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Pie del Sidebar: Cuenta activa y Botón Settings */}
      <div className="p-3 border-t border-surface-border bg-surface/80 flex flex-col gap-2">
        {activeAccountEmail && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-elevated/50 border border-surface-border text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-slate-300 truncate font-mono">{activeAccountEmail}</span>
          </div>
        )}

        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-surface-elevated text-slate-300 hover:text-white transition-all text-xs font-medium border border-transparent hover:border-surface-border"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Configuración</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Pool / OAuth</span>
        </button>
      </div>

      {/* Modal de Confirmación para Asegurar Eliminación */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-surface-elevated border border-surface-border rounded-2xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Asegurar eliminación</h3>
                <p className="text-[11px] text-slate-400">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ¿Estás seguro de que deseas eliminar permanentemente{' '}
              <span className="font-semibold text-white">«{confirmModal.title}»</span>? Se perderán todos los mensajes.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 rounded-xl hover:bg-slate-800 text-slate-300 text-xs font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-600/30 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, asegurar y eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );

  function renderConversationItem(convo: Conversation) {
    const isActive = convo.id === activeConversationId;
    const isSelected = selectedIds.has(convo.id);

    return (
      <div
        key={convo.id}
        className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all text-xs mb-0.5 ${
          isActive
            ? 'bg-surface-elevated text-white font-medium border border-surface-border shadow-sm'
            : isSelected
            ? 'bg-blue-900/30 text-blue-200 border border-blue-600/40'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
        }`}
        onClick={() => {
          if (isSelectMode) {
            handleToggleSelectOne(convo.id);
          } else {
            onSelectConversation(convo.id);
          }
        }}
      >
        <div className="flex items-center gap-2 min-w-0 pr-12 flex-1">
          {/* Checkbox de selección múltiple (visible en hover o si está seleccionado o en modo selección) */}
          <button
            type="button"
            onClick={(e) => handleToggleSelectOne(convo.id, e)}
            className={`p-0.5 rounded text-slate-400 hover:text-white transition-opacity shrink-0 ${
              isSelectMode || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
          >
            {isSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          {/* Icono de Mensaje o Pin */}
          {convo.isPinned ? (
            <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400 rotate-45 shrink-0" />
          ) : (
            <MessageSquare
              className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`}
            />
          )}

          <span className="truncate">{convo.title}</span>
        </div>

        {/* Acciones Rápidas (Anclar y Eliminar) */}
        <div className="flex items-center gap-0.5 absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-elevated/90 px-1 py-0.5 rounded shadow-sm">
          {/* Botón de Anclar / Desanclar */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePinConversation(convo.id, !convo.isPinned);
            }}
            className={`p-1 rounded transition-colors ${
              convo.isPinned
                ? 'text-amber-400 hover:bg-amber-400/20'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-700'
            }`}
            title={convo.isPinned ? 'Desanclar chat' : 'Anclar chat al inicio'}
          >
            <Pin className={`w-3 h-3 ${convo.isPinned ? 'fill-current rotate-45' : ''}`} />
          </button>

          {/* Botón de Eliminar con Asegurar */}
          <button
            type="button"
            onClick={(e) => handleRequestSingleDelete(convo, e)}
            className="p-1 rounded hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition-colors"
            title="Eliminar chat"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }
}
