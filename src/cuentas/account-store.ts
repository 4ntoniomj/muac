import { getDatabase } from '@/shared/db';
import type { Account, StoredToken } from '@/shared/types/account';
import { getCurrentSystemStoredToken, syncStoredTokenToSystem } from './keyring-sync';
import crypto from 'node:crypto';

export interface AccountRow {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  stored_token_json: string;
  in_rotation_pool: number;
  order_index: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || undefined,
    inRotationPool: Boolean(row.in_rotation_pool),
    orderIndex: row.order_index,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listAccounts(): Account[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM accounts ORDER BY order_index ASC, created_at ASC');
  const rows = stmt.all() as unknown as AccountRow[];
  return rows.map(rowToAccount);
}

export function getAccountById(id: string): (Account & { storedToken: StoredToken }) | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM accounts WHERE id = ?');
  const row = stmt.get(id) as unknown as AccountRow | undefined;
  if (!row) return null;

  return {
    ...rowToAccount(row),
    storedToken: JSON.parse(row.stored_token_json) as StoredToken,
  };
}

export function getActiveAccount(): (Account & { storedToken: StoredToken }) | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM accounts WHERE is_active = 1 LIMIT 1');
  const row = stmt.get() as unknown as AccountRow | undefined;
  if (!row) return null;

  return {
    ...rowToAccount(row),
    storedToken: JSON.parse(row.stored_token_json) as StoredToken,
  };
}

export async function setActiveAccount(id: string): Promise<Account | null> {
  const db = getDatabase();
  const target = getAccountById(id);
  if (!target) return null;

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare('UPDATE accounts SET is_active = 0 WHERE is_active = 1').run();
    db.prepare('UPDATE accounts SET is_active = 1, updated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      id
    );
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  // Sincronizar con el Secret Service del sistema
  await syncStoredTokenToSystem(target.storedToken);

  const updated = getAccountById(id);
  return updated ? rowToAccount(updated as unknown as AccountRow) : null;
}

export function createOrUpdateAccount(
  email: string,
  displayName: string,
  avatarUrl: string | undefined,
  storedToken: StoredToken
): Account {
  const db = getDatabase();
  const now = new Date().toISOString();
  const storedJson = JSON.stringify(storedToken);

  const existingStmt = db.prepare('SELECT * FROM accounts WHERE email = ?');
  const existing = existingStmt.get(email) as unknown as AccountRow | undefined;

  if (existing) {
    db.prepare(`
      UPDATE accounts 
      SET display_name = ?, avatar_url = ?, stored_token_json = ?, updated_at = ?
      WHERE id = ?
    `).run(displayName, avatarUrl || null, storedJson, now, existing.id);

    return rowToAccount({
      ...existing,
      display_name: displayName,
      avatar_url: avatarUrl || null,
      stored_token_json: storedJson,
      updated_at: now,
    });
  } else {
    const id = 'acc_' + crypto.randomUUID().slice(0, 8);
    const countStmt = db.prepare('SELECT COUNT(*) as cnt FROM accounts');
    const { cnt } = countStmt.get() as { cnt: number };
    const isFirst = cnt === 0;

    db.prepare(`
      INSERT INTO accounts (id, email, display_name, avatar_url, stored_token_json, in_rotation_pool, order_index, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `).run(id, email, displayName, avatarUrl || null, storedJson, cnt, isFirst ? 1 : 0, now, now);

    return {
      id,
      email,
      displayName,
      avatarUrl,
      inRotationPool: true,
      orderIndex: cnt,
      isActive: isFirst,
      createdAt: now,
      updatedAt: now,
    };
  }
}

export function toggleAccountPool(id: string, inPool: boolean): boolean {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE accounts SET in_rotation_pool = ?, updated_at = ? WHERE id = ?');
  stmt.run(inPool ? 1 : 0, new Date().toISOString(), id);
  return true;
}

export function deleteAccount(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
  stmt.run(id);
  return true;
}

export async function importCurrentSystemAccount(): Promise<Account | null> {
  const systemToken = await getCurrentSystemStoredToken();
  if (!systemToken) return null;

  let email = 'usuario.antigravity@google.com';
  let displayName = 'Cuenta Antigravity';
  let avatarUrl: string | undefined = undefined;

  if (systemToken.id_token) {
    try {
      const parts = systemToken.id_token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        if (payload.email) email = payload.email;
        if (payload.name) displayName = payload.name;
        if (payload.picture) avatarUrl = payload.picture;
      }
    } catch {
      // Ignorar fallos de decodificación OIDC y usar defaults
    }
  }

  const account = createOrUpdateAccount(email, displayName, avatarUrl, systemToken);
  // Asegurarse de que esté activa si es la única
  if (listAccounts().length === 1) {
    await setActiveAccount(account.id);
  }
  return account;
}
