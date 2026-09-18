import path from 'node:path';
import fs from 'node:fs';

export interface PathValidationResult {
  valid: boolean;
  resolvedPath?: string;
  error?: string;
}

const FORBIDDEN_ROOTS_POSIX = new Set([
  '/',
  '/etc',
  '/proc',
  '/sys',
  '/dev',
  '/boot',
  '/root',
  '/bin',
  '/sbin',
  '/usr/bin',
  '/usr/sbin',
]);

/**
 * Sanitiza y valida rutas locales de Workspace para prevenir Path Traversal
 * y denegar el acceso a directorios críticos del sistema operativo.
 */
export function validateSafeWorkspacePath(targetPath: string): PathValidationResult {
  if (!targetPath || typeof targetPath !== 'string' || !targetPath.trim()) {
    return { valid: false, error: 'Ruta no proporcionada' };
  }

  // Resolver ruta canónica eliminando secuencias ../ y normalizando separadores
  const resolved = path.resolve(path.normalize(targetPath.trim()));

  // Comprobar prohibición de directorios raíz o críticos del sistema
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    // Prohibir raíz de disco como C:\ o C:
    if (/^[a-zA-Z]:\\?$/.test(resolved)) {
      return { valid: false, error: 'No está permitido usar la raíz del sistema como workspace.' };
    }
    const winLower = resolved.toLowerCase();
    if (winLower.startsWith('c:\\windows') || winLower.startsWith('c:\\system volume information')) {
      return { valid: false, error: 'Acceso denegado: directorio protegido del sistema operativo.' };
    }
  } else {
    if (FORBIDDEN_ROOTS_POSIX.has(resolved)) {
      return { valid: false, error: 'Acceso denegado: directorio protegido del sistema operativo.' };
    }
  }

  // Verificar existencia en el sistema de archivos
  if (!fs.existsSync(resolved)) {
    return { valid: false, error: `El directorio «${resolved}» no existe en el sistema de archivos.` };
  }

  // Verificar que es un directorio
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return { valid: false, error: `«${resolved}» no es un directorio válido.` };
    }
  } catch (err) {
    return { valid: false, error: `No se pudo acceder a «${resolved}»: ${(err as Error).message}` };
  }

  return { valid: true, resolvedPath: resolved };
}
