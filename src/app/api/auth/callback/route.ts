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

  const state = urlObj.searchParams.get('state');

  // Leer verifier de las cookies o de la tabla oauth_states
  let codeVerifier: string | null = null;
  const cookieHeader = req.headers.get('cookie') || '';
  const matchVerifier = cookieHeader.match(/muac_pkce_verifier=([^;]+)/);
  if (matchVerifier) {
    codeVerifier = decodeURIComponent(matchVerifier[1]);
  }

  // Fallback si la cookie no llegó: buscar por state en base de datos
  if (!codeVerifier && state) {
    try {
      const { getDatabase } = await import('@/shared/db');
      const db = getDatabase();
      const row = db.prepare('SELECT verifier FROM oauth_states WHERE state = ?').get(state) as { verifier: string } | undefined;
      if (row && row.verifier) {
        codeVerifier = row.verifier;
        db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
      }
    } catch (dbErr) {
      console.error('Error consultando oauth_states en DB:', dbErr);
    }
  }

  if (!codeVerifier) {
    console.error('Verifier PKCE no encontrado en cookies ni en base de datos');
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

    const res = NextResponse.redirect(`${protocol}://${host}/?auth_success=true&email=${encodeURIComponent(account.email)}`);
    res.cookies.delete('muac_pkce_verifier');
    res.cookies.delete('muac_pkce_state');
    return res;
  } catch (err) {
    console.error('Fallo en el callback OAuth:', err);
    return NextResponse.redirect(
      `${protocol}://${host}/?auth_error=${encodeURIComponent((err as Error).message)}`
    );
  }
}
