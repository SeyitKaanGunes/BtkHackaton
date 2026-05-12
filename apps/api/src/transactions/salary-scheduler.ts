export const AUTO_SALARY_TAG = "auto_salary";
export const SALARY_MERCHANT = "Maaş";
export const SALARY_OCCURRED_AT_UTC_HOUR = 9;

export function normalizePayday(value: number): number {
  return Math.max(1, Math.min(31, Math.trunc(value)));
}

export function salaryTransactionId(userId: string, monthKey: string): string {
  return `tx-auto-salary-${userId}-${monthKey}`;
}

export function salaryMonthKey(input: Date | string): string {
  const date = typeof input === "string" ? parseReferenceDate(input) : input;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseReferenceDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  const trimmed = input.trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? new Date(`${trimmed}T12:00:00.000Z`) : new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function salaryDueDateForMonth(monthKey: string, payday: number): Date {
  const [year, month] = monthKey.split("-").map(Number);
  const safeYear = Number.isInteger(year) ? year : new Date().getUTCFullYear();
  const safeMonth = Number.isInteger(month) ? month : new Date().getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(safeYear, safeMonth, 0)).getUTCDate();
  const day = Math.min(normalizePayday(payday), lastDay);
  return new Date(Date.UTC(safeYear, safeMonth - 1, day, SALARY_OCCURRED_AT_UTC_HOUR, 0, 0, 0));
}

export function isSalaryDueForMonth(monthKey: string, payday: number, referenceDate: Date | string): boolean {
  return salaryDueDateForMonth(monthKey, payday).getTime() <= parseReferenceDate(referenceDate).getTime();
}

export function nextSalaryMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? new Date().getUTCFullYear(), (month ?? 1) - 1 + 1, 1));
  return salaryMonthKey(date);
}

export function salaryMonthRange(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let cursor = startKey;
  for (let guard = 0; guard < 240 && cursor <= endKey; guard += 1) {
    keys.push(cursor);
    cursor = nextSalaryMonthKey(cursor);
  }
  return keys;
}
