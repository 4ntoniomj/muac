import { getDatabase } from '@/shared/db';
import { GlobalSettings, DEFAULT_SETTINGS } from '@/shared/types/settings';

const SETTINGS_KEY = 'global_app_settings';

export function getGlobalSettings(): GlobalSettings {
  const db = getDatabase();
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get(SETTINGS_KEY) as { value: string } | undefined;

  if (!row) {
    saveGlobalSettings(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const parsed = JSON.parse(row.value);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveGlobalSettings(settings: GlobalSettings): GlobalSettings {
  const db = getDatabase();
  const jsonStr = JSON.stringify(settings);
  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(SETTINGS_KEY, jsonStr);

  return settings;
}

export function updateGlobalSettings(partial: Partial<GlobalSettings>): GlobalSettings {
  const current = getGlobalSettings();
  const updated: GlobalSettings = {
    ...current,
    ...partial,
  };
  return saveGlobalSettings(updated);
}
