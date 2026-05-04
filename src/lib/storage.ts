import { DEFAULT_SETTINGS, defaultEntriesForMonth, type PayrollSettings, type ShiftDayEntry } from './payroll';

const SETTINGS_KEY = 'shift-bordro:settings';
const ENTRIES_KEY = 'shift-bordro:entries';
const VERSION_KEY = 'shift-bordro:version';
const STORAGE_VERSION = '2';

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

  if (window.localStorage.getItem(VERSION_KEY) !== STORAGE_VERSION) {
    const state = {
      settings: DEFAULT_SETTINGS,
      entries: defaultEntriesForMonth(DEFAULT_SETTINGS)
    };
    saveSettings(state.settings);
    saveEntries(state.entries);
    window.localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
    return state;
  }

  const settings = readJson<PayrollSettings>(SETTINGS_KEY) ?? DEFAULT_SETTINGS;
  const entries = readJson<ShiftDayEntry[]>(ENTRIES_KEY) ?? defaultEntriesForMonth(settings);
  return { settings: { ...DEFAULT_SETTINGS, ...settings }, entries };
}

export function saveSettings(settings: PayrollSettings): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
