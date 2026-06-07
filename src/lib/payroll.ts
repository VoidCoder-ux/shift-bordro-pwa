export type DayStatus = 'blank' | 'worked' | 'paid_leave' | 'unpaid_leave' | 'rest' | 'public_holiday';

export interface PayrollSettings {
  year: number;
  month: number;
  targetNetSalary: number;
  dailyStandardHours: number;
  monthlyStandardHours: number;
  payrollMonthDays: number;
  sgkRate: number;
  unemploymentRate: number;
  incomeTaxRate: number;
  stampTaxRate: number;
  minimumWageIncomeTaxExemption: number;
  minimumWageStampTaxExemption: number;
  overtimeMultiplier: number;
  holidayWorkMultiplier: number;
}

export interface ShiftDayEntry {
  date: string;
  status: DayStatus;
  workHours: number;
  overtimeHours: number;
  workedOnPublicHoliday: boolean;
  note: string;
}

export interface PayrollLine {
  key: string;
  label: string;
  days: number;
  hours: number;
  gross: number;
  net: number;
}

export interface PayrollDeductions {
  sgkPremium: number;
  unemploymentPremium: number;
  incomeTaxBeforeExemption: number;
  incomeTaxExemption: number;
  incomeTax: number;
  stampTaxBeforeExemption: number;
  stampTaxExemption: number;
  stampTax: number;
  legalTotal: number;
}

export interface PayrollResult {
  settings: PayrollSettings;
  targetGrossSalary: number;
  dailyNet: number;
  dailyGross: number;
  hourlyGross: number;
  paidDays: number;
  unpaidDays: number;
  regularHours: number;
  overtimeHours: number;
  publicHolidayWorkDays: number;
  totalGross: number;
  taxBase: number;
  deductions: PayrollDeductions;
  netPay: number;
  netDeltaFromTarget: number;
  lines: PayrollLine[];
  warnings: string[];
}

export const REFERENCE_SETTINGS: PayrollSettings = {
  year: 2026,
  month: 1,
  targetNetSalary: 41400,
  dailyStandardHours: 7.5,
  monthlyStandardHours: 225,
  payrollMonthDays: 30,
  sgkRate: 0.14,
  unemploymentRate: 0.01,
  incomeTaxRate: 0.15,
  stampTaxRate: 0.00759,
  minimumWageIncomeTaxExemption: 4211.33,
  minimumWageStampTaxExemption: 250.7,
  overtimeMultiplier: 1.5,
  holidayWorkMultiplier: 1
};

export const DEFAULT_SETTINGS: PayrollSettings = { ...REFERENCE_SETTINGS };

