import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads');

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  weba: 'audio/webm',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  json: 'application/json',
  ts: 'text/plain; charset=utf-8',
  js: 'application/javascript',
  py: 'text/plain; charset=utf-8',
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fileName = url.searchParams.get('file');

    if (!fileName) {
      return new Response('Archivo no especificado', { status: 400 });
    }

    // Prevención de Path Traversal
    const safeTarget = path.basename(fileName);
    const fullPath = path.resolve(UPLOADS_DIR, safeTarget);

    if (!fullPath.startsWith(UPLOADS_DIR) || !fs.existsSync(fullPath)) {
      return new Response('Archivo no encontrado', { status: 404 });
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      return new Response('Ruta no válida', { status: 400 });
    }

    const ext = path.extname(safeTarget).toLowerCase().replace(/^\./, '');
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const fileStream = fs.createReadStream(fullPath);
    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': `inline; filename="${encodeURIComponent(safeTarget)}"`,
      },
    });
  } catch (err) {
    console.error('Error al servir archivo:', err);
    return new Response('Error interno al servir archivo', { status: 500 });
  }
}
