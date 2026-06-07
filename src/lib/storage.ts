import { DEFAULT_SETTINGS, defaultEntriesForMonth, sanitizePayrollSettings, type PayrollSettings, type ShiftDayEntry } from './payroll';

const SETTINGS_KEY = 'shift-bordro:settings';
const ENTRIES_KEY = 'shift-bordro:entries';
const MONTHS_KEY = 'shift-bordro:months';
const VERSION_KEY = 'shift-bordro:version';
const STORAGE_VERSION = '4';
const LEGACY_REFERENCE_NET = 44160;

type MonthsMap = Record<string, ShiftDayEntry[]>;

export interface StoredState {
  settings: PayrollSettings;
  entries: ShiftDayEntry[];
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function loadState(): StoredState {
  if (typeof window === 'undefined') {
    return {
      settings: DEFAULT_SETTINGS,
      entries: defaultEntriesForMonth(DEFAULT_SETTINGS)
    };
  }

  const storedSettings = readJson<PayrollSettings>(SETTINGS_KEY);
  const storedVersion = window.localStorage.getItem(VERSION_KEY);
  const migratedSettings = migrateSettings(storedSettings, storedVersion);
  const settings = sanitizePayrollSettings({ ...DEFAULT_SETTINGS, ...migratedSettings });
  const entries = loadEntriesForMonth(settings);
  if (storedVersion !== STORAGE_VERSION) {
    saveSettings(settings);
    saveEntries(entries);
  }
  return { settings, entries };
}

export function saveSettings(settings: PayrollSettings): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitizePayrollSettings(settings)));
  window.localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
}

export function saveEntries(entries: ShiftDayEntry[]): void {
  if (!entries.length) return;
  const map = loadMonthsMap();
  map[entries[0].date.slice(0, 7)] = entries;
  window.localStorage.setItem(MONTHS_KEY, JSON.stringify(map));
  window.localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
}

export function loadEntriesForMonth(settings: PayrollSettings): ShiftDayEntry[] {
  if (typeof window === 'undefined') return defaultEntriesForMonth(settings);
  const map = loadMonthsMap();
  return map[monthKey(settings.year, settings.month)] ?? defaultEntriesForMonth(settings);
}

export function resetStorage(): StoredState {
  const settings = { ...DEFAULT_SETTINGS };
  const entries = defaultEntriesForMonth(settings);
  window.localStorage.removeItem(MONTHS_KEY);
  window.localStorage.removeItem(ENTRIES_KEY);
  saveSettings(settings);
  saveEntries(entries);
  return { settings, entries };
}

function loadMonthsMap(): MonthsMap {
  const existing = readJson<MonthsMap>(MONTHS_KEY);
  if (existing) return existing;

  // Eski tek-ay (v3) kayitlarini ay haritasina goc ettir.
  const legacy = readJson<ShiftDayEntry[]>(ENTRIES_KEY);
  const map: MonthsMap = {};
  if (legacy && legacy.length) {
    map[legacy[0].date.slice(0, 7)] = legacy;
    window.localStorage.setItem(MONTHS_KEY, JSON.stringify(map));
  }
  return map;
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
