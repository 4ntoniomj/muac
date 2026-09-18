import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { generatePKCE, getGoogleAuthUrl } from '@/cuentas/oauth-service';
import { getDatabase } from '@/shared/db';

export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const host = req.headers.get('host') || urlObj.host;
  const protocol = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  const redirectUri = `${protocol}://${host}/api/auth/callback`;

  const { verifier, challenge } = generatePKCE();
  const state = crypto.randomBytes(24).toString('hex');

  // Persistir en tabla temporal oauth_states para resiliencia ante pérdida de cookies
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO oauth_states (state, verifier, created_at)
      VALUES (?, ?, ?)
    `).run(state, verifier, new Date().toISOString());

    // Limpieza de estados viejos de más de 30 minutos
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    db.prepare('DELETE FROM oauth_states WHERE created_at < ?').run(thirtyMinAgo);
  } catch (err) {
    console.error('Error al guardar estado OAuth en DB:', err);
  }

  const authUrl = getGoogleAuthUrl(redirectUri, verifier, state);

  const response = NextResponse.redirect(authUrl);
  // Guardar verifier también en cookie para soporte dual
  response.cookies.set('muac_pkce_verifier', verifier, {
    httpOnly: true,
    secure: protocol === 'https',
    sameSite: 'lax',
    maxAge: 600, // 10 minutos
    path: '/',
  });
  response.cookies.set('muac_pkce_state', state, {
    httpOnly: true,
    secure: protocol === 'https',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return response;
}
