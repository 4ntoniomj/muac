import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true, mode: 0o700 });
} else {
  try {
    fs.chmodSync(DB_DIR, 0o700);
  } catch {
    // Ignorar en entornos sin soporte de permisos POSIX
  }
}

const DB_PATH = path.join(DB_DIR, 'muac.db');

let _db: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);

    // Asegurar permisos estrictos 0600 para almacenamiento sensible
    try {
      if (fs.existsSync(DB_PATH)) {
        fs.chmodSync(DB_PATH, 0o600);
      }
    } catch {
      // Ignorar en Windows / no-POSIX
    }

    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        fs.chmodSync(envPath, 0o600);
      }
    } catch {
      // Ignorar en Windows / no-POSIX
    }

    initDatabaseSchema(_db);
  }
  return _db;
}

function initDatabaseSchema(db: DatabaseSync): void {
  // Configuración WAL para alta concurrencia
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      stored_token_json TEXT NOT NULL,
      in_rotation_pool INTEGER NOT NULL DEFAULT 1,
      order_index INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quota_snapshots (
      account_id TEXT PRIMARY KEY,
      snapshot_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      model_id TEXT NOT NULL,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      project_path TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      reasoning_effort TEXT NOT NULL DEFAULT 'high'
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      duration_seconds REAL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      thinking_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      account_id TEXT,
      account_email TEXT,
      model_id TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rotation_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      from_account_id TEXT NOT NULL,
      to_account_id TEXT NOT NULL,
      from_email TEXT NOT NULL,
      to_email TEXT NOT NULL,
      reason TEXT NOT NULL,
      model_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      verifier TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Migraciones seguras: asegurar columnas en bases de datos existentes
  try {
    db.exec('ALTER TABLE conversations ADD COLUMN project_path TEXT;');
  } catch {
    // La columna ya existe
  }
  try {
    db.exec('ALTER TABLE conversations ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;');
  } catch {
    // La columna ya existe
  }
  try {
    db.exec("ALTER TABLE conversations ADD COLUMN reasoning_effort TEXT NOT NULL DEFAULT 'high';");
  } catch {
    // La columna ya existe
  }
}
