import { NextResponse } from 'next/server';
import { streamPromptWithAgy } from '@/chat/agy-bridge';
import { saveMessage, getConversation, updateConversationTitle } from '@/chat/chat-store';
import { getActiveAccount } from '@/cuentas/account-store';
import crypto from 'node:crypto';
import type { Message } from '@/shared/types/chat';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { conversationId, prompt, modelId, accountId, projectPath } = body;

    if (!conversationId || !prompt) {
      return NextResponse.json(
        { success: false, error: 'conversationId y prompt requeridos' },
        { status: 400 }
      );
    }

    const convo = getConversation(conversationId);
    if (!convo) {
      return NextResponse.json(
        { success: false, error: 'Conversación no encontrada' },
        { status: 404 }
      );
    }

    // Si viene projectPath en el request y no en la convo, guardarlo
    const effectiveProjectPath = projectPath || convo.projectPath;
    if (projectPath && projectPath !== convo.projectPath) {
      const { updateConversationProjectPath } = await import('@/chat/chat-store');
      updateConversationProjectPath(conversationId, projectPath);
    }

    const activeAcc = getActiveAccount();

    // 1. Guardar mensaje del usuario
    const userMsg: Message = {
      id: 'msg_' + crypto.randomUUID(),
      conversationId,
      role: 'user',
      content: prompt,
      createdAt: new Date().toISOString(),
      accountId: activeAcc?.id,
      accountEmail: activeAcc?.email,
      modelId: modelId || convo.modelId,
    };
    saveMessage(userMsg);

    // Auto-titulado si es el primer mensaje
    if (convo.title === 'Nueva conversación') {
      const autoTitle = prompt.slice(0, 35) + (prompt.length > 35 ? '...' : '');
      updateConversationTitle(conversationId, autoTitle);
    }

    // 2. Iniciar streaming con SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let assistantContent = '';
        let finalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        let duration = 0;

        try {
          for await (const event of streamPromptWithAgy(
            prompt,
            modelId || convo.modelId,
            conversationId,
            accountId,
            { projectPath: effectiveProjectPath }
          )) {
            if (event.type === 'delta' && event.text) {
              assistantContent += event.text;
            }
            if (event.type === 'done') {
              if (event.usage) finalUsage = event.usage;
              if (event.durationSeconds) duration = event.durationSeconds;
            }

            const payload = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(payload));
          }

          // Guardar mensaje final del asistente
          if (assistantContent.trim().length > 0) {
            const assistantMsg: Message = {
              id: 'msg_' + crypto.randomUUID(),
              conversationId,
              role: 'assistant',
              content: assistantContent,
              createdAt: new Date().toISOString(),
              durationSeconds: duration,
              usage: finalUsage,
              accountId: activeAcc?.id,
              accountEmail: activeAcc?.email,
              modelId: modelId || convo.modelId,
            };
            saveMessage(assistantMsg);
          }

          controller.close();
        } catch (streamErr) {
          console.error('Error durante el stream:', streamErr);
          const errPayload = `data: ${JSON.stringify({
            type: 'error',
            error: (streamErr as Error).message || 'Error de streaming',
          })}\n\n`;
          controller.enqueue(encoder.encode(errPayload));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Error en POST /api/chat/stream:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
