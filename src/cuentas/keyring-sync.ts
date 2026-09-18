import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { StoredToken } from '@/shared/types/account';

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.resolve(process.cwd(), 'src/cuentas/scripts/keyring_bridge.py');

export async function getCurrentSystemStoredToken(): Promise<StoredToken | null> {
  try {
    const { stdout } = await execFileAsync('python3', [SCRIPT_PATH, 'read']);
    const res = JSON.parse(stdout);
    if (res.success && res.data) {
      return res.data as StoredToken;
    }
    return null;
  } catch (error) {
    console.error('Error leyendo token de Secret Service:', error);
    return null;
  }
}

export async function syncStoredTokenToSystem(storedToken: StoredToken): Promise<boolean> {
  try {
    const tokenStr = JSON.stringify(storedToken);
    const { stdout } = await execFileAsync('python3', [SCRIPT_PATH, 'write', tokenStr]);
    const res = JSON.parse(stdout);
    return !!res.success;
  } catch (error) {
    console.error('Error escribiendo token en Secret Service:', error);
    return false;
  }
}
