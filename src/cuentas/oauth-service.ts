import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { StoredToken } from '@/shared/types/account';
import { getGlobalSettings } from '@/configuracion/settings-store';

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
export const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cloud-platform',
].join(' ');

export interface GoogleCredentials {
  clientId: string;
  clientSecret?: string;
  source: 'env' | 'settings' | 'file' | 'none';
}

function cleanCredentialString(str?: string): string {
  if (!str) return '';
  return str.trim().replace(/^["']|["']$/g, '');
}

/**
 * Resuelve de forma inteligente las credenciales de Google OAuth:
 * 1. Variables de entorno (.env)
 * 2. Ajustes persistidos en la base de datos (settings_store)
 * 3. Archivos descargados de Google Cloud Console (client_secret*.json, credentials.json)
 */
export function resolveGoogleOAuthCredentials(): GoogleCredentials {
  const envClientId = cleanCredentialString(process.env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID);
  const envClientSecret = cleanCredentialString(process.env.GOOGLE_CLIENT_SECRET || GOOGLE_CLIENT_SECRET);
  if (envClientId) {
    return {
      clientId: envClientId,
      clientSecret: envClientSecret || undefined,
      source: 'env',
    };
  }

  try {
    const settings = getGlobalSettings();
    const settingsClientId = cleanCredentialString(settings.googleClientId);
    const settingsClientSecret = cleanCredentialString(settings.googleClientSecret);
    if (settingsClientId) {
      return {
        clientId: settingsClientId,
        clientSecret: settingsClientSecret || undefined,
        source: 'settings',
      };
    }
  } catch {}

  try {
    const rootDir = process.cwd();
    const files = fs.readdirSync(/*turbopackIgnore: true*/ rootDir);
    const secretFile = files.find((f) =>
      (f.startsWith('client_secret') && f.endsWith('.json')) ||
      f === 'credentials.json' ||
      f === 'client_secrets.json'
    );
    if (secretFile) {
      const content = fs.readFileSync(path.join(/*turbopackIgnore: true*/ rootDir, secretFile), 'utf-8');
      const parsed = JSON.parse(content);
      const creds = parsed.web || parsed.installed;
      if (creds && creds.client_id) {
        return {
          clientId: cleanCredentialString(creds.client_id),
          clientSecret: cleanCredentialString(creds.client_secret) || undefined,
          source: 'file',
        };
      }
    }
  } catch {}

  return { clientId: '', clientSecret: undefined, source: 'none' };
}

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
  const { clientId } = resolveGoogleOAuthCredentials();
  if (!clientId) {
    throw new Error('Falta configurar GOOGLE_CLIENT_ID en .env, ajustes o archivo de credenciales de Google.');
  }

  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
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
  const { clientId, clientSecret } = resolveGoogleOAuthCredentials();
  if (!clientId) {
    throw new Error('Falta configurar GOOGLE_CLIENT_ID en las variables de entorno, ajustes o archivo JSON.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  // Solo adjuntar client_secret si está disponible y no vacío
  // (clientes confidenciales). En clientes de escritorio con PKCE, se omite.
  if (clientSecret) {
    params.set('client_secret', clientSecret);
  }

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