export function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function sanitizePayrollSettings(settings: PayrollSettings): PayrollSettings {
  return {
    ...settings,
    year: Math.round(clampNumber(settings.year, 2020, 2100, DEFAULT_SETTINGS.year)),
    month: Math.round(clampNumber(settings.month, 1, 12, DEFAULT_SETTINGS.month)),
    targetNetSalary: clampNumber(settings.targetNetSalary, 0, 10_000_000, DEFAULT_SETTINGS.targetNetSalary),
    dailyStandardHours: clampNumber(settings.dailyStandardHours, 0.25, 24, DEFAULT_SETTINGS.dailyStandardHours),
    monthlyStandardHours: clampNumber(settings.monthlyStandardHours, 1, 744, DEFAULT_SETTINGS.monthlyStandardHours),
    payrollMonthDays: Math.round(clampNumber(settings.payrollMonthDays, 1, 31, DEFAULT_SETTINGS.payrollMonthDays)),
    sgkRate: clampNumber(settings.sgkRate, 0, 1, DEFAULT_SETTINGS.sgkRate),
    unemploymentRate: clampNumber(settings.unemploymentRate, 0, 1, DEFAULT_SETTINGS.unemploymentRate),
    incomeTaxRate: clampNumber(settings.incomeTaxRate, 0, 1, DEFAULT_SETTINGS.incomeTaxRate),
    stampTaxRate: clampNumber(settings.stampTaxRate, 0, 1, DEFAULT_SETTINGS.stampTaxRate),
    minimumWageIncomeTaxExemption: clampNumber(settings.minimumWageIncomeTaxExemption, 0, 1_000_000, DEFAULT_SETTINGS.minimumWageIncomeTaxExemption),
    minimumWageStampTaxExemption: clampNumber(settings.minimumWageStampTaxExemption, 0, 100_000, DEFAULT_SETTINGS.minimumWageStampTaxExemption),
    overtimeMultiplier: clampNumber(settings.overtimeMultiplier, 0, 5, DEFAULT_SETTINGS.overtimeMultiplier),
    holidayWorkMultiplier: clampNumber(settings.holidayWorkMultiplier, 0, 5, DEFAULT_SETTINGS.holidayWorkMultiplier)
  };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function clampMoney(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function parseTurkishNumber(value: string): number {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatTRY(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function daysInMonth(year: number, month: number): number {
  const safeYear = Math.round(clampNumber(year, 2020, 2100, DEFAULT_SETTINGS.year));
  const safeMonth = Math.round(clampNumber(month, 1, 12, DEFAULT_SETTINGS.month));
  return new Date(safeYear, safeMonth, 0).getDate();
}

export function computeNetFromGross(grossInput: number, settings: PayrollSettings): PayrollResult {
  settings = sanitizePayrollSettings(settings);
  const gross = round2(clampMoney(grossInput));
  const sgkPremium = round2(gross * settings.sgkRate);
  const unemploymentPremium = round2(gross * settings.unemploymentRate);
  const taxBase = round2(gross - sgkPremium - unemploymentPremium);
  const incomeTaxBeforeExemption = round2(taxBase * settings.incomeTaxRate);
  const incomeTax = round2(Math.max(0, incomeTaxBeforeExemption - settings.minimumWageIncomeTaxExemption));
  const stampTaxBeforeExemption = round2(gross * settings.stampTaxRate);
  const stampTax = round2(Math.max(0, stampTaxBeforeExemption - settings.minimumWageStampTaxExemption));
  const legalTotal = round2(sgkPremium + unemploymentPremium + incomeTax + stampTax);
  const netPay = round2(gross - legalTotal);

  return {
    settings,
    targetGrossSalary: gross,
    dailyNet: round2(settings.targetNetSalary / settings.payrollMonthDays),
    dailyGross: round2(gross / settings.payrollMonthDays),
    hourlyGross: round2(gross / settings.monthlyStandardHours),
    paidDays: settings.payrollMonthDays,
    unpaidDays: 0,
    regularHours: settings.monthlyStandardHours,
    overtimeHours: 0,
    publicHolidayWorkDays: 0,
    totalGross: gross,
    taxBase,
    deductions: {
      sgkPremium,
      unemploymentPremium,
      incomeTaxBeforeExemption,
      incomeTaxExemption: round2(settings.minimumWageIncomeTaxExemption),
      incomeTax,
      stampTaxBeforeExemption,
      stampTaxExemption: round2(settings.minimumWageStampTaxExemption),
      stampTax,
      legalTotal
    },
    netPay,
    netDeltaFromTarget: 0,
    lines: [],
    warnings: []
  };
}

export function findGrossFromNet(targetNet: number, settings: PayrollSettings): number {
  const net = clampMoney(targetNet);
  if (net === 0) return 0;

  let low = net;
  let high = net * 2.5;
  while (computeNetFromGross(high, settings).netPay < net) {
    high *= 1.5;
  }

  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    const computedNet = computeNetFromGross(mid, settings).netPay;
    if (computedNet < net) low = mid;
    else high = mid;
  }

  return round2(high);
}

export function defaultEntriesForMonth(settings: PayrollSettings): ShiftDayEntry[] {
  settings = sanitizePayrollSettings(settings);
  const totalDays = daysInMonth(settings.year, settings.month);
  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const date = toISODate(settings.year, settings.month, day);
    return {
      date,
      status: 'blank',
      workHours: 0,
      overtimeHours: 0,
      workedOnPublicHoliday: false,
      note: ''
    };
  });
}

export function buildReferenceEntries(): ShiftDayEntry[] {
  return Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const isRest = day > 26;
    const isHoliday = day === 1;
    return {
      date: toISODate(2026, 1, day),
      status: isHoliday ? 'public_holiday' : isRest ? 'rest' : 'worked',
      workHours: isHoliday ? 0 : isRest ? 0 : REFERENCE_SETTINGS.dailyStandardHours,
      overtimeHours: 0,
      workedOnPublicHoliday: isHoliday,
      note: isHoliday ? 'Referans bordro resmi tatil calismasi' : ''
    };
  });
}

