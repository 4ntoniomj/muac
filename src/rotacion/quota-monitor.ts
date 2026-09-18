import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getDatabase } from '@/shared/db';
import type { AccountQuotaSummary, QuotaGroup, QuotaBucket } from '@/shared/types/quota';
import { getActiveAccount, getAccountById } from '@/cuentas/account-store';
import { syncStoredTokenToSystem } from '@/cuentas/keyring-sync';
import { getAgyCommand } from '@/shared/agy-cli';

const execFileAsync = promisify(execFile);

interface AgyUsageOutput {
  command?: {
    name?: string;
    data?: {
      groups?: Array<{
        name: string;
        description?: string;
        buckets?: Array<{
          id: string;
          name: string;
          window: '5h' | 'weekly';
          remaining_fraction: number;
          reset_time: string;
          description?: string;
        }>;
      }>;
    };
  };
}

export async function fetchCurrentQuota(accountId?: string): Promise<AccountQuotaSummary | null> {
  let targetAccountId = accountId;

  if (!targetAccountId) {
    const active = getActiveAccount();
    if (!active) return null;
    targetAccountId = active.id;
  } else {
    // Si se especifica una cuenta distinta a la activa, sincronizamos temporalmente su token
    const target = getAccountById(targetAccountId);
    if (target) {
      await syncStoredTokenToSystem(target.storedToken);
    }
  }

  try {
    const agyCmd = getAgyCommand();
    const { stdout } = await execFileAsync(agyCmd.command, [
      '--print',
      '/usage',
      '--output-format',
      'json',
    ], {
      shell: agyCmd.shell,
      env: process.env,
    });

    const parsed: AgyUsageOutput = JSON.parse(stdout);
    const groupsRaw = parsed.command?.data?.groups || [];

    const groups: QuotaGroup[] = groupsRaw.map((g) => ({
      name: g.name,
      description: g.description,
      buckets: (g.buckets || []).map((b) => ({
        id: b.id,
        name: b.name,
        window: b.window,
        remainingFraction: b.remaining_fraction,
        resetTime: b.reset_time,
        description: b.description,
      })),
    }));

    let gemini5hRemaining = 1.0;
    let geminiWeeklyRemaining = 1.0;
    let gemini5hReset = '';
    let geminiWeeklyReset = '';

    let thirdParty5hRemaining = 1.0;
    let thirdPartyWeeklyRemaining = 1.0;
    let thirdParty5hReset = '';
    let thirdPartyWeeklyReset = '';

    for (const group of groups) {
      const isGemini = group.name.toLowerCase().includes('gemini');
      for (const bucket of group.buckets) {
        if (bucket.window === '5h') {
          if (isGemini) {
            gemini5hRemaining = bucket.remainingFraction;
            gemini5hReset = bucket.resetTime;
          } else {
            thirdParty5hRemaining = bucket.remainingFraction;
            thirdParty5hReset = bucket.resetTime;
          }
        } else if (bucket.window === 'weekly') {
          if (isGemini) {
            geminiWeeklyRemaining = bucket.remainingFraction;
            geminiWeeklyReset = bucket.resetTime;
          } else {
            thirdPartyWeeklyRemaining = bucket.remainingFraction;
            thirdPartyWeeklyReset = bucket.resetTime;
          }
        }
      }
    }

    const summary: AccountQuotaSummary = {
      accountId: targetAccountId,
      fetchedAt: new Date().toISOString(),
      groups,
      gemini5hRemaining,
      geminiWeeklyRemaining,
      gemini5hReset,
      geminiWeeklyReset,
      thirdParty5hRemaining,
      thirdPartyWeeklyRemaining,
      thirdParty5hReset,
      thirdPartyWeeklyReset,
    };

    // Persistir snapshot en base de datos
    saveQuotaSnapshot(summary);

    return summary;
  } catch (error) {
    console.error('Error al consultar cuota con agy /usage:', error);
    // Intentar devolver el último snapshot conocido de la base de datos
    return getCachedQuotaSnapshot(targetAccountId);
  }
}

export function saveQuotaSnapshot(summary: AccountQuotaSummary): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO quota_snapshots (account_id, snapshot_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      snapshot_json = excluded.snapshot_json,
      updated_at = excluded.updated_at
  `);
  stmt.run(summary.accountId, JSON.stringify(summary), summary.fetchedAt);
}

export function getCachedQuotaSnapshot(accountId: string): AccountQuotaSummary | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM quota_snapshots WHERE account_id = ?');
  const row = stmt.get(accountId) as { snapshot_json: string; updated_at: string } | undefined;
  if (!row) return null;

  try {
    return JSON.parse(row.snapshot_json) as AccountQuotaSummary;
  } catch {
    return null;
  }
}

export function isQuotaSnapshotFresh(accountId: string, maxAgeMs: number = 30000): boolean {
  const db = getDatabase();
  const stmt = db.prepare('SELECT updated_at FROM quota_snapshots WHERE account_id = ?');
  const row = stmt.get(accountId) as { updated_at: string } | undefined;
  if (!row || !row.updated_at) return false;

  const age = Date.now() - new Date(row.updated_at).getTime();
  return age >= 0 && age < maxAgeMs;
}

export async function getOrRefreshQuota(
  accountId: string,
  maxAgeMs: number = 30000
): Promise<AccountQuotaSummary | null> {
  if (isQuotaSnapshotFresh(accountId, maxAgeMs)) {
    const cached = getCachedQuotaSnapshot(accountId);
    if (cached) return cached;
  }
  return fetchCurrentQuota(accountId);
}

export async function refreshActiveAccountQuota(force: boolean = true): Promise<AccountQuotaSummary | null> {
  const active = getActiveAccount();
  if (!active) return null;
  if (!force && isQuotaSnapshotFresh(active.id)) {
    return getCachedQuotaSnapshot(active.id);
  }
  return fetchCurrentQuota(active.id);
}

