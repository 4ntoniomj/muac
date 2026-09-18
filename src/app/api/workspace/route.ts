import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { validateSafeWorkspacePath } from '@/shared/path-security';

export async function POST(req: Request) {
  try {
    const { path: targetPath } = await req.json();

    const validation = validateSafeWorkspacePath(targetPath);
    if (!validation.valid || !validation.resolvedPath) {
      return NextResponse.json({
        success: false,
        error: validation.error || 'Ruta no válida',
      }, { status: 400 });
    }

    const resolved = validation.resolvedPath;

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