function sumLine(lines: PayrollLine[], key: string, label: string, days: number, hours: number, gross: number): void {
  const existing = lines.find((line) => line.key === key);
  if (existing) {
    existing.days = round2(existing.days + days);
    existing.hours = round2(existing.hours + hours);
    existing.gross = round2(existing.gross + gross);
  } else if (days || hours || gross) {
    lines.push({ key, label, days: round2(days), hours: round2(hours), gross: round2(gross), net: 0 });
  }
}

function addLineNet(lines: PayrollLine[], key: string, net: number): void {
  const existing = lines.find((line) => line.key === key);
  if (existing) {
    existing.net = round2(existing.net + net);
  }
}

function distributeGrossByNet(lines: PayrollLine[], keys: string[], totalGross: number): number {
  const targets = lines.filter((line) => keys.includes(line.key) && line.net > 0);
  const netTotal = round2(targets.reduce((sum, line) => sum + line.net, 0));
  if (targets.length === 0 || netTotal <= 0 || totalGross <= 0) return 0;

  let allocated = 0;
  const last = targets[targets.length - 1];
  for (const line of targets) {
    const gross = line === last ? round2(totalGross - allocated) : round2((line.net / netTotal) * totalGross);
    line.gross = round2(line.gross + gross);
    allocated = round2(allocated + gross);
  }

  return allocated;
}

function grossIncrementForNet(baseGross: number, targetNetIncrement: number, settings: PayrollSettings): number {
  const targetNet = round2(computeNetFromGross(baseGross, settings).netPay + clampMoney(targetNetIncrement));
  const gross = findGrossFromNet(targetNet, settings);
  return round2(Math.max(0, gross - baseGross));
}

function alignLineNetTotal(lines: PayrollLine[], netPay: number): PayrollLine[] {
  const current = round2(lines.reduce((sum, line) => sum + line.net, 0));
  const delta = round2(netPay - current);
  if (delta === 0) return lines;

  const target = [...lines].reverse().find((line) => line.net > 0) ?? lines[lines.length - 1];
  if (target) target.net = round2(target.net + delta);
  return lines;
}

/**
 * Bir gunun bordroya net katkisini tahmin eder. calculateMonthPayroll icindeki
 * addLineNet mantigini birebir yansitir; takvim hucresinde gunluk neti gostermek
 * icin kullanilir. Ucretli gun ust siniri (payrollMonthDays) burada uygulanmaz,
 * bu yuzden tek gun bazinda tutarli bir tahmindir.
 */
export function estimateDayNet(entry: ShiftDayEntry, dailyNet: number, settings: PayrollSettings): number {
  if (entry.status === 'blank' || entry.status === 'unpaid_leave') return 0;

  let net = dailyNet;
  if (entry.status === 'public_holiday' && entry.workedOnPublicHoliday) {
    net += round2(dailyNet * settings.holidayWorkMultiplier);
  }

  const overtime = clampNumber(entry.overtimeHours, 0, 24, 0);
  if (overtime > 0) {
    net += round2((overtime * dailyNet * settings.overtimeMultiplier) / settings.dailyStandardHours);
  }

  return round2(net);
}

