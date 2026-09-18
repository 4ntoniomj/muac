import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';

const execFileAsync = promisify(execFile);

async function pickFolderLinux(): Promise<string | null> {
  const hasZenity = fs.existsSync('/usr/bin/zenity');
  const zenityBin = hasZenity ? '/usr/bin/zenity' : 'zenity';

  try {
    const { stdout } = await execFileAsync(
      zenityBin,
      ['--file-selection', '--directory', '--title=Seleccionar Workspace de Trabajo en muac'],
      { env: process.env }
    );
    return stdout.trim() || null;
  } catch (err: unknown) {
    const error = err as { code?: number | string };
    if (error.code === 1) {
      // Cancelado por el usuario
      return null;
    }

    // Fallback a kdialog si zenity no está disponible o falla
    const hasKdialog = fs.existsSync('/usr/bin/kdialog');
    const kdialogBin = hasKdialog ? '/usr/bin/kdialog' : 'kdialog';
    try {
      const { stdout } = await execFileAsync(
        kdialogBin,
        ['--getexistingdirectory', process.cwd(), '--title', 'Seleccionar Workspace de Trabajo en muac'],
        { env: process.env }
      );
      return stdout.trim() || null;
    } catch (kErr: unknown) {
      const kError = kErr as { code?: number | string };
      if (kError.code === 1) return null;
      throw err; // Relanzar el error original de zenity
    }
  }
}

async function pickFolderMacOS(): Promise<string | null> {
  try {
    const script = 'POSIX path of (choose folder with prompt "Selecciona la carpeta de trabajo")';
    const { stdout } = await execFileAsync('osascript', ['-e', script], { env: process.env });
    return stdout.trim() || null;
  } catch (err: unknown) {
    const error = err as { code?: number; stderr?: string };
    if (error.code === 1 || (error.stderr && error.stderr.includes('User canceled'))) {
      return null;
    }
    throw err;
  }
}

async function pickFolderWindows(): Promise<string | null> {
  try {
    const command = 'Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; if($d.ShowDialog() -eq "OK"){ $d.SelectedPath }';
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', command], { env: process.env });
    return stdout.trim() || null;
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error.code === 1) return null;
    throw err;
  }
}

export async function POST() {
  try {
    const platform = process.platform;
    let selectedPath: string | null = null;

    if (platform === 'linux') {
      selectedPath = await pickFolderLinux();
    } else if (platform === 'darwin') {
      selectedPath = await pickFolderMacOS();
    } else if (platform === 'win32') {
      selectedPath = await pickFolderWindows();
    } else {
      // Fallback genérico para otros entornos
      selectedPath = await pickFolderLinux();
    }

    if (selectedPath) {
      return NextResponse.json({
        success: true,
        path: selectedPath,
      });
    }

    return NextResponse.json({ success: false, cancelled: true });
  } catch (err: unknown) {
    const error = err as { code?: number; stderr?: string };
    console.error('Error al ejecutar selector nativo de carpetas:', err);
    return NextResponse.json(
      {
        success: false,
        error: error.stderr || (err as Error).message || 'Error al abrir el gestor de archivos',
      },
      { status: 500 }
    );
  }
}
