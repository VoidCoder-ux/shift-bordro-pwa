import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  parseISO,
  startOfMonth,
  subMonths
} from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  PiggyBank,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  Wallet
} from 'lucide-react';
import {
  calculateMonthPayroll,
  defaultEntriesForMonth,
  estimateDayNet,
  formatTRY,
  parseTurkishNumber,
  REFERENCE_SETTINGS,
  buildReferenceEntries,
  clampNumber,
  sanitizePayrollSettings,
  toISODate,
  type DayStatus,
  type PayrollSettings,
  type ShiftDayEntry
} from './lib/payroll';
import { loadState, resetStorage, saveEntries, saveSettings } from './lib/storage';

const STATUS_OPTIONS: DayStatus[] = ['blank', 'worked', 'paid_leave', 'unpaid_leave', 'rest', 'public_holiday'];

const STATUS_LABELS: Record<DayStatus, string> = {
  blank: 'Kayit yok',
  worked: 'Calisti',
  paid_leave: 'Ucretli izin',
  unpaid_leave: 'Ucretsiz / rapor',
  rest: 'Hafta tatili',
  public_holiday: 'Resmi tatil'
};

// Pastel, canli ama yumusak gun renkleri
const STATUS_CLASSES: Record<DayStatus, string> = {
  blank: 'border-slate-200 bg-white text-slate-400',
  worked: 'border-teal-300 bg-teal-50 text-teal-900',
  paid_leave: 'border-sky-300 bg-sky-50 text-sky-900',
  unpaid_leave: 'border-rose-300 bg-rose-50 text-rose-900',
  rest: 'border-violet-300 bg-violet-50 text-violet-900',
  public_holiday: 'border-amber-300 bg-amber-50 text-amber-900'
};

// Durum secim butonu icin pastel aktif renkleri
const STATUS_CHOICE_ACTIVE: Record<DayStatus, string> = {
  blank: 'border-slate-400 bg-slate-100 text-slate-900',
  worked: 'border-teal-400 bg-teal-100 text-teal-900',
  paid_leave: 'border-sky-400 bg-sky-100 text-sky-900',
  unpaid_leave: 'border-rose-400 bg-rose-100 text-rose-900',
  rest: 'border-violet-400 bg-violet-100 text-violet-900',
  public_holiday: 'border-amber-400 bg-amber-100 text-amber-900'
};

function formatTRYShort(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0
  }).format(value);
}

