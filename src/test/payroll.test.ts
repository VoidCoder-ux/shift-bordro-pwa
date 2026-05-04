import { describe, expect, it } from 'vitest';
import {
  calculateMonthPayroll,
  computeNetFromGross,
  findGrossFromNet,
  REFERENCE_SETTINGS,
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
});
