import crypto from 'node:crypto';
import type { StoredToken } from '@/shared/types/account';

export const GOOGLE_CLIENT_ID = 'mock_client_id.apps.googleusercontent.com';
export const GOOGLE_CLIENT_SECRET = 'mock_client_secret';
export const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cloud-platform',
].join(' ');

export interface PKCEPair {
  verifier: string;
  challenge: string;
}

export function generatePKCE(): PKCEPair {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

export function getGoogleAuthUrl(redirectUri: string, verifier: string, state?: string): string {
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    // prompt=select_account es la clave técnica esencial para obligar a Google
    // a mostrar el selector de cuentas ("Elige una cuenta / Usar otra cuenta")
    // y no heredar pasivamente la sesión de la primera cuenta ya logueada.
    prompt: 'select_account',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  if (state) {
    params.set('state', state);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface TokenExchangeResult {
  storedToken: StoredToken;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<TokenExchangeResult> {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Fallo en el intercambio de tokens de Google (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const expiresInSeconds = data.expires_in || 3600;
  const expiryDate = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  const storedToken: StoredToken = {
    token: {
      access_token: data.access_token,
      token_type: data.token_type || 'Bearer',
      refresh_token: data.refresh_token,
      expiry: expiryDate,
    },
    auth_method: 'consumer',
    id_token: data.id_token,
  };

  let email = 'usuario@gmail.com';
  let displayName = 'Usuario Google';
  let avatarUrl: string | undefined = undefined;

  if (data.id_token) {
    try {
      const parts = data.id_token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        if (payload.email) email = payload.email;
        if (payload.name) displayName = payload.name;
        if (payload.picture) avatarUrl = payload.picture;
      }
    } catch {
      // Usar defaults si no se puede decodificar
    }
  }

  return {
    storedToken,
    email,
    displayName,
    avatarUrl,
  };
}