export default function App() {
  const initial = useMemo(loadState, []);
  const [settings, setSettings] = useState<PayrollSettings>(initial.settings);
  const [entries, setEntries] = useState<ShiftDayEntry[]>(initial.entries);
  const [selectedDate, setSelectedDate] = useState(() => entries[0]?.date ?? toISODate(settings.year, settings.month, 1));
  const [activePanel, setActivePanel] = useState<'calendar' | 'settings'>('calendar');

  const payroll = useMemo(() => calculateMonthPayroll(entries, settings), [entries, settings]);
  const selectedEntry = entries.find((entry) => entry.date === selectedDate) ?? entries[0];
  const monthDate = new Date(settings.year, settings.month - 1, 1);
  const monthDays = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
  const leadingDays = Array.from({ length: (getDay(monthDays[0]) + 6) % 7 });

  const updateSettings = (patch: Partial<PayrollSettings>, resetMonth = false) => {
    const next = sanitizePayrollSettings({ ...settings, ...patch });
    setSettings(next);
    saveSettings(next);
    if (resetMonth) {
      const nextEntries = defaultEntriesForMonth(next);
      setEntries(nextEntries);
      saveEntries(nextEntries);
      setSelectedDate(nextEntries[0]?.date ?? toISODate(next.year, next.month, 1));
    }
  };

  const updateEntry = (date: string, patch: Partial<ShiftDayEntry>) => {
    const next = entries.map((entry) => {
      if (entry.date !== date) return entry;
      const updated = {
        ...entry,
        ...patch,
        workHours: patch.workHours === undefined ? entry.workHours : clampNumber(patch.workHours, 0, 24, entry.workHours),
        overtimeHours: patch.overtimeHours === undefined ? entry.overtimeHours : clampNumber(patch.overtimeHours, 0, 24, entry.overtimeHours)
      };
      if (patch.status && patch.status !== 'public_holiday') {
        updated.workedOnPublicHoliday = false;
      }
      if (patch.status === 'blank') {
        updated.workHours = 0;
        updated.overtimeHours = 0;
        updated.workedOnPublicHoliday = false;
      }
      if (patch.status === 'worked' && entry.workHours === 0) {
        updated.workHours = settings.dailyStandardHours;
      }
      if (patch.status === 'rest' || patch.status === 'unpaid_leave') {
        updated.workHours = 0;
      }
      return updated;
    });
    setEntries(next);
    saveEntries(next);
  };

  const changeMonth = (direction: -1 | 1) => {
    const nextMonth = direction === 1 ? addMonths(monthDate, 1) : subMonths(monthDate, 1);
    updateSettings({ year: nextMonth.getFullYear(), month: nextMonth.getMonth() + 1 }, true);
  };

  const applyReference = () => {
    const nextSettings = { ...REFERENCE_SETTINGS };
    const nextEntries = buildReferenceEntries();
    setSettings(nextSettings);
    setEntries(nextEntries);
    setSelectedDate(nextEntries[0].date);
    saveSettings(nextSettings);
    saveEntries(nextEntries);
  };

  const resetAll = () => {
    const next = resetStorage();
    setSettings(next.settings);
    setEntries(next.entries);
    setSelectedDate(next.entries[0]?.date ?? toISODate(next.settings.year, next.settings.month, 1));
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ settings, entries, payroll }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shift-bordro-${settings.year}-${String(settings.month).padStart(2, '0')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:flex-row sm:items-center sm:justify-between sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-sky-500 text-white shadow-lg shadow-teal-500/25">
              <CalendarDays className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight">Shift Bordro</h1>
              <p className="truncate text-sm font-medium text-slate-500">Vardiya, izin, mesai ve net maas</p>
            </div>
          </div>
          <div className="grid w-full min-w-0 grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <button className="btn-secondary justify-center" onClick={applyReference}>
              <ShieldCheck className="h-4 w-4 shrink-0 text-teal-600" /> <span>Referans</span>
            </button>
            <button className="btn-secondary justify-center" onClick={exportJson}>
              <Download className="h-4 w-4 shrink-0 text-sky-600" /> <span>JSON</span>
            </button>
            <button className="btn-secondary justify-center" onClick={resetAll}>
              <RotateCcw className="h-4 w-4 shrink-0 text-rose-500" /> <span>Sifirla</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl min-w-0 gap-4 px-3 py-4 sm:px-4 sm:py-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 space-y-4">
          <NetSalaryHero payroll={payroll} monthLabel={format(monthDate, 'MMMM yyyy', { locale: tr })} />
          <SummaryCards payroll={payroll} />

          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-soft">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
                <button className="icon-btn" onClick={() => changeMonth(-1)} aria-label="Onceki ay">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-center text-base font-bold capitalize sm:text-lg">
                  {format(monthDate, 'MMMM yyyy', { locale: tr })}
                </h2>
                <button className="icon-btn" onClick={() => changeMonth(1)} aria-label="Sonraki ay">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button
                  className={`panel-tab justify-center ${activePanel === 'calendar' ? 'panel-tab-active' : ''}`}
                  onClick={() => setActivePanel('calendar')}
                >
                  <CalendarDays className="h-4 w-4" /> Takvim
                </button>
                <button
                  className={`panel-tab justify-center ${activePanel === 'settings' ? 'panel-tab-active' : ''}`}
                  onClick={() => setActivePanel('settings')}
                >
                  <Settings className="h-4 w-4" /> Ayarlar
                </button>
              </div>
            </div>

            {activePanel === 'calendar' ? (
              <div className="p-2 sm:p-3">
                <div className="calendar-weekdays pb-2">
                  {['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz'].map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="calendar-grid">
                  {leadingDays.map((_, index) => <div key={`empty-${index}`} className="calendar-empty" />)}
                  {monthDays.map((day) => {
                    const date = format(day, 'yyyy-MM-dd');
                    const entry = entries.find((item) => item.date === date);
                    const isSelected = selectedEntry && isSameDay(parseISO(selectedEntry.date), day);
                    const dayNet = entry ? estimateDayNet(entry, payroll.dailyNet, settings) : 0;
                    return (
                      <button
                        key={date}
                        className={`calendar-day ${isSelected ? 'calendar-day-active' : ''} ${entry ? STATUS_CLASSES[entry.status] : 'border-slate-200 bg-white'}`}
                        onClick={() => setSelectedDate(date)}
                      >
                        <div className="flex w-full items-start justify-between gap-1">
                          <span className="calendar-date">{format(day, 'd')}</span>
                          {entry?.overtimeHours ? <span className="calendar-chip">FM {entry.overtimeHours}s</span> : null}
                        </div>
                        <span className="calendar-status">{entry ? STATUS_LABELS[entry.status] : 'Bos'}</span>
                        {dayNet > 0 ? <span className="calendar-net">{formatTRYShort(dayNet)}</span> : null}
                        {entry?.workedOnPublicHoliday ? <span className="calendar-chip mt-auto">Tatil calisti</span> : null}
                      </button>
                    );
                  })}
                </div>
                <CalendarLegend />
              </div>
            ) : (
              <SettingsPanel settings={settings} updateSettings={updateSettings} />
            )}
          </div>

          <div className="lg:hidden">
            {selectedEntry ? (
              <DayEditor entry={selectedEntry} settings={settings} payroll={payroll} onChange={(patch) => updateEntry(selectedEntry.date, patch)} />
            ) : null}
          </div>

          <MonthlySummaryChart payroll={payroll} />

          <div className="lg:hidden">
            <Warnings warnings={payroll.warnings} />
          </div>

          <PayrollTable payroll={payroll} />
        </section>

        <aside className="hidden min-w-0 space-y-4 lg:block">
          {selectedEntry ? (
            <DayEditor entry={selectedEntry} settings={settings} payroll={payroll} onChange={(patch) => updateEntry(selectedEntry.date, patch)} />
          ) : null}
          <Warnings warnings={payroll.warnings} />
        </aside>
      </main>
    </div>
  );
}

function NetSalaryHero({ payroll, monthLabel }: { payroll: ReturnType<typeof calculateMonthPayroll>; monthLabel: string }) {
  const positive = payroll.netDeltaFromTarget >= 0;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 via-teal-500 to-sky-500 p-5 text-white shadow-soft sm:p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-white/85">
            <Wallet className="h-4 w-4" /> Aylik net maas <span className="capitalize text-white/70">· {monthLabel}</span>
          </p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{formatTRY(payroll.netPay)}</p>
          <p className="mt-1 text-sm text-white/80">Gunluk net {formatTRY(payroll.dailyNet)} · Brut {formatTRY(payroll.totalGross)}</p>
        </div>
        <div className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-sm font-bold ${positive ? 'bg-white/20' : 'bg-rose-900/30'}`}>
          {positive ? <Sparkles className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {positive ? '+' : ''}{formatTRY(payroll.netDeltaFromTarget)} hedef farki
        </div>
      </div>
    </div>
  );
}

function CalendarLegend() {
  const items: { status: DayStatus }[] = [
    { status: 'worked' },
    { status: 'paid_leave' },
    { status: 'unpaid_leave' },
    { status: 'rest' },
    { status: 'public_holiday' }
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-2 px-1">
      {items.map(({ status }) => (
        <span key={status} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_CLASSES[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      ))}
    </div>
  );
}

function SummaryCards({ payroll }: { payroll: ReturnType<typeof calculateMonthPayroll> }) {
  const cards = [
    { label: 'Gunluk net', value: formatTRY(payroll.dailyNet), icon: CalendarDays, tone: 'text-teal-600', ring: 'bg-teal-50' },
    { label: 'Net odenen', value: formatTRY(payroll.netPay), icon: PiggyBank, tone: 'text-emerald-600', ring: 'bg-emerald-50' },
    { label: 'Brut kazanc', value: formatTRY(payroll.totalGross), icon: TrendingUp, tone: 'text-sky-600', ring: 'bg-sky-50' },
    { label: 'Yasal kesinti', value: formatTRY(payroll.deductions.legalTotal), icon: ShieldCheck, tone: 'text-amber-600', ring: 'bg-amber-50' },
    { label: 'Ek net', value: formatTRY(payroll.netDeltaFromTarget), icon: Banknote, tone: payroll.netDeltaFromTarget < 0 ? 'text-rose-600' : 'text-violet-600', ring: payroll.netDeltaFromTarget < 0 ? 'bg-rose-50' : 'bg-violet-50' }
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(({ label, value, icon: Icon, tone, ring }) => (
        <div key={label} className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${ring}`}>
              <Icon className={`h-5 w-5 ${tone}`} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
        </div>
      ))}
    </div>
  );
}

