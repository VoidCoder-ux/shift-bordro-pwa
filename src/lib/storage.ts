import { DEFAULT_SETTINGS, defaultEntriesForMonth, type PayrollSettings, type ShiftDayEntry } from './payroll';

const SETTINGS_KEY = 'shift-bordro:settings';
const ENTRIES_KEY = 'shift-bordro:entries';

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

  const settings = readJson<PayrollSettings>(SETTINGS_KEY) ?? DEFAULT_SETTINGS;
  const entries = readJson<ShiftDayEntry[]>(ENTRIES_KEY) ?? defaultEntriesForMonth(settings);
  return { settings: { ...DEFAULT_SETTINGS, ...settings }, entries };
}

export function saveSettings(settings: PayrollSettings): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function saveEntries(entries: ShiftDayEntry[]): void {
  window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
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
