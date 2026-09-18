import { NextResponse } from 'next/server';
import { listProjects, createProject } from '@/chat/project-store';

export async function GET() {
  try {
    const projects = listProjects();
    return NextResponse.json({ success: true, projects });
  } catch (err) {
    console.error('Error al listar proyectos:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, path } = await req.json();
    if (!name || !path) {
      return NextResponse.json({ success: false, error: 'name y path requeridos' }, { status: 400 });
    }
    const project = createProject(name, path);
    return NextResponse.json({ success: true, project });
  } catch (err) {
    console.error('Error al crear proyecto:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
