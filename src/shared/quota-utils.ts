/**
 * Formatea un timestamp ISO de reset de cuota en una cuenta regresiva legible en español.
 * Ejemplos: "en 2h 15m (02:26)", "en 4 días (23/09 05:03)", "Reestablecido".
 */
export function formatTimeUntilReset(resetTimeIso?: string | null): string | null {
  if (!resetTimeIso) return null;

  const targetDate = new Date(resetTimeIso);
  const target = targetDate.getTime();
  if (isNaN(target)) return null;

  const now = Date.now();
  const diffMs = target - now;

  if (diffMs <= 0) {
    return 'Reestablecido';
  }

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const timeStr = targetDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  if (days > 0) {
    const dayStr = targetDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    return `en ${days}d ${hours % 24}h (${dayStr} ${timeStr})`;
  }

  if (hours > 0) {
    return `en ${hours}h ${minutes % 60}m (${timeStr})`;
  }

  return `en ${minutes}m (${timeStr})`;
}

/**
 * Determina si una cuota está agotada (menos o igual al 2% restante y aún no reestablecida por tiempo).
 */
export function isQuotaExhausted(
  fiveHourRemaining?: number | null,
  weeklyRemaining?: number | null,
  fiveHourResetIso?: string | null,
  weeklyResetIso?: string | null
): boolean {
  const now = Date.now();
  const fiveHourResetPassed = fiveHourResetIso ? new Date(fiveHourResetIso).getTime() <= now : false;
  const weeklyResetPassed = weeklyResetIso ? new Date(weeklyResetIso).getTime() <= now : false;

  const is5hExhausted =
    fiveHourRemaining !== undefined &&
    fiveHourRemaining !== null &&
    fiveHourRemaining <= 0.02 &&
    !fiveHourResetPassed;

  const isWeeklyExhausted =
    weeklyRemaining !== undefined &&
    weeklyRemaining !== null &&
    weeklyRemaining <= 0.02 &&
    !weeklyResetPassed;

  return is5hExhausted || isWeeklyExhausted;
}

