import { DEFAULT_SETTINGS, defaultEntriesForMonth, sanitizePayrollSettings, type PayrollSettings, type ShiftDayEntry } from './payroll';

const SETTINGS_KEY = 'shift-bordro:settings';
const ENTRIES_KEY = 'shift-bordro:entries';
const VERSION_KEY = 'shift-bordro:version';
const STORAGE_VERSION = '3';
const LEGACY_REFERENCE_NET = 44160;

export interface StoredState {
  settings: PayrollSettings;
  entries: ShiftDayEntry[];
}

export function loadState(): StoredState {
  if (typeof window === 'undefined') {
    return {
      settings: DEFAULT_SETTINGS,
      entries: defaultEntriesForMonth(DEFAULT_SETTINGS)
    };
  }

  const storedSettings = readJson<PayrollSettings>(SETTINGS_KEY);
  const storedEntries = readJson<ShiftDayEntry[]>(ENTRIES_KEY);
  const storedVersion = window.localStorage.getItem(VERSION_KEY);
  const migratedSettings = migrateSettings(storedSettings, storedVersion);
  const settings = sanitizePayrollSettings({ ...DEFAULT_SETTINGS, ...migratedSettings });
  const entries = storedEntries ?? defaultEntriesForMonth(settings);
  if (storedVersion !== STORAGE_VERSION) {
    saveSettings(settings);
    saveEntries(storedEntries ?? entries);
  }
  return { settings, entries };
}

export function saveSettings(settings: PayrollSettings): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitizePayrollSettings(settings)));
  window.localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
}

export function saveEntries(entries: ShiftDayEntry[]): void {
  window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  window.localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
}

export function resetStorage(): StoredState {
  const settings = { ...DEFAULT_SETTINGS };
  const entries = defaultEntriesForMonth(settings);
  saveSettings(settings);
  saveEntries(entries);
  return { settings, entries };
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function migrateSettings(settings: PayrollSettings | null, version: string | null): Partial<PayrollSettings> {
  if (!settings) return {};
  if (version === STORAGE_VERSION) return settings;

  const next: Partial<PayrollSettings> = { ...settings };
  if (settings.targetNetSalary === LEGACY_REFERENCE_NET) {
    next.targetNetSalary = DEFAULT_SETTINGS.targetNetSalary;
  }
  return next;
}
