import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { validateSafeWorkspacePath } from '@/shared/path-security';

export interface FileItemInfo {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  extension: string;
  modifiedAt: string;
  isHidden: boolean;
}

function isPathInside(parent: string, target: string): boolean {
  const relative = path.relative(parent, target);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

// GET: Listar archivos y carpetas del workspace o de un subdirectorio
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const workspacePath = url.searchParams.get('path');
    const subPath = url.searchParams.get('subPath') || '';
    const showHidden = url.searchParams.get('showHidden') === 'true';

    if (!workspacePath) {
      return NextResponse.json({ success: false, error: 'Falta la ruta del workspace' }, { status: 400 });
    }

    const validation = validateSafeWorkspacePath(workspacePath);
    if (!validation.valid || !validation.resolvedPath) {
      return NextResponse.json({ success: false, error: validation.error || 'Ruta de workspace inválida' }, { status: 400 });
    }

    const resolvedWorkspace = validation.resolvedPath;
    const targetDir = subPath ? path.resolve(resolvedWorkspace, subPath) : resolvedWorkspace;

    if (targetDir !== resolvedWorkspace && !isPathInside(resolvedWorkspace, targetDir)) {
      return NextResponse.json({ success: false, error: 'Acceso denegado: fuera del workspace' }, { status: 403 });
    }

    if (!fs.existsSync(targetDir)) {
      return NextResponse.json({ success: false, error: 'Directorio no encontrado' }, { status: 404 });
    }

    const dirEntries = fs.readdirSync(targetDir, { withFileTypes: true });
    const items: FileItemInfo[] = [];

    for (const entry of dirEntries) {
      const isHidden = entry.name.startsWith('.');
      if (!showHidden && isHidden) {
        continue;
      }

      const fullPath = path.join(targetDir, entry.name);
      const relPath = path.relative(resolvedWorkspace, fullPath);
      let size = 0;
      let modifiedAt = new Date().toISOString();

      try {
        const stat = fs.statSync(fullPath);
        size = stat.size;
        modifiedAt = stat.mtime.toISOString();
      } catch {
        // En caso de archivos con permisos restringidos o enlaces rotos
      }

      const ext = entry.isDirectory() ? '' : path.extname(entry.name).toLowerCase().replace('.', '');

      items.push({
        name: entry.name,
        path: fullPath,
        relativePath: relPath,
        isDirectory: entry.isDirectory(),
        size,
        extension: ext,
        modifiedAt,
        isHidden,
      });
    }

    // Ordenar: primero directorios alfabéticamente, luego archivos alfabéticamente
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    return NextResponse.json({
      success: true,
      workspaceName: path.basename(resolvedWorkspace),
      workspacePath: resolvedWorkspace,
      currentSubPath: subPath,
      items,
    });
  } catch (err) {
    console.error('Error al listar archivos del workspace:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

// POST: Crear archivo o directorio nuevo
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspacePath, targetDir = '', name, type } = body;

    if (!workspacePath || !name || !type) {
      return NextResponse.json({ success: false, error: 'Parámetros incompletos' }, { status: 400 });
    }

    const validation = validateSafeWorkspacePath(workspacePath);
    if (!validation.valid || !validation.resolvedPath) {
      return NextResponse.json({ success: false, error: validation.error || 'Ruta inválida' }, { status: 400 });
    }

    const baseDir = targetDir ? path.resolve(validation.resolvedPath, targetDir) : validation.resolvedPath;
    if (baseDir !== validation.resolvedPath && !isPathInside(validation.resolvedPath, baseDir)) {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 });
    }

    const newPath = path.join(baseDir, name.trim());
    if (!isPathInside(validation.resolvedPath, newPath)) {
      return NextResponse.json({ success: false, error: 'Nombre o ruta inválida' }, { status: 400 });
    }

    if (fs.existsSync(newPath)) {
      return NextResponse.json({ success: false, error: 'Ya existe un elemento con ese nombre' }, { status: 409 });
    }

    if (type === 'directory') {
      fs.mkdirSync(newPath, { recursive: true });
    } else {
      // Crear archivo vacío
      fs.writeFileSync(newPath, '', 'utf-8');
    }

    return NextResponse.json({
      success: true,
      name: path.basename(newPath),
      path: newPath,
      relativePath: path.relative(validation.resolvedPath, newPath),
      isDirectory: type === 'directory',
    });
  } catch (err) {
    console.error('Error al crear elemento:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

// PUT: Renombrar archivo o directorio
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { workspacePath, oldPath, newName } = body;

    if (!workspacePath || !oldPath || !newName) {
      return NextResponse.json({ success: false, error: 'Parámetros incompletos' }, { status: 400 });
    }

    const validation = validateSafeWorkspacePath(workspacePath);
    if (!validation.valid || !validation.resolvedPath) {
      return NextResponse.json({ success: false, error: validation.error || 'Ruta inválida' }, { status: 400 });
    }

    const resolvedOld = path.isAbsolute(oldPath)
      ? path.resolve(oldPath)
      : path.resolve(validation.resolvedPath, oldPath);

    if (resolvedOld === validation.resolvedPath || !isPathInside(validation.resolvedPath, resolvedOld)) {
      return NextResponse.json({ success: false, error: 'No está permitido modificar la raíz del workspace' }, { status: 403 });
    }

    if (!fs.existsSync(resolvedOld)) {
      return NextResponse.json({ success: false, error: 'El elemento origen no existe' }, { status: 404 });
    }

    const parentDir = path.dirname(resolvedOld);
    const resolvedNew = path.join(parentDir, newName.trim());

    if (!isPathInside(validation.resolvedPath, resolvedNew)) {
      return NextResponse.json({ success: false, error: 'Nuevo nombre inválido' }, { status: 400 });
    }

    if (fs.existsSync(resolvedNew)) {
      return NextResponse.json({ success: false, error: 'Ya existe un elemento con el nuevo nombre' }, { status: 409 });
    }

    fs.renameSync(resolvedOld, resolvedNew);

    return NextResponse.json({
      success: true,
      oldPath: resolvedOld,
      newPath: resolvedNew,
      relativePath: path.relative(validation.resolvedPath, resolvedNew),
    });
  } catch (err) {
    console.error('Error al renombrar elemento:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

// DELETE: Eliminar archivo o directorio
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    let workspacePath = url.searchParams.get('workspacePath');
    let targetPath = url.searchParams.get('targetPath');

    if (!workspacePath || !targetPath) {
      const body = await req.json().catch(() => ({}));
      workspacePath = workspacePath || body.workspacePath;
      targetPath = targetPath || body.targetPath;
    }

    if (!workspacePath || !targetPath) {
      return NextResponse.json({ success: false, error: 'Faltan parámetros workspacePath y targetPath' }, { status: 400 });
    }

    const validation = validateSafeWorkspacePath(workspacePath);
    if (!validation.valid || !validation.resolvedPath) {
      return NextResponse.json({ success: false, error: validation.error || 'Ruta inválida' }, { status: 400 });
    }

    const resolvedTarget = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(validation.resolvedPath, targetPath);

    if (resolvedTarget === validation.resolvedPath || !isPathInside(validation.resolvedPath, resolvedTarget)) {
      return NextResponse.json({ success: false, error: 'No se puede eliminar la raíz del workspace' }, { status: 403 });
    }

    if (!fs.existsSync(resolvedTarget)) {
      return NextResponse.json({ success: true, message: 'El elemento ya no existe' });
    }

    fs.rmSync(resolvedTarget, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      deletedPath: resolvedTarget,
    });
  } catch (err) {
    console.error('Error al eliminar elemento:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
