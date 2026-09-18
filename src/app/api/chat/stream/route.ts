import { NextResponse } from 'next/server';
import { streamPromptWithAgy } from '@/chat/agy-bridge';
import { saveMessage, getConversation, updateConversationTitle } from '@/chat/chat-store';
import { getActiveAccount } from '@/cuentas/account-store';
import crypto from 'node:crypto';
import path from 'node:path';
import type { Message } from '@/shared/types/chat';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { conversationId, prompt, modelId, accountId, projectPath, reasoningEffort, attachments } = body;

    if (!conversationId || (!prompt && (!attachments || attachments.length === 0))) {
      return NextResponse.json(
        { success: false, error: 'conversationId y prompt o archivos adjuntos requeridos' },
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

    const effectiveModelId = modelId || convo.modelId;
    const effectiveReasoningEffort = reasoningEffort || convo.reasoningEffort || 'high';

    // Persistir modelId y reasoningEffort en la conversación activa
    if (effectiveModelId !== convo.modelId || effectiveReasoningEffort !== convo.reasoningEffort) {
      const { updateConversationModelAndEffort } = await import('@/chat/chat-store');
      updateConversationModelAndEffort(conversationId, effectiveModelId, effectiveReasoningEffort);
    }

    // Si viene projectPath en el request y no en la convo, guardarlo
    const effectiveProjectPath = projectPath || convo.projectPath;
    if (projectPath && projectPath !== convo.projectPath) {
      const { updateConversationProjectPath } = await import('@/chat/chat-store');
      updateConversationProjectPath(conversationId, projectPath);
    }

    const activeAcc = getActiveAccount();
    const { getAccountById } = await import('@/cuentas/account-store');
    const targetAcc = accountId ? getAccountById(accountId) : null;
    const effectiveSenderAcc = targetAcc || activeAcc;

    // 1. Guardar mensaje del usuario con adjuntos
    const userMsg: Message = {
      id: 'msg_' + crypto.randomUUID(),
      conversationId,
      role: 'user',
      content: prompt || (attachments?.length ? `[${attachments.length} archivo(s) adjunto(s)]` : ''),
      createdAt: new Date().toISOString(),
      accountId: effectiveSenderAcc?.id,
      accountEmail: effectiveSenderAcc?.email,
      modelId: effectiveModelId,
      reasoningEffort: effectiveReasoningEffort,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    };
    saveMessage(userMsg);

    // Formatear prompt efectivo para agy con referencias a los archivos adjuntos
    let effectivePrompt = prompt || '';
    if (attachments && attachments.length > 0) {
      const attachDesc = attachments
        .map((att: any) => {
          const lineInfo = att.lineCount ? `, ${att.lineCount} líneas` : '';
          return `[Archivo adjunto: "${att.name}" (${att.type}${lineInfo}), ruta local accesible: ${att.path || att.url}]`;
        })
        .join('\n');
      effectivePrompt = effectivePrompt ? `${attachDesc}\n\n${effectivePrompt}` : attachDesc;
    }

    // Auto-titulado si es el primer mensaje
    if (convo.title === 'Nueva conversación') {
      const titleSource = prompt || (attachments?.[0]?.name ? `Archivo: ${attachments[0].name}` : 'Conversación');
      const autoTitle = titleSource.slice(0, 35) + (titleSource.length > 35 ? '...' : '');
      updateConversationTitle(conversationId, autoTitle);
    }

    // 2. Iniciar streaming con SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let assistantContent = '';
        let finalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        let duration = 0;
        let responderAccountId = effectiveSenderAcc?.id;
        let responderAccountEmail = effectiveSenderAcc?.email;

        try {
          for await (const event of streamPromptWithAgy(
            effectivePrompt,
            effectiveModelId,
            conversationId,
            accountId,
            {
              projectPath: effectiveProjectPath,
              reasoningEffort: effectiveReasoningEffort,
            }
          )) {
            if (event.type === 'delta' && event.text) {
              assistantContent += event.text;
            }
            if (event.type === 'rotated' && event.rotationInfo) {
              responderAccountEmail = event.rotationInfo.toEmail;
            }
            if (event.type === 'done') {
              if (event.usage) finalUsage = event.usage;
              if (event.durationSeconds) duration = event.durationSeconds;
              if (event.effectiveAccountId) responderAccountId = event.effectiveAccountId;
              if (event.effectiveAccountEmail) responderAccountEmail = event.effectiveAccountEmail;
            }

            const payload = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(payload));
          }

          // Guardar mensaje final del asistente
          if (assistantContent.trim().length > 0) {
            // Detección de posibles archivos/fotos/videos generados por el asistente
            const assistantAttachments: any[] = [];
            const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
            let imgMatch;
            while ((imgMatch = imgRegex.exec(assistantContent)) !== null) {
              const url = imgMatch[2];
              assistantAttachments.push({
                id: 'att_' + crypto.randomUUID(),
                name: imgMatch[1] || path.basename(url) || 'imagen',
                type: 'image',
                mimeType: 'image/png',
                size: 0,
                url,
                path: url.startsWith('/') ? url : undefined,
              });
            }

            const assistantMsg: Message = {
              id: 'msg_' + crypto.randomUUID(),
              conversationId,
              role: 'assistant',
              content: assistantContent,
              createdAt: new Date().toISOString(),
              durationSeconds: duration,
              usage: finalUsage,
              accountId: responderAccountId,
              accountEmail: responderAccountEmail,
              modelId: effectiveModelId,
              reasoningEffort: effectiveReasoningEffort,
              attachments: assistantAttachments.length > 0 ? assistantAttachments : undefined,
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
