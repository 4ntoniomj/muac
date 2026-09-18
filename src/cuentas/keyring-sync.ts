import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { StoredToken } from '@/shared/types/account';

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.resolve(process.cwd(), 'src/cuentas/scripts/keyring_bridge.py');

function getPythonBinary(): string {
  return process.platform === 'win32' ? 'python' : 'python3';
}

export async function getCurrentSystemStoredToken(): Promise<StoredToken | null> {
  try {
    const { stdout } = await execFileAsync(getPythonBinary(), [SCRIPT_PATH, 'read']);
    const res = JSON.parse(stdout);
    if (res.success && res.data) {
      return res.data as StoredToken;
    }
    return null;
  } catch (error) {
    console.error('Error leyendo token del almacén seguro:', error);
    return null;
  }
}

export async function syncStoredTokenToSystem(storedToken: StoredToken): Promise<boolean> {
  try {
    const tokenStr = JSON.stringify(storedToken);
    const { stdout } = await execFileAsync(getPythonBinary(), [SCRIPT_PATH, 'write', tokenStr]);
    const res = JSON.parse(stdout);
    return !!res.success;
  } catch (error) {
    console.error('Error escribiendo token en el almacén seguro:', error);
    return false;
  }
}
