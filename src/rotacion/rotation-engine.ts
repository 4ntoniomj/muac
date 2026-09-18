import { getDatabase } from '@/shared/db';
import type { Account } from '@/shared/types/account';
import type { AccountQuotaSummary, RotationEvent } from '@/shared/types/quota';
import { listAccounts, setActiveAccount, getAccountById } from '@/cuentas/account-store';
import { getCachedQuotaSnapshot, fetchCurrentQuota } from './quota-monitor';
import crypto from 'node:crypto';

export interface ShouldRotateResult {
  shouldRotate: boolean;
  reason?: string;
}

export function evaluateQuotaExhaustion(
  quota: AccountQuotaSummary,
  modelGroup: 'gemini' | '3p',
  thresholdFraction: number = 0.05,
  check5h: boolean = true,
  checkWeekly: boolean = true
): ShouldRotateResult {
  const fiveHourRemaining =
    modelGroup === 'gemini' ? quota.gemini5hRemaining : quota.thirdParty5hRemaining;
  const weeklyRemaining =
    modelGroup === 'gemini' ? quota.geminiWeeklyRemaining : quota.thirdPartyWeeklyRemaining;

  if (check5h && fiveHourRemaining <= thresholdFraction) {
    return {
      shouldRotate: true,
      reason: `Límite de 5 horas casi agotado (${(fiveHourRemaining * 100).toFixed(0)}% restante)`,
    };
  }

  if (checkWeekly && weeklyRemaining <= thresholdFraction) {
    return {
      shouldRotate: true,
      reason: `Límite semanal casi agotado (${(weeklyRemaining * 100).toFixed(0)}% restante)`,
    };
  }

  return { shouldRotate: false };
}

export async function findNextAvailableAccount(
  currentAccountId: string,
  modelGroup: 'gemini' | '3p',
  thresholdFraction: number = 0.05
): Promise<Account | null> {
  const allAccounts = listAccounts();
  const poolAccounts = allAccounts.filter(
    (acc) => acc.inRotationPool && acc.id !== currentAccountId
  );

  if (poolAccounts.length === 0) {
    return null;
  }

  let bestAccount: Account | null = null;
  let bestScore = -1;

  for (const account of poolAccounts) {
    let quota = getCachedQuotaSnapshot(account.id);
    if (!quota) {
      // Si no tenemos snapshot, consultamos o asumimos disponibilidad inicial
      quota = await fetchCurrentQuota(account.id);
    }

    if (!quota) {
      // Si sigue sin cuota, es elegible por defecto
      return account;
    }

    const fiveHour =
      modelGroup === 'gemini' ? quota.gemini5hRemaining : quota.thirdParty5hRemaining;
    const weekly =
      modelGroup === 'gemini' ? quota.geminiWeeklyRemaining : quota.thirdPartyWeeklyRemaining;

    // Si tiene cuota suficiente en ambas ventanas
    if (fiveHour > thresholdFraction && weekly > thresholdFraction) {
      return account;
    }

    const score = Math.min(fiveHour, weekly);
    if (score > bestScore) {
      bestScore = score;
      bestAccount = account;
    }
  }

  return bestAccount || poolAccounts[0];
}

export async function executeAutoRotation(
  currentAccountId: string,
  reason: string,
  modelId: string,
  modelGroup: 'gemini' | '3p' = 'gemini'
): Promise<{ success: boolean; newAccount: Account | null; event?: RotationEvent }> {
  const nextAccount = await findNextAvailableAccount(currentAccountId, modelGroup);
  if (!nextAccount) {
    return { success: false, newAccount: null };
  }

  const currentAcc = getAccountById(currentAccountId);
  await setActiveAccount(nextAccount.id);

  const event: RotationEvent = {
    id: 'rot_' + crypto.randomUUID().slice(0, 8),
    timestamp: new Date().toISOString(),
    fromAccountId: currentAccountId,
    toAccountId: nextAccount.id,
    fromEmail: currentAcc?.email || currentAccountId,
    toEmail: nextAccount.email,
    reason,
    modelId,
  };

  const db = getDatabase();
  db.prepare(`
    INSERT INTO rotation_logs (id, timestamp, from_account_id, to_account_id, from_email, to_email, reason, model_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id,
    event.timestamp,
    event.fromAccountId,
    event.toAccountId,
    event.fromEmail,
    event.toEmail,
    event.reason,
    event.modelId
  );

  return { success: true, newAccount: nextAccount, event };
}

export async function rotateToNextAccount(
  currentAccountId?: string,
  modelId: string = 'gemini-2.5-pro'
): Promise<{ success: boolean; newAccount: Account | null; event?: RotationEvent }> {
  let targetId = currentAccountId;
  if (!targetId) {
    const active = (await import('@/cuentas/account-store')).getActiveAccount();
    if (!active) return { success: false, newAccount: null };
    targetId = active.id;
  }

  return executeAutoRotation(
    targetId,
    'Rotación manual solicitada por el usuario',
    modelId,
    modelId.includes('claude') || modelId.includes('gpt') ? '3p' : 'gemini'
  );
}

export function getRecentRotationLogs(limit: number = 20): RotationEvent[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM rotation_logs ORDER BY timestamp DESC LIMIT ?');
  const rows = stmt.all(limit) as Array<{
    id: string;
    timestamp: string;
    from_account_id: string;
    to_account_id: string;
    from_email: string;
    to_email: string;
    reason: string;
    model_id: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    fromAccountId: r.from_account_id,
    toAccountId: r.to_account_id,
    fromEmail: r.from_email,
    toEmail: r.to_email,
    reason: r.reason,
    modelId: r.model_id,
  }));
}
