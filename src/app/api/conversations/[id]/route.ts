import { NextResponse } from 'next/server';
import { getConversation, getMessages, updateConversationTitle, deleteConversation } from '@/chat/chat-store';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const convo = getConversation(id);
    if (!convo) {
      return NextResponse.json({ success: false, error: 'Conversación no encontrada' }, { status: 404 });
    }

    const messages = getMessages(id);
    return NextResponse.json({
      success: true,
      conversation: convo,
      messages,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, projectPath, isPinned, modelId, reasoningEffort } = body;

    if (title) {
      updateConversationTitle(id, title);
    }
    if (projectPath !== undefined) {
      const { updateConversationProjectPath } = await import('@/chat/chat-store');
      updateConversationProjectPath(id, projectPath);
    }
    if (isPinned !== undefined) {
      const { togglePinConversation } = await import('@/chat/chat-store');
      togglePinConversation(id, Boolean(isPinned));
    }
    if (modelId !== undefined || reasoningEffort !== undefined) {
      const { updateConversationModelAndEffort } = await import('@/chat/chat-store');
      const current = getConversation(id);
      if (current) {
        updateConversationModelAndEffort(
          id,
          modelId || current.modelId,
          reasoningEffort || current.reasoningEffort
        );
      }
    }

    const updated = getConversation(id);
    return NextResponse.json({ success: true, conversation: updated });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    deleteConversation(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
