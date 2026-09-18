import { NextResponse } from 'next/server';
import { getAccountById, getActiveAccount } from '@/cuentas/account-store';
import { syncStoredTokenToSystem } from '@/cuentas/keyring-sync';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get('accountId');

    if (!accountId) {
      return new Response('accountId es requerido', { status: 400 });
    }

    const target = getAccountById(accountId);
    if (!target) {
      return new Response('Cuenta no encontrada', { status: 404 });
    }

    const currentActive = getActiveAccount();
    let googleRedirectUrl = `https://accounts.google.com/AccountChooser?Email=${encodeURIComponent(
      target.email
    )}&continue=https://developers.google.com/gemini-code-assist/auth/auth_success_gemini`;

    try {
      // Sincronizar temporalmente el token de la cuenta a verificar
      await syncStoredTokenToSystem(target.storedToken);

      let stdout = '';
      let stderr = '';
      try {
        const res = await execFileAsync('agy', ['--print', '/usage', '--output-format', 'json'], {
          timeout: 10000,
        });
        stdout = res.stdout;
      } catch (err: unknown) {
        const procErr = err as { stdout?: string; stderr?: string; message?: string };
        stdout = procErr.stdout || '';
        stderr = procErr.stderr || procErr.message || '';
      }

      const combined = stdout + '\n' + stderr;
      const match = combined.match(/https:\/\/(?:accounts\.google\.com|developers\.google\.com)[^\s"'<>]+/);
      if (match) {
        let extracted = match[0].replace(/\\u0026/g, '&');
        if (!extracted.includes('Email=') && !extracted.includes('authuser=')) {
          extracted += `&Email=${encodeURIComponent(target.email)}`;
        }
        googleRedirectUrl = extracted;
      }
    } finally {
      // Restaurar siempre la cuenta activa previa en el Secret Service
      if (currentActive && currentActive.id !== target.id) {
        await syncStoredTokenToSystem(currentActive.storedToken);
      }
    }

    // Redirigir de inmediato al usuario a la página de Google
    return NextResponse.redirect(googleRedirectUrl, { status: 307 });
  } catch (err) {
    console.error('Error en /api/auth/verify:', err);
    return new Response(`Error al procesar la verificación: ${(err as Error).message}`, { status: 500 });
  }
}
