import { getDatabase } from '@/shared/db';
import crypto from 'node:crypto';

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  conversationsCount?: number;
}

// Proyectos estándar conocidos de Antigravity
const DEFAULT_KNOWN_PROJECTS: Array<{ name: string; path: string }> = [
  { name: 'prueba', path: '/home/antonio/Escritorio/Todo/IA/prueba' },
  { name: 'IA', path: '/IA' },
  { name: 'plantilla', path: '/home/antonio/Escritorio/Todo/IA/plantilla' },
  { name: 'CLI Project', path: 'default-cli-project' },
  { name: 'ria', path: '/home/antonio/Escritorio/Todo/IA/ria' },
];

export function listProjects(): Project[] {
  const db = getDatabase();

  // Asegurar que los proyectos conocidos estén registrados en la tabla
  for (const kp of DEFAULT_KNOWN_PROJECTS) {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO projects (id, name, path, created_at)
        VALUES (?, ?, ?, ?)
      `).run('proj_' + crypto.randomUUID(), kp.name, kp.path, new Date().toISOString());
    } catch {
      // Ignorar si ya existe
    }
  }

  // Buscar también rutas de proyectos que aparezcan en conversaciones
  try {
    const convoPaths = db.prepare(`
      SELECT DISTINCT project_path FROM conversations 
      WHERE project_path IS NOT NULL AND project_path != '' AND project_path != 'outside-of-project'
    `).all() as Array<{ project_path: string }>;

    for (const cp of convoPaths) {
      const pPath = cp.project_path;
      const parts = pPath.replace(/\/+$/, '').split('/').filter(Boolean);
      const name = parts[parts.length - 1] || pPath;
      try {
        db.prepare(`
          INSERT OR IGNORE INTO projects (id, name, path, created_at)
          VALUES (?, ?, ?, ?)
        `).run('proj_' + crypto.randomUUID(), name, pPath, new Date().toISOString());
      } catch {
        // Ignorar
      }
    }
  } catch {
    // Ignorar
  }

  const rows = db.prepare(`
    SELECT p.*, COUNT(c.id) as convos_count
    FROM projects p
    LEFT JOIN conversations c ON (c.project_path = p.path OR (p.path = 'default-cli-project' AND c.project_path = '/home/antonio'))
    GROUP BY p.id
    ORDER BY p.name ASC
  `).all() as unknown as Array<{
    id: string;
    name: string;
    path: string;
    created_at: string;
    convos_count: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    path: r.path,
    createdAt: r.created_at,
    conversationsCount: r.convos_count,
  }));
}

export function createProject(name: string, path: string): Project {
  const db = getDatabase();
  const id = 'proj_' + crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO projects (id, name, path, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET name = excluded.name
  `).run(id, name, path, now);

  return {
    id,
    name,
    path,
    createdAt: now,
    conversationsCount: 0,
  };
}
