import { NextResponse } from 'next/server';
import { fetchCurrentQuota } from '@/rotacion/quota-monitor';
import { listAccounts } from '@/cuentas/account-store';
import type { AccountQuotaSummary } from '@/shared/types/quota';

export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const accountId = urlObj.searchParams.get('accountId');

  try {
    if (accountId) {
      const quota = await fetchCurrentQuota(accountId);
      return NextResponse.json({ success: true, quota });
    }

    // Si no se especifica accountId, refresca la activa y lista de snapshots
    const accounts = listAccounts();
    const results: Record<string, AccountQuotaSummary | null> = {};

    for (const acc of accounts) {
      if (acc.isActive) {
        results[acc.id] = await fetchCurrentQuota(acc.id);
      }
    }

    return NextResponse.json({ success: true, quotas: results });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}

