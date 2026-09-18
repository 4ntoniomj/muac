import { NextResponse } from 'next/server';
import { listConversations, createConversation } from '@/chat/chat-store';

export async function GET() {
  try {
    const convos = listConversations();
    return NextResponse.json({ success: true, conversations: convos });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, ids, isPinned, title, modelId, projectPath } = body;

    if (action === 'bulk_delete' && Array.isArray(ids)) {
      const { bulkDeleteConversations } = await import('@/chat/chat-store');
      bulkDeleteConversations(ids);
      return NextResponse.json({ success: true, count: ids.length });
    }

    if (action === 'bulk_pin' && Array.isArray(ids)) {
      const { bulkPinConversations } = await import('@/chat/chat-store');
      bulkPinConversations(ids, isPinned ?? true);
      return NextResponse.json({ success: true, count: ids.length });
    }

    if (action === 'bulk_unpin' && Array.isArray(ids)) {
      const { bulkPinConversations } = await import('@/chat/chat-store');
      bulkPinConversations(ids, false);
      return NextResponse.json({ success: true, count: ids.length });
    }

    const convo = createConversation(title, modelId, projectPath);
    return NextResponse.json({ success: true, conversation: convo });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
