import { NextResponse } from 'next/server';
import { getGlobalSettings, updateGlobalSettings } from '@/configuracion/settings-store';

export async function GET() {
  try {
    const settings = getGlobalSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const updated = updateGlobalSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
