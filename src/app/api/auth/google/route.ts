import { NextResponse } from 'next/server';
import { generatePKCE, getGoogleAuthUrl } from '@/cuentas/oauth-service';

export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const host = req.headers.get('host') || urlObj.host;
  const protocol = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  const redirectUri = `${protocol}://${host}/api/auth/callback`;

  const { verifier, challenge } = generatePKCE();
  const authUrl = getGoogleAuthUrl(redirectUri, verifier);

  const response = NextResponse.redirect(authUrl);
  // Guardar verifier en cookie segura y temporal para el intercambio
  response.cookies.set('muac_pkce_verifier', verifier, {
    httpOnly: true,
    secure: protocol === 'https',
    sameSite: 'lax',
    maxAge: 600, // 10 minutos
    path: '/',
  });

  return response;
}
