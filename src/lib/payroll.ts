export type DayStatus = 'worked' | 'paid_leave' | 'unpaid_leave' | 'rest' | 'public_holiday';

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
  targetNetSalary: 44160,
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
  return new Date(year, month, 0).getDate();
}

export function computeNetFromGross(grossInput: number, settings: PayrollSettings): PayrollResult {
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
  const totalDays = daysInMonth(settings.year, settings.month);
  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const date = toISODate(settings.year, settings.month, day);
    const weekday = new Date(settings.year, settings.month - 1, day).getDay();
    const isReferenceHoliday = settings.year === 2026 && settings.month === 1 && day === 1;
    const isRest = weekday === 0;
    return {
      date,
      status: isReferenceHoliday ? 'public_holiday' : isRest ? 'rest' : 'worked',
      workHours: isReferenceHoliday ? 0 : isRest ? 0 : settings.dailyStandardHours,
      overtimeHours: 0,
      workedOnPublicHoliday: isReferenceHoliday,
      note: isReferenceHoliday ? 'Yilbasi resmi tatil calismasi' : ''
    };
  });
}

export function buildReferenceEntries(): ShiftDayEntry[] {
  return Array.from({ length: 30 }, (_, index) => {
    const day = index + 1;
    const isRest = day > 25;
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
    lines.push({ key, label, days: round2(days), hours: round2(hours), gross: round2(gross) });
  }
}

export function calculateMonthPayroll(
  entries: ShiftDayEntry[],
  rawSettings: PayrollSettings
): PayrollResult {
  const settings = {
    ...rawSettings,
    targetNetSalary: clampMoney(rawSettings.targetNetSalary),
    dailyStandardHours: Math.max(0.01, rawSettings.dailyStandardHours),
    monthlyStandardHours: Math.max(0.01, rawSettings.monthlyStandardHours),
    payrollMonthDays: Math.max(1, rawSettings.payrollMonthDays)
  };
  const targetGrossSalary = findGrossFromNet(settings.targetNetSalary, settings);
  const dailyGross = round2(targetGrossSalary / settings.payrollMonthDays);
  const hourlyGross = round2(targetGrossSalary / settings.monthlyStandardHours);
  const lines: PayrollLine[] = [];
  const warnings: string[] = [];

  let paidDays = 0;
  let unpaidDays = 0;
  let regularHours = 0;
  let overtimeHours = 0;
  let publicHolidayWorkDays = 0;
  let baseGross = 0;
  let extraGross = 0;
  let paidBaseSlots = 0;

  for (const entry of entries) {
    const isPaid = entry.status !== 'unpaid_leave';
    const isPublicHoliday = entry.status === 'public_holiday';
    const safeWorkHours = Math.max(0, entry.workHours || 0);
    const safeOvertimeHours = Math.max(0, entry.overtimeHours || 0);
    let baseGrossForDay = 0;

    if (isPaid) {
      paidDays += 1;
      if (paidBaseSlots < settings.payrollMonthDays) {
        paidBaseSlots += 1;
        baseGrossForDay = dailyGross;
        baseGross += baseGrossForDay;
      }
    } else {
      unpaidDays += 1;
    }

    if (entry.status === 'worked') {
      regularHours += safeWorkHours;
      sumLine(lines, 'normal', 'Normal Calisma', 1, safeWorkHours, baseGrossForDay);
    } else if (entry.status === 'rest') {
      sumLine(lines, 'weekly_rest', 'Hafta Tatili', 1, settings.dailyStandardHours, baseGrossForDay);
    } else if (entry.status === 'paid_leave') {
      sumLine(lines, 'paid_leave', 'Ucretli Izin', 1, settings.dailyStandardHours, baseGrossForDay);
    } else if (entry.status === 'public_holiday') {
      sumLine(lines, 'public_holiday', 'Genel Tatil', 1, settings.dailyStandardHours, baseGrossForDay);
    } else {
      sumLine(lines, 'unpaid_leave', 'Ucretsiz Izin / Rapor', 1, 0, 0);
    }

    if (isPublicHoliday && entry.workedOnPublicHoliday) {
      publicHolidayWorkDays += 1;
      const holidayGross = round2(dailyGross * settings.holidayWorkMultiplier);
      extraGross += holidayGross;
      sumLine(lines, 'public_holiday_work', 'Genel Tatil Calisti', 1, settings.dailyStandardHours, holidayGross);
    }

    if (!isPublicHoliday && entry.workedOnPublicHoliday) {
      warnings.push(`${entry.date}: resmi tatil disi gunde "resmi tatilde calisti" isareti yok sayildi.`);
    }

    if (safeOvertimeHours > 0) {
      overtimeHours += safeOvertimeHours;
      const overtimeGross = round2(safeOvertimeHours * hourlyGross * settings.overtimeMultiplier);
      extraGross += overtimeGross;
      sumLine(lines, 'overtime', 'Fazla Mesai', 0, safeOvertimeHours, overtimeGross);
    }
  }

  const paidDayLimit = Math.min(paidDays, settings.payrollMonthDays);
  if (paidDays > settings.payrollMonthDays) {
    const overflow = paidDays - settings.payrollMonthDays;
    warnings.push(`Ucretli gun ${settings.payrollMonthDays} gunle sinirlandi; ${overflow} fazla takvim gunu bordroya eklenmedi.`);
  }

  const expectedBaseGross = round2(targetGrossSalary * (paidBaseSlots / settings.payrollMonthDays));
  const baseAdjustment = round2(expectedBaseGross - baseGross);
  if (baseAdjustment !== 0 && lines.length > 0) {
    const targetLine = lines.find((line) => line.gross > 0);
    if (targetLine) {
      targetLine.gross = round2(targetLine.gross + baseAdjustment);
      baseGross = expectedBaseGross;
    }
  }

  const totalGross = round2(baseGross + extraGross);
  const computed = computeNetFromGross(totalGross, settings);

  return {
    ...computed,
    settings,
    targetGrossSalary,
    dailyGross,
    hourlyGross,
    paidDays: round2(paidDayLimit),
    unpaidDays: round2(unpaidDays),
    regularHours: round2(regularHours),
    overtimeHours: round2(overtimeHours),
    publicHolidayWorkDays: round2(publicHolidayWorkDays),
    totalGross,
    netDeltaFromTarget: round2(computed.netPay - settings.targetNetSalary),
    lines,
    warnings
  };
}
