import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';

const execFileAsync = promisify(execFile);

export async function POST() {
  try {
    // Comprobar existencia de zenity en el sistema
    const zenityPath = fs.existsSync('/usr/bin/zenity') ? '/usr/bin/zenity' : 'zenity';

    const { stdout } = await execFileAsync(
      zenityPath,
      ['--file-selection', '--directory', '--title=Seleccionar Workspace de Trabajo en muac'],
      { env: process.env }
    );

    const selectedPath = stdout.trim();
    if (selectedPath) {
      return NextResponse.json({
        success: true,
        path: selectedPath,
      });
    }

    return NextResponse.json({ success: false, cancelled: true });
  } catch (err: unknown) {
    const error = err as { code?: number; stderr?: string };
    // Zenity retorna código 1 si el usuario cancela o cierra la ventana de selección
    if (error.code === 1) {
      return NextResponse.json({ success: false, cancelled: true });
    }

    console.error('Error al ejecutar zenity:', err);
    return NextResponse.json(
      {
        success: false,
        error: error.stderr || (err as Error).message || 'Error al abrir el gestor de archivos',
      },
      { status: 500 }
    );
  }
}
