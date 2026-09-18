import { NextResponse } from 'next/server';
import {
  listAccounts,
  setActiveAccount,
  toggleAccountPool,
  deleteAccount,
  importCurrentSystemAccount,
} from '@/cuentas/account-store';
import { fetchCurrentQuota, getCachedQuotaSnapshot } from '@/rotacion/quota-monitor';
import { getRecentRotationLogs } from '@/rotacion/rotation-engine';
import type { AccountWithQuota } from '@/shared/types/account';

export async function GET() {
  try {
    const accounts = listAccounts();

    // Enriquecer con snapshots de cuota
    const accountsWithQuota: AccountWithQuota[] = accounts.map((acc) => {
      const quota = getCachedQuotaSnapshot(acc.id);
      return {
        ...acc,
        quota: quota || undefined,
      };
    });

    const activeAccount = accountsWithQuota.find((a) => a.isActive) || null;
    const rotationLogs = getRecentRotationLogs(15);

    return NextResponse.json({
      success: true,
      accounts: accountsWithQuota,
      activeAccount,
      rotationLogs,
    });
  } catch (error) {
    console.error('Error al listar cuentas:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, accountId, inPool } = body;

    if (action === 'import_system') {
      const imported = await importCurrentSystemAccount();
      if (!imported) {
        return NextResponse.json(
          { success: false, error: 'No se encontró ninguna sesión activa en Secret Service (gemini/antigravity).' },
          { status: 404 }
        );
      }
      // Actualizar cuota inicial
      await fetchCurrentQuota(imported.id);
      return NextResponse.json({ success: true, account: imported });
    }

    if (action === 'set_active') {
      if (!accountId) {
        return NextResponse.json({ success: false, error: 'accountId requerido' }, { status: 400 });
      }
      const updated = await setActiveAccount(accountId);
      return NextResponse.json({ success: true, account: updated });
    }

    if (action === 'toggle_pool') {
      if (!accountId || typeof inPool !== 'boolean') {
        return NextResponse.json({ success: false, error: 'accountId e inPool requeridos' }, { status: 400 });
      }
      toggleAccountPool(accountId, inPool);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      if (!accountId) {
        return NextResponse.json({ success: false, error: 'accountId requerido' }, { status: 400 });
      }
      deleteAccount(accountId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error('Error en POST /api/accounts:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
