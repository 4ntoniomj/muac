import { NextResponse } from 'next/server';
import { syncAntigravityConversations, getAntigravityBrainDirs } from '@/chat/antigravity-sync';
import fs from 'node:fs';

export async function POST() {
  try {
    const result = await syncAntigravityConversations();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error en POST /api/conversations/sync:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const brainDirs = getAntigravityBrainDirs();
    let totalConversations = 0;

    for (const d of brainDirs) {
      if (fs.existsSync(/*turbopackIgnore: true*/ d)) {
        totalConversations += fs.readdirSync(/*turbopackIgnore: true*/ d).length;
      }
    }

    return NextResponse.json({
      success: true,
      availableDirs: brainDirs,
      totalAntigravityConversations: totalConversations,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
