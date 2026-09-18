'use client';

import React from 'react';
import type { Conversation } from '@/shared/types/chat';
import { Plus, MessageSquare, Trash2, Settings, Sparkles, Layers } from 'lucide-react';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onOpenSettings: () => void;
  activeAccountEmail?: string;
}

export function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onOpenSettings,
  activeAccountEmail,
}: SidebarProps) {
  return (
    <aside className="w-64 h-full bg-surface border-r border-surface-border flex flex-col select-none shrink-0">
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

      {/* Botón de Nueva Conversación */}
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

      {/* Lista de Chats */}
      <div className="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-0.5">
        <div className="px-2 py-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
          Conversaciones ({conversations.length})
        </div>

        {conversations.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-500">
            No hay conversaciones previas. Haz clic en «Nuevo Chat» para comenzar.
          </div>
        ) : (
          conversations.map((convo) => {
            const isActive = convo.id === activeConversationId;
            return (
              <div
                key={convo.id}
                className={`group relative flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all text-xs ${
                  isActive
                    ? 'bg-surface-elevated text-white font-medium border border-surface-border shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
                onClick={() => onSelectConversation(convo.id)}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-6">
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span className="truncate">{convo.title}</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(convo.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 hover:text-red-400 text-slate-500 transition-all absolute right-2"
                  title="Eliminar chat"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })
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
    </aside>
  );
}
