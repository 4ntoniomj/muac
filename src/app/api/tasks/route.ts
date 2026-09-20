import { NextResponse } from 'next/server';
import {
  listScheduledTasks,
  createScheduledTask,
  toggleScheduledTask,
  deleteScheduledTask,
  executeScheduledTaskNow,
} from '@/chat/task-store';

export async function GET() {
  try {
    const tasks = listScheduledTasks();
    return NextResponse.json({ success: true, tasks });
  } catch (err) {
    console.error('Error al listar tareas programadas:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, id, name, prompt, scheduleType, scheduleValue, modelId, projectPath, isEnabled } = body;

    // Ejecutar tarea inmediatamente
    if (action === 'run_now') {
      if (!id) {
        return NextResponse.json({ success: false, error: 'Falta el ID de la tarea' }, { status: 400 });
      }
      const updated = await executeScheduledTaskNow(id);
      return NextResponse.json({ success: true, task: updated });
    }

    // Activar o pausar tarea
    if (action === 'toggle') {
      if (!id || typeof isEnabled !== 'boolean') {
        return NextResponse.json({ success: false, error: 'Parámetros inválidos para toggle' }, { status: 400 });
      }
      const updated = toggleScheduledTask(id, isEnabled);
      return NextResponse.json({ success: true, task: updated });
    }

    // Crear nueva tarea programada
    if (!name || !prompt) {
      return NextResponse.json({ success: false, error: 'Nombre y prompt requeridos' }, { status: 400 });
    }

    const newTask = createScheduledTask({
      name,
      prompt,
      scheduleType,
      scheduleValue: scheduleValue || '1h',
      modelId,
      projectPath,
    });

    return NextResponse.json({ success: true, task: newTask });
  } catch (err) {
    console.error('Error al gestionar tarea programada:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    let id = url.searchParams.get('id');

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Falta el ID de la tarea a eliminar' }, { status: 400 });
    }

    const deleted = deleteScheduledTask(id);
    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    console.error('Error al eliminar tarea:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
