import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export async function POST(req: Request) {
  try {
    const { path: targetPath } = await req.json();

    if (!targetPath || typeof targetPath !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Ruta no proporcionada',
      }, { status: 400 });
    }

    const resolved = path.resolve(targetPath.trim());

    if (!fs.existsSync(resolved)) {
      return NextResponse.json({
        success: false,
        error: `El directorio «${resolved}» no existe en el sistema de archivos.`,
      }, { status: 404 });
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return NextResponse.json({
        success: false,
        error: `«${resolved}» no es un directorio válido.`,
      }, { status: 400 });
    }

    const entries = fs.readdirSync(resolved);
    const hasGit = entries.includes('.git');
    const hasPackageJson = entries.includes('package.json');

    return NextResponse.json({
      success: true,
      path: resolved,
      name: path.basename(resolved),
      fileCount: entries.length,
      hasGit,
      hasPackageJson,
    });
  } catch (err) {
    console.error('Error al validar workspace:', err);
    return NextResponse.json({
      success: false,
      error: (err as Error).message,
    }, { status: 500 });
  }
}
