import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export interface AgyCommandInfo {
  command: string;
  shell: boolean;
}

let cachedAgyCommand: AgyCommandInfo | null = null;

/**
 * Resuelve el ejecutable de agy en el sistema según la plataforma.
 * En Windows busca agy.cmd, agy.exe o resolución via where.exe.
 * En Linux/macOS busca agy en PATH.
 */
export function getAgyCommand(): AgyCommandInfo {
  if (cachedAgyCommand) {
    return cachedAgyCommand;
  }

  const isWin = process.platform === 'win32';

  if (isWin) {
    // Probar nombres comunes en Windows
    const candidates = ['agy.cmd', 'agy.exe', 'agy.bat', 'agy'];
    for (const cand of candidates) {
      try {
        const out = execSync(`where.exe ${cand}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (out) {
          const firstPath = out.split(/\r?\n/)[0].trim();
          if (fs.existsSync(firstPath)) {
            cachedAgyCommand = { command: firstPath, shell: true };
            return cachedAgyCommand;
          }
        }
      } catch {
        // Continuar buscando
      }
    }
    // Fallback por defecto en Windows
    cachedAgyCommand = { command: 'agy.cmd', shell: true };
    return cachedAgyCommand;
  }

  // En Linux / macOS
  try {
    const whichOut = execSync('which agy', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (whichOut && fs.existsSync(whichOut)) {
      cachedAgyCommand = { command: whichOut, shell: false };
      return cachedAgyCommand;
    }
  } catch {
    // Si which falla, usar comando agy directo
  }

  cachedAgyCommand = { command: 'agy', shell: false };
  return cachedAgyCommand;
}

/**
 * Normaliza cualquier ruta de directorio de workspace para compatibilidad multi-SO
 */
export function normalizeWorkspacePath(targetPath: string): string {
  return path.normalize(path.resolve(targetPath));
}