function MonthlySummaryChart({ payroll }: { payroll: ReturnType<typeof calculateMonthPayroll> }) {
  const segments = [
    { label: 'Net maas', value: payroll.netPay, color: '#14b8a6' },
    { label: 'SGK primi', value: payroll.deductions.sgkPremium, color: '#8b5cf6' },
    { label: 'Issizlik primi', value: payroll.deductions.unemploymentPremium, color: '#0ea5e9' },
    { label: 'Gelir vergisi', value: payroll.deductions.incomeTax, color: '#f59e0b' },
    { label: 'Damga vergisi', value: payroll.deductions.stampTax, color: '#f43f5e' }
  ].filter((segment) => segment.value > 0);

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-soft">
      <div className="border-b border-slate-100 p-4">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <TrendingUp className="h-5 w-5 text-teal-600" /> Aylik ozet
        </h2>
        <p className="text-sm text-slate-500">Brut kazancin net ve yasal kesintilere dagilimi</p>
      </div>
      <div className="flex flex-col items-center gap-6 p-5 sm:flex-row sm:items-center">
        <div className="relative h-44 w-44 shrink-0">
          <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
            <circle cx="90" cy="90" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="24" />
            {total > 0 && segments.map((segment) => {
              const dash = (segment.value / total) * circumference;
              const circle = (
                <circle
                  key={segment.label}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="24"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += dash;
              return circle;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Net</span>
            <span className="px-2 text-lg font-extrabold text-slate-900">{formatTRYShort(payroll.netPay)}</span>
          </div>
        </div>
        <ul className="w-full min-w-0 space-y-2">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                <span className="truncate font-medium text-slate-700">{segment.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-semibold text-slate-900">{formatTRY(segment.value)}</span>
                <span className="w-10 text-right text-xs text-slate-400">{total > 0 ? Math.round((segment.value / total) * 100) : 0}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function DayEditor({
  entry,
  settings,
  payroll,
  onChange
}: {
  entry: ShiftDayEntry;
  settings: PayrollSettings;
  payroll: ReturnType<typeof calculateMonthPayroll>;
  onChange: (patch: Partial<ShiftDayEntry>) => void;
}) {
  const dayNet = estimateDayNet(entry, payroll.dailyNet, settings);
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{format(parseISO(entry.date), 'd MMMM yyyy', { locale: tr })}</h2>
          <p className="text-sm text-slate-500">Gun kaydini duzenle</p>
        </div>
        <Save className="h-5 w-5 text-teal-600" />
      </div>

      <div className="mb-4 flex items-center justify-between rounded-xl bg-gradient-to-r from-teal-50 to-sky-50 px-4 py-3">
        <span className="text-sm font-semibold text-slate-600">Bu gunun net kazanci</span>
        <span className="text-xl font-extrabold text-teal-700">{formatTRY(dayNet)}</span>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Gun tipi</p>
          <div className="status-grid">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                className={`status-choice ${entry.status === status ? `status-choice-active ${STATUS_CHOICE_ACTIVE[status]}` : ''}`}
                onClick={() => onChange({ status })}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>
        <HourStepper
          label="Calisma saati"
          value={entry.workHours}
          disabled={entry.status === 'blank' || entry.status === 'rest' || entry.status === 'unpaid_leave'}
          onChange={(value) => onChange({ workHours: value })}
        />
        <HourStepper
          label="Fazla mesai"
          value={entry.overtimeHours}
          disabled={entry.status === 'blank'}
          onChange={(value) => onChange({ overtimeHours: value })}
        />
        <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700">
          <span className="flex items-center gap-2"><Sun className="h-4 w-4 text-amber-500" /> Resmi tatilde calisti</span>
          <input
            className="h-5 w-5 accent-teal-600"
            type="checkbox"
            checked={entry.workedOnPublicHoliday}
            disabled={entry.status !== 'public_holiday'}
            onChange={(event) => onChange({ workedOnPublicHoliday: event.target.checked })}
          />
        </label>
        <label className="field">
          <span>Not</span>
          <textarea rows={3} value={entry.note} onChange={(event) => onChange({ note: event.target.value })} />
        </label>
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          Standart gun {settings.dailyStandardHours} saat, fazla mesai carpani {settings.overtimeMultiplier}x.
        </div>
      </div>
    </section>
  );
}

function HourStepper({
  label,
  value,
  disabled,
  onChange
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const setValue = (next: number) => {
    if (!Number.isFinite(next)) return;
    onChange(Math.round(clampNumber(next, 0, 24, value) * 4) / 4);
  };
  return (
    <div className={`field ${disabled ? 'opacity-50' : ''}`}>
      <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" /> {label}</span>
      <div className="grid grid-cols-[48px_1fr_48px] gap-2">
        <button type="button" className="step-btn" disabled={disabled} onClick={() => setValue(value - 0.25)}>-</button>
        <input
          type="number"
          min="0"
          step="0.25"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(Number(event.target.value))}
        />
        <button type="button" className="step-btn" disabled={disabled} onClick={() => setValue(value + 0.25)}>+</button>
      </div>
    </div>
  );
}

function SettingsPanel({
  settings,
  updateSettings
}: {
  settings: PayrollSettings;
  updateSettings: (patch: Partial<PayrollSettings>, resetMonth?: boolean) => void;
}) {
  const setNumber = (key: keyof PayrollSettings, value: string, resetMonth = false) => {
    if (value.trim() === '') return;
    const parsed = key === 'targetNetSalary' ? parseTurkishNumber(value) : Number(value);
    if (!Number.isFinite(parsed)) return;
    const nextValue = normalizeSettingValue(key, parsed);
    updateSettings({ [key]: nextValue } as Partial<PayrollSettings>, resetMonth);
  };

  return (
    <div className="grid gap-4 p-4 md:grid-cols-2">
      <label className="field">
        <span>30 gunluk baz net maas</span>
        <input inputMode="decimal" value={settings.targetNetSalary} onChange={(event) => setNumber('targetNetSalary', event.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">
          <span>Yil</span>
          <input type="number" value={settings.year} onChange={(event) => setNumber('year', event.target.value, true)} />
        </label>
        <label className="field">
          <span>Ay</span>
          <input min="1" max="12" type="number" value={settings.month} onChange={(event) => setNumber('month', event.target.value, true)} />
        </label>
      </div>
      <label className="field">
        <span>Gunluk standart saat</span>
        <input type="number" step="0.25" value={settings.dailyStandardHours} onChange={(event) => setNumber('dailyStandardHours', event.target.value)} />
      </label>
      <label className="field">
        <span>Aylik standart saat</span>
        <input type="number" step="0.25" value={settings.monthlyStandardHours} onChange={(event) => setNumber('monthlyStandardHours', event.target.value)} />
      </label>
      <label className="field">
        <span>Fazla mesai carpani</span>
        <input type="number" step="0.05" value={settings.overtimeMultiplier} onChange={(event) => setNumber('overtimeMultiplier', event.target.value)} />
      </label>
      <label className="field">
        <span>Resmi tatil calisma carpani</span>
        <input type="number" step="0.05" value={settings.holidayWorkMultiplier} onChange={(event) => setNumber('holidayWorkMultiplier', event.target.value)} />
      </label>
      <label className="field">
        <span>Gelir vergisi istisnasi</span>
        <input value={settings.minimumWageIncomeTaxExemption} onChange={(event) => setNumber('minimumWageIncomeTaxExemption', event.target.value)} />
      </label>
      <label className="field">
        <span>Damga vergisi istisnasi</span>
        <input value={settings.minimumWageStampTaxExemption} onChange={(event) => setNumber('minimumWageStampTaxExemption', event.target.value)} />
      </label>
    </div>
  );
}

function normalizeSettingValue(key: keyof PayrollSettings, value: number): number {
  if (key === 'year') return Math.round(clampNumber(value, 2020, 2100, REFERENCE_SETTINGS.year));
  if (key === 'month') return Math.round(clampNumber(value, 1, 12, REFERENCE_SETTINGS.month));
  if (key === 'targetNetSalary') return clampNumber(value, 0, 10_000_000, REFERENCE_SETTINGS.targetNetSalary);
  if (key === 'dailyStandardHours') return clampNumber(value, 0.25, 24, REFERENCE_SETTINGS.dailyStandardHours);
  if (key === 'monthlyStandardHours') return clampNumber(value, 1, 744, REFERENCE_SETTINGS.monthlyStandardHours);
  if (key === 'payrollMonthDays') return Math.round(clampNumber(value, 1, 31, REFERENCE_SETTINGS.payrollMonthDays));
  if (key === 'minimumWageIncomeTaxExemption') return clampNumber(value, 0, 1_000_000, REFERENCE_SETTINGS.minimumWageIncomeTaxExemption);
  if (key === 'minimumWageStampTaxExemption') return clampNumber(value, 0, 100_000, REFERENCE_SETTINGS.minimumWageStampTaxExemption);
  return clampNumber(value, 0, 5, REFERENCE_SETTINGS[key]);
}

function PayrollTable({ payroll }: { payroll: ReturnType<typeof calculateMonthPayroll> }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-soft">
      <div className="border-b border-slate-100 p-4">
        <h2 className="text-lg font-bold">Bordro ozeti</h2>
        <p className="text-sm text-slate-500">Kazanc satirlari, matrahlar ve yasal kesintiler</p>
      </div>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm sm:min-w-[760px]">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Kazanc</th>
              <th className="px-4 py-3 text-right">Gun</th>
              <th className="px-4 py-3 text-right">Saat</th>
              <th className="px-4 py-3 text-right">Brut</th>
              <th className="px-4 py-3 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {payroll.lines.map((line) => (
              <tr key={line.key} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{line.label}</td>
                <td className="px-4 py-3 text-right">{line.days.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{line.hours.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{formatTRY(line.gross)}</td>
                <td className="px-4 py-3 text-right font-semibold text-teal-700">{formatTRY(line.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Sigorta matrahi" value={formatTRY(payroll.totalGross)} />
        <Metric label="Vergi matrahi" value={formatTRY(payroll.taxBase)} />
        <Metric label="Gelir vergisi" value={formatTRY(payroll.deductions.incomeTax)} />
        <Metric label="Damga vergisi" value={formatTRY(payroll.deductions.stampTax)} />
        <Metric label="SGK primi" value={formatTRY(payroll.deductions.sgkPremium)} />
        <Metric label="Issizlik primi" value={formatTRY(payroll.deductions.unemploymentPremium)} />
        <Metric label="Brut toplam" value={formatTRY(payroll.totalGross)} />
        <Metric label="Net odenen" value={formatTRY(payroll.netPay)} strong />
      </div>
    </section>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${strong ? 'bg-teal-50' : 'bg-slate-50'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 ${strong ? 'text-lg font-bold text-teal-700' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return (
      <section className="flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm font-medium text-teal-900">
        <ShieldCheck className="h-5 w-5 shrink-0 text-teal-600" /> Bordro kayitlarinda cakismanin onune gecildi.
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <h2 className="mb-2 flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5 text-amber-600" /> Uyarilar</h2>
      <ul className="space-y-1">
        {warnings.map((warning) => <li key={warning}>{warning}</li>)}
      </ul>
    </section>
  );
}
