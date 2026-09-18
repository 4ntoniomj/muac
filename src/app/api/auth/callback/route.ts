import { NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/cuentas/oauth-service';
import { createOrUpdateAccount, setActiveAccount } from '@/cuentas/account-store';
import { fetchCurrentQuota } from '@/rotacion/quota-monitor';

export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const code = urlObj.searchParams.get('code');
  const error = urlObj.searchParams.get('error');

  const host = req.headers.get('host') || urlObj.host;
  const protocol = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  const redirectUri = `${protocol}://${host}/api/auth/callback`;

  if (error || !code) {
    console.error('Error o código faltante en callback de OAuth:', error);
    return NextResponse.redirect(`${protocol}://${host}/?auth_error=${encodeURIComponent(error || 'missing_code')}`);
  }

  // Leer verifier de las cookies de la petición
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/muac_pkce_verifier=([^;]+)/);
  const codeVerifier = match ? decodeURIComponent(match[1]) : null;

  if (!codeVerifier) {
    console.error('Verifier PKCE no encontrado en cookies');
    return NextResponse.redirect(`${protocol}://${host}/?auth_error=missing_verifier`);
  }

  try {
    const exchangeResult = await exchangeCodeForTokens(code, codeVerifier, redirectUri);
    const account = createOrUpdateAccount(
      exchangeResult.email,
      exchangeResult.displayName,
      exchangeResult.avatarUrl,
      exchangeResult.storedToken
    );

    // Activar la cuenta vinculada y actualizar Secret Service
    await setActiveAccount(account.id);
    // Extraer cuota real inicial
    await fetchCurrentQuota(account.id);

    const res = NextResponse.redirect(`${protocol}://${host}/?auth_success=true`);
    res.cookies.delete('muac_pkce_verifier');
    return res;
  } catch (err) {
    console.error('Fallo en el callback OAuth:', err);
    return NextResponse.redirect(
      `${protocol}://${host}/?auth_error=${encodeURIComponent((err as Error).message)}`
    );
  }
}
