import type { DataConfidence } from "./financial-metadata.js";

export interface PaydayTransactionInput {
  id?: string;
  amount: number;
  type: "income" | "expense";
  category?: string;
  categoryId?: string;
  description?: string;
  merchant?: string;
  date?: Date | string;
  occurredAt?: string;
}

export interface PaydayDetectionResult {
  paydayDayOfMonth?: number;
  confidence: DataConfidence;
  evidence: string[];
}

export interface PaydayReflexScoreInput {
  transactions: PaydayTransactionInput[];
  paydayDayOfMonth?: number;
  discretionaryCategories?: string[];
}

export interface PaydayReflexScoreResult {
  score?: number;
  confidence: DataConfidence;
  reasons: string[];
}

const minimumRegularIncomeMonths = 3;
const recentIncomeMonthWindow = 6;
const paydayReflexWindowDays = 3;
const mandatoryCategoryTerms = ["kira", "fatura", "borç", "borc", "aidat", "rent_or_bills", "cat-rent"];

export function detectPayday(transactions: PaydayTransactionInput[]): PaydayDetectionResult {
  const incomeTransactions = transactions
    .filter((transaction) => transaction.type === "income")
    .map((transaction) => ({ transaction, date: transactionDate(transaction) }))
    .filter((item): item is { transaction: PaydayTransactionInput; date: Date } => Boolean(item.date))
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (incomeTransactions.length < minimumRegularIncomeMonths) {
    return {
      confidence: "low",
      evidence: ["Maaş günü tespiti için en az 3 aylık düzenli gelir işlemi bulunmalı."]
    };
  }

  const recent = lastDistinctIncomeMonths(incomeTransactions, recentIncomeMonthWindow);
  const dayGroups = new Map<number, Set<string>>();

  for (const { date } of recent) {
    const day = date.getUTCDate();
    const month = monthKey(date);
    const months = dayGroups.get(day) ?? new Set<string>();
    months.add(month);
    dayGroups.set(day, months);
  }

  const best = [...dayGroups.entries()].sort((left, right) => right[1].size - left[1].size || left[0] - right[0])[0];
  if (!best || best[1].size < minimumRegularIncomeMonths) {
    return {
      confidence: "low",
      evidence: ["Gelir işlemleri aynı ay gününde yeterince düzenli tekrar etmiyor."]
    };
  }

  const observedMonths = new Set(recent.map(({ date }) => monthKey(date))).size;
  const coverage = best[1].size / Math.max(observedMonths, 1);
  const confidence: DataConfidence = coverage >= 0.75 ? "high" : "medium";

  return {
    paydayDayOfMonth: best[0],
    confidence,
    evidence: [`Son ${observedMonths} gelir ayında ayın ${best[0]}. günü ${best[1].size} kez düzenli gelir görüldü.`]
  };
}

export function calculatePaydayReflexScore(input: PaydayReflexScoreInput): PaydayReflexScoreResult {
  const detection = input.paydayDayOfMonth
    ? { paydayDayOfMonth: input.paydayDayOfMonth, confidence: "high" as DataConfidence, evidence: ["Maaş günü dışarıdan sağlandı."] }
    : detectPayday(input.transactions);

  if (!detection.paydayDayOfMonth) {
    return {
      confidence: "low",
      reasons: ["Maaş günü güvenilir şekilde tespit edilemediği için refleks skoru hesaplanmadı.", ...detection.evidence]
    };
  }
  const paydayDayOfMonth = detection.paydayDayOfMonth;

  const expenses = input.transactions
    .filter((transaction) => transaction.type === "expense")
    .map((transaction) => ({ transaction, date: transactionDate(transaction) }))
    .filter((item): item is { transaction: PaydayTransactionInput; date: Date } => Boolean(item.date))
    .filter(({ transaction }) => isDiscretionaryExpense(transaction, input.discretionaryCategories));

  const totalDiscretionary = expenses.reduce((total, { transaction }) => total + transaction.amount, 0);
  if (totalDiscretionary <= 0) {
    return {
      confidence: "low",
      reasons: ["İsteğe bağlı harcama bulunmadığı için maaş sonrası refleks skoru hesaplanmadı."]
    };
  }

  const paydayWindowSpend = expenses
    .filter(({ date }) => isWithinPaydayWindow(date.getUTCDate(), paydayDayOfMonth))
    .reduce((total, { transaction }) => total + transaction.amount, 0);
  const ratio = paydayWindowSpend / totalDiscretionary;
  const score = clamp(Math.round(ratio * 100));

  return {
    score,
    confidence: detection.confidence,
    reasons: [
      `Maaş günü ayın ${paydayDayOfMonth}. günü olarak değerlendirildi.`,
      `Maaş sonrası ${paydayReflexWindowDays} gün içindeki isteğe bağlı harcama oranı %${Math.round(ratio * 100)}.`,
      ...detection.evidence
    ]
  };
}

function lastDistinctIncomeMonths(items: Array<{ transaction: PaydayTransactionInput; date: Date }>, limit: number) {
  const months = new Set<string>();
  const result: Array<{ transaction: PaydayTransactionInput; date: Date }> = [];

  for (const item of [...items].reverse()) {
    const key = monthKey(item.date);
    if (!months.has(key) && months.size >= limit) continue;
    months.add(key);
    result.push(item);
  }

  return result.reverse();
}

function isWithinPaydayWindow(dayOfMonth: number, paydayDayOfMonth: number) {
  return dayOfMonth >= paydayDayOfMonth && dayOfMonth <= paydayDayOfMonth + paydayReflexWindowDays;
}

function isDiscretionaryExpense(transaction: PaydayTransactionInput, discretionaryCategories?: string[]) {
  const text = [transaction.category, transaction.categoryId, transaction.description, transaction.merchant].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
  if (mandatoryCategoryTerms.some((term) => text.includes(term))) return false;
  if (!discretionaryCategories?.length) return true;
  return discretionaryCategories.some((category) => text.includes(category.toLocaleLowerCase("tr-TR")));
}

function transactionDate(transaction: PaydayTransactionInput) {
  const raw = transaction.date ?? transaction.occurredAt;
  if (!raw) return undefined;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}
