import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Attachment } from '@/shared/types/chat';

const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true, mode: 0o700 });
  } else {
    try {
      fs.chmodSync(UPLOADS_DIR, 0o700);
    } catch {
      // Ignorar en sistemas no POSIX
    }
  }
}

function determineFileType(fileName: string, mimeType: string): 'image' | 'video' | 'file' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  const ext = path.extname(fileName).toLowerCase().replace(/^\./, '');
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(ext)) return 'video';
  return 'file';
}

export async function POST(req: Request) {
  try {
    ensureUploadsDir();

    const contentType = req.headers.get('content-type') || '';

    // Soporte para envío directo de texto largo (> 35 líneas) o JSON
    if (contentType.includes('application/json')) {
      const { text, filename } = await req.json();
      if (!text) {
        return NextResponse.json({ success: false, error: 'Texto no proporcionado' }, { status: 400 });
      }

      const lines = text.split('\n');
      const safeName = (filename || 'texto_adjunto.txt').replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeName}`;
      const filePath = path.join(UPLOADS_DIR, uniqueName);

      fs.writeFileSync(filePath, text, { encoding: 'utf-8', mode: 0o600 });
      const stats = fs.statSync(filePath);

      const attachment: Attachment = {
        id: 'att_' + crypto.randomUUID(),
        name: safeName,
        type: 'file',
        mimeType: 'text/plain',
        size: stats.size,
        url: `/api/files/serve?file=${encodeURIComponent(uniqueName)}`,
        path: filePath,
        lineCount: lines.length,
      };

      return NextResponse.json({ success: true, attachment });
    }

    // Soporte para FormData (archivos, imágenes, videos)
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const singleFile = formData.get('file') as File | null;

    const filesToProcess: File[] = [];
    if (singleFile) filesToProcess.push(singleFile);
    if (files && files.length > 0) {
      for (const f of files) {
        if (!filesToProcess.includes(f)) filesToProcess.push(f);
      }
    }

    if (filesToProcess.length === 0) {
      return NextResponse.json({ success: false, error: 'No se enviaron archivos' }, { status: 400 });
    }

    const attachments: Attachment[] = [];

    for (const file of filesToProcess) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const originalName = file.name || 'archivo';
      const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeName}`;
      const filePath = path.join(UPLOADS_DIR, uniqueName);

      fs.writeFileSync(filePath, buffer, { mode: 0o600 });
      const stats = fs.statSync(filePath);
      const mimeType = file.type || 'application/octet-stream';
      const type = determineFileType(originalName, mimeType);

      let lineCount: number | undefined = undefined;
      if (type === 'file' || mimeType.startsWith('text/')) {
        try {
          const textContent = buffer.toString('utf-8');
          lineCount = textContent.split('\n').length;
        } catch {
          // Si es binario no calculamos líneas
        }
      }

      attachments.push({
        id: 'att_' + crypto.randomUUID(),
        name: originalName,
        type,
        mimeType,
        size: stats.size,
        url: `/api/files/serve?file=${encodeURIComponent(uniqueName)}`,
        path: filePath,
        lineCount,
      });
    }

    return NextResponse.json({
      success: true,
      attachment: attachments[0],
      attachments,
    });
  } catch (err) {
    console.error('Error al subir archivo:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
