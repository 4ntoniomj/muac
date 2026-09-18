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

    if (action === 'rotate_next') {
      const { rotateToNextAccount } = await import('@/rotacion/rotation-engine');
      const rot = await rotateToNextAccount(accountId);
      if (!rot.success || !rot.newAccount) {
        return NextResponse.json({
          success: false,
          error: 'No hay otras cuentas disponibles en el pool de rotación.',
        }, { status: 400 });
      }
      return NextResponse.json({ success: true, newAccount: rot.newAccount, event: rot.event });
    }

    if (action === 'import_token') {
      const { tokenJson } = body;
      if (!tokenJson) {
        return NextResponse.json({ success: false, error: 'tokenJson requerido' }, { status: 400 });
      }
      let parsed;
      try {
        parsed = typeof tokenJson === 'string' ? JSON.parse(tokenJson) : tokenJson;
      } catch {
        return NextResponse.json({ success: false, error: 'JSON de token no válido' }, { status: 400 });
      }
      const { createOrUpdateAccount, setActiveAccount } = await import('@/cuentas/account-store');
      let email = 'cuenta_importada@gmail.com';
      if (parsed.id_token) {
        try {
          const parts = parsed.id_token.split('.');
          if (parts.length >= 2) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            if (payload.email) email = payload.email;
          }
        } catch {}
      }
      const acc = createOrUpdateAccount(email, email.split('@')[0], undefined, parsed);
      await setActiveAccount(acc.id);
      return NextResponse.json({ success: true, account: acc });
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
