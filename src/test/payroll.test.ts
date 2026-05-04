import { describe, expect, it } from 'vitest';
import {
  calculateMonthPayroll,
  computeNetFromGross,
  defaultEntriesForMonth,
  findGrossFromNet,
  REFERENCE_SETTINGS,
  sanitizePayrollSettings,
  toISODate,
  type ShiftDayEntry
} from '../lib/payroll';

function makeEntry(day: number, patch: Partial<ShiftDayEntry> = {}): ShiftDayEntry {
  return {
    date: toISODate(2026, 1, day),
    status: 'worked',
    workHours: 7.5,
    overtimeHours: 0,
    workedOnPublicHoliday: false,
    note: '',
    ...patch
  };
}

describe('payroll engine', () => {
  it('starts a new month with blank employee-entered days', () => {
    const entries = defaultEntriesForMonth(REFERENCE_SETTINGS);
    const result = calculateMonthPayroll(entries, REFERENCE_SETTINGS);

    expect(entries).toHaveLength(31);
    expect(entries.every((entry) => entry.status === 'blank')).toBe(true);
    expect(entries.every((entry) => entry.workHours === 0 && entry.overtimeHours === 0)).toBe(true);
    expect(result.paidDays).toBe(0);
    expect(result.totalGross).toBe(0);
    expect(result.netPay).toBe(0);
  });

  it('matches the supplied January 2026 payslip deductions from gross', () => {
    const result = computeNetFromGross(55528.63, REFERENCE_SETTINGS);

    expect(result.deductions.sgkPremium).toBe(7774.01);
    expect(result.deductions.unemploymentPremium).toBe(555.29);
    expect(result.taxBase).toBe(47199.33);
    expect(result.deductions.incomeTax).toBe(2868.57);
    expect(result.deductions.stampTax).toBe(170.76);
    expect(result.deductions.legalTotal).toBe(11368.63);
    expect(result.netPay).toBe(44160);
  });

  it('finds the gross value needed for the reference net salary', () => {
    expect(findGrossFromNet(44160, REFERENCE_SETTINGS)).toBe(55528.63);
  });

  it('keeps a regular 30-day month on the target net salary', () => {
    const entries = Array.from({ length: 30 }, (_, index) => makeEntry(index + 1));
    const result = calculateMonthPayroll(entries, REFERENCE_SETTINGS);

    expect(result.paidDays).toBe(30);
    expect(result.totalGross).toBe(55528.63);
    expect(Math.abs(result.netPay - REFERENCE_SETTINGS.targetNetSalary)).toBeLessThanOrEqual(0.1);
  });

  it('separates weekly rest, public holiday work, and overtime rows', () => {
    const entries = [
      ...Array.from({ length: 25 }, (_, index) => makeEntry(index + 1)),
      ...Array.from({ length: 5 }, (_, index) => makeEntry(index + 26, { status: 'rest', workHours: 0 })),
      makeEntry(31, { status: 'public_holiday', workHours: 0, workedOnPublicHoliday: true, overtimeHours: 2 })
    ];

    const result = calculateMonthPayroll(entries, REFERENCE_SETTINGS);
    const keys = result.lines.map((line) => line.key);

    expect(keys).toContain('normal');
    expect(keys).toContain('weekly_rest');
    expect(keys).toContain('public_holiday');
    expect(keys).toContain('public_holiday_work');
    expect(keys).toContain('overtime');
    expect(result.publicHolidayWorkDays).toBe(1);
    expect(result.overtimeHours).toBe(2);
    expect(result.warnings).toHaveLength(1);
  });

  it('ignores public-holiday-work flags on non-holiday days', () => {
    const result = calculateMonthPayroll(
      [makeEntry(1, { workedOnPublicHoliday: true })],
      REFERENCE_SETTINGS
    );

    expect(result.lines.some((line) => line.key === 'public_holiday_work')).toBe(false);
    expect(result.warnings[0]).toContain('resmi tatil disi');
  });

  it('does not count hours on a blank day until the employee chooses a day type', () => {
    const result = calculateMonthPayroll(
      [makeEntry(1, { status: 'blank', workHours: 7.5, overtimeHours: 2 })],
      REFERENCE_SETTINGS
    );

    expect(result.totalGross).toBe(0);
    expect(result.lines).toHaveLength(0);
    expect(result.warnings[0]).toContain('gun tipi secilmedigi');
  });

  it('sanitizes invalid calendar settings before generating month entries', () => {
    const settings = sanitizePayrollSettings({
      ...REFERENCE_SETTINGS,
      year: Number.NaN,
      month: 0,
      dailyStandardHours: Number.POSITIVE_INFINITY,
      monthlyStandardHours: -10,
      overtimeMultiplier: 999
    });
    const entries = defaultEntriesForMonth(settings);

    expect(settings.year).toBe(REFERENCE_SETTINGS.year);
    expect(settings.month).toBe(1);
    expect(settings.dailyStandardHours).toBe(REFERENCE_SETTINGS.dailyStandardHours);
    expect(settings.monthlyStandardHours).toBe(1);
    expect(settings.overtimeMultiplier).toBe(5);
    expect(entries[0].date).toBe('2026-01-01');
    expect(entries).toHaveLength(31);
  });

  it('keeps payroll calculation finite when settings contain invalid numeric values', () => {
    const result = calculateMonthPayroll(
      [makeEntry(1, { workHours: Number.NaN, overtimeHours: Number.POSITIVE_INFINITY })],
      {
        ...REFERENCE_SETTINGS,
        year: 0,
        month: 99,
        targetNetSalary: Number.NaN,
        dailyStandardHours: Number.NaN,
        monthlyStandardHours: Number.NaN,
        payrollMonthDays: Number.NaN
      }
    );

    expect(Number.isFinite(result.totalGross)).toBe(true);
    expect(Number.isFinite(result.netPay)).toBe(true);
    expect(result.settings.year).toBe(2020);
    expect(result.settings.month).toBe(12);
  });
});