export function calculateMonthPayroll(
  entries: ShiftDayEntry[],
  rawSettings: PayrollSettings
): PayrollResult {
  const settings = sanitizePayrollSettings(rawSettings);
  const targetGrossSalary = findGrossFromNet(settings.targetNetSalary, settings);
  const dailyNet = round2(settings.targetNetSalary / settings.payrollMonthDays);
  const dailyGross = round2(targetGrossSalary / settings.payrollMonthDays);
  const hourlyGross = round2(dailyGross / settings.dailyStandardHours);
  const lines: PayrollLine[] = [];
  const warnings: string[] = [];

  let paidDays = 0;
  let unpaidDays = 0;
  let regularHours = 0;
  let overtimeHours = 0;
  let publicHolidayWorkDays = 0;
  let paidBaseSlots = 0;

  for (const entry of entries) {
    if (entry.status === 'blank') {
      if (entry.workedOnPublicHoliday || entry.overtimeHours > 0 || entry.workHours > 0) {
        warnings.push(`${entry.date}: gun tipi secilmedigi icin saat/mesai kaydi bordroya dahil edilmedi.`);
      }
      continue;
    }

    const isPaid = entry.status !== 'unpaid_leave';
    const isPublicHoliday = entry.status === 'public_holiday';
    const safeWorkHours = clampNumber(entry.workHours, 0, 24, 0);
    const safeOvertimeHours = clampNumber(entry.overtimeHours, 0, 24, 0);
    let baseSlotAdded = false;

    if (isPaid) {
      paidDays += 1;
      if (!isPublicHoliday && paidBaseSlots < settings.payrollMonthDays) {
        paidBaseSlots += 1;
        baseSlotAdded = true;
      }
    } else {
      unpaidDays += 1;
    }

    if (entry.status === 'worked') {
      regularHours += safeWorkHours;
      sumLine(lines, 'normal', 'Normal Calisma', 1, safeWorkHours, 0);
      if (baseSlotAdded) addLineNet(lines, 'normal', dailyNet);
    } else if (entry.status === 'rest') {
      sumLine(lines, 'weekly_rest', 'Hafta Tatili', 1, settings.dailyStandardHours, 0);
      if (baseSlotAdded) addLineNet(lines, 'weekly_rest', dailyNet);
    } else if (entry.status === 'paid_leave') {
      sumLine(lines, 'paid_leave', 'Ucretli Izin', 1, settings.dailyStandardHours, 0);
      if (baseSlotAdded) addLineNet(lines, 'paid_leave', dailyNet);
    } else if (entry.status === 'public_holiday') {
      sumLine(lines, 'public_holiday', 'Genel Tatil', 1, settings.dailyStandardHours, 0);
      addLineNet(lines, 'public_holiday', dailyNet);
    } else {
      sumLine(lines, 'unpaid_leave', 'Ucretsiz Izin / Rapor', 1, 0, 0);
    }

    if (isPublicHoliday && entry.workedOnPublicHoliday) {
      publicHolidayWorkDays += 1;
      sumLine(lines, 'public_holiday_work', 'Genel Tatil Calisti', 1, settings.dailyStandardHours, 0);
      addLineNet(lines, 'public_holiday_work', round2(dailyNet * settings.holidayWorkMultiplier));
    }

    if (!isPublicHoliday && entry.workedOnPublicHoliday) {
      warnings.push(`${entry.date}: resmi tatil disi gunde "resmi tatilde calisti" isareti yok sayildi.`);
    }

    if (safeOvertimeHours > 0) {
      overtimeHours += safeOvertimeHours;
      sumLine(lines, 'overtime', 'Fazla Mesai', 0, safeOvertimeHours, 0);
      addLineNet(lines, 'overtime', round2((safeOvertimeHours * dailyNet * settings.overtimeMultiplier) / settings.dailyStandardHours));
    }
  }

  const paidDayLimit = Math.min(paidDays, settings.payrollMonthDays);
  if (paidDays > settings.payrollMonthDays) {
    const overflow = paidDays - settings.payrollMonthDays;
    warnings.push(`Ucretli gun ${settings.payrollMonthDays} gunle sinirlandi; ${overflow} fazla takvim gunu bordroya eklenmedi.`);
  }

  const baseKeys = ['normal', 'weekly_rest', 'paid_leave'];
  const extraKeys = ['public_holiday', 'public_holiday_work', 'overtime'];
  const baseNet = round2(dailyNet * paidBaseSlots);
  let runningGross = findGrossFromNet(baseNet, settings);
  distributeGrossByNet(lines, baseKeys, runningGross);

  for (const line of lines) {
    if (!extraKeys.includes(line.key) || line.net <= 0) continue;
    const gross = grossIncrementForNet(runningGross, line.net, settings);
    line.gross = round2(line.gross + gross);
    runningGross = round2(runningGross + gross);
  }

  const totalGross = round2(runningGross);
  const computed = computeNetFromGross(totalGross, settings);
  const linesWithNet = alignLineNetTotal(lines, computed.netPay);

  return {
    ...computed,
    settings,
    targetGrossSalary,
    dailyNet,
    dailyGross,
    hourlyGross,
    paidDays: round2(paidDayLimit),
    unpaidDays: round2(unpaidDays),
    regularHours: round2(regularHours),
    overtimeHours: round2(overtimeHours),
    publicHolidayWorkDays: round2(publicHolidayWorkDays),
    totalGross,
    netDeltaFromTarget: round2(computed.netPay - settings.targetNetSalary),
    lines: linesWithNet,
    warnings
  };
}
