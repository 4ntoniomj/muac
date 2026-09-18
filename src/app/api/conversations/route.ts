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
    const { title, modelId, projectPath } = body;
    const convo = createConversation(title, modelId, projectPath);
    return NextResponse.json({ success: true, conversation: convo });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
