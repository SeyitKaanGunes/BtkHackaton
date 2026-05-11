import { categories } from "./category-catalog.js";
import { buildFinancialMetadata, type DataConfidence, type FinancialDataAvailability } from "./financial-metadata.js";
import { calculatePaydayReflexScore, detectPayday, type PaydayTransactionInput } from "./payday-detector.js";
import { isLocalNight, isLocalWeekend, isLocalWeekendNight, resolveTimeZone } from "./timezone.js";
import type {
  Account,
  ActionItem,
  AgentEvidence,
  AiCfoSimulation,
  Budget,
  Business,
  BusinessDashboard,
  BusinessCashEvent,
  BusinessCustomer,
  CollectionScore,
  DashboardPeriod,
  DashboardPeriodOptions,
  DashboardSummary,
  Goal,
  RiskLevel,
  ScenarioCard,
  SpendingDna,
  SpendingDnaCategory,
  SpendingDnaMetric,
  SubscriptionLeak,
  Subscription,
  Transaction,
  UserProfile,
  WhatIfRequest,
  WhatIfResponse
} from "./types.js";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const validDashboardPeriods = new Set<DashboardPeriod>(["daily", "weekly", "monthly", "yearly"]);
const historicalRiskWindowMonths = 3;
const safeCashSafetyFactor = 0.75;
const balancedCashFactor = 0.45;
const whatIfBalancedMultiplier = 0.7;
const mandatoryCategoryTerms = ["kira", "fatura", "aidat", "borç", "borc", "rent_or_bills"];
const emergencyGoalPattern = /acil|emergency/i;

const riskFromScore = (score: number): RiskLevel => {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
};

const confidenceScore = (confidence: DataConfidence) => ({ high: 0.9, medium: 0.65, low: 0.35 })[confidence];

const confidenceFromRatio = (ratio: number): DataConfidence => {
  if (ratio >= 0.75) return "high";
  if (ratio >= 0.4) return "medium";
  return "low";
};

const metric = (score: number, confidence: DataConfidence, reasons: string[]): SpendingDnaMetric => ({
  score: clamp(score),
  confidence,
  reasons: reasons.length ? reasons : ["Bu metrik için yeterli açıklama sinyali bulunamadı."]
});

const monthKey = (iso: string) => iso.slice(0, 7);

function latestMonthKey(sourceTransactions: Transaction[]) {
  let latest = "";
  for (const transaction of sourceTransactions) {
    if (transaction.occurredAt > latest) latest = transaction.occurredAt;
  }
  return latest ? monthKey(latest) : monthKey(new Date().toISOString());
}

function monthLabelFromKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function parseUtcDate(iso: string) {
  const date = new Date(iso);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function resolveReferenceDate(sourceTransactions: Transaction[], requested?: string) {
  if (requested) {
    const date = new Date(`${requested.slice(0, 10)}T00:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const latest = sourceTransactions.reduce((current, transaction) => (transaction.occurredAt > current ? transaction.occurredAt : current), "");
  return latest ? parseUtcDate(latest) : parseUtcDate(new Date().toISOString());
}

function formatPeriodLabel(period: DashboardPeriod, startDate: Date, endExclusive: Date) {
  const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  if (period === "daily") return dateFormatter.format(startDate);
  if (period === "weekly") {
    const endDate = addUtcDays(endExclusive, -1);
    return `${new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(startDate)} - ${dateFormatter.format(endDate)}`;
  }
  if (period === "yearly") return new Intl.DateTimeFormat("tr-TR", { year: "numeric" }).format(startDate);
  return monthLabelFromKey(dateKey(startDate).slice(0, 7));
}

function getPeriodRange(period: DashboardPeriod, referenceDate: Date) {
  const startDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
  if (period === "daily") return { startDate, endExclusive: addUtcDays(startDate, 1) };
  if (period === "weekly") {
    const day = startDate.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const weekStart = addUtcDays(startDate, mondayOffset);
    return { startDate: weekStart, endExclusive: addUtcDays(weekStart, 7) };
  }
  if (period === "yearly") {
    const yearStart = new Date(Date.UTC(startDate.getUTCFullYear(), 0, 1));
    return { startDate: yearStart, endExclusive: new Date(Date.UTC(startDate.getUTCFullYear() + 1, 0, 1)) };
  }
  const monthStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  return { startDate: monthStart, endExclusive: new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1)) };
}

function periodBudgetMultiplier(period: DashboardPeriod) {
  return {
    daily: 1 / 30,
    weekly: 7 / 30,
    monthly: 1,
    yearly: 12
  }[period];
}

export function normalizeDashboardPeriod(period?: DashboardPeriodOptions["period"]): DashboardPeriod {
  return typeof period === "string" && validDashboardPeriods.has(period as DashboardPeriod) ? (period as DashboardPeriod) : "monthly";
}

function positiveAmount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function getCategoryName(categoryId: string): string {
  return categories.find((category) => category.id === categoryId)?.name ?? "Diğer";
}

function isMandatoryCategory(categoryId?: string) {
  const name = categoryId ? getCategoryName(categoryId) : "";
  const text = `${categoryId ?? ""} ${name}`.toLocaleLowerCase("tr-TR");
  return categoryId === "cat-rent" || mandatoryCategoryTerms.some((term) => text.includes(term));
}

function isDiscretionaryTransaction(transaction: Transaction) {
  return transaction.type === "expense" && !isMandatoryCategory(transaction.categoryId);
}

function toPaydayInput(transaction: Transaction): PaydayTransactionInput {
  return {
    id: transaction.id,
    amount: transaction.amount,
    type: transaction.type,
    categoryId: transaction.categoryId,
    category: getCategoryName(transaction.categoryId),
    description: transaction.merchant,
    merchant: transaction.merchant,
    occurredAt: transaction.occurredAt
  };
}

function historicalMonthlyAverage(sourceTransactions: Transaction[], categoryId: string, referenceMonth: string) {
  const grouped = new Map<string, number>();
  for (const transaction of sourceTransactions) {
    const key = monthKey(transaction.occurredAt);
    if (transaction.type !== "expense" || transaction.categoryId !== categoryId || key >= referenceMonth) continue;
    grouped.set(key, (grouped.get(key) ?? 0) + transaction.amount);
  }

  const recentValues = [...grouped.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, historicalRiskWindowMonths)
    .map(([, value]) => value);

  return recentValues.length ? sum(recentValues) / recentValues.length : 0;
}

function stableScenarioId(categoryId: string, amount: number, id?: ScenarioCard["id"]) {
  return [`what-if`, categoryId, Math.round(amount), id].filter(Boolean).join("-");
}

function confidenceLabel(confidence: DataConfidence) {
  return { high: "Yüksek", medium: "Orta", low: "Düşük" }[confidence];
}

function metadataAvailability(input: {
  accounts?: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals?: Goal[];
  hasFixedExpenses?: boolean;
  hasDebtPayments?: boolean;
}) {
  const income = input.transactions.some((transaction) => transaction.type === "income");
  const emergencyBuffer = input.goals?.some((goal) => emergencyGoalPattern.test(goal.title));
  return {
    hasBalance: input.accounts ? input.accounts.length > 0 : true,
    hasTransactions: input.transactions.length > 0,
    hasBudgets: input.budgets.length > 0,
    hasIncome: income,
    hasFixedExpenses: input.hasFixedExpenses ?? input.transactions.some((transaction) => transaction.type === "expense" && transaction.recurring === true),
    hasDebtPayments: input.hasDebtPayments ?? false,
    hasPlannedSavings: input.goals ? input.goals.length > 0 : false,
    hasEmergencyBuffer: emergencyBuffer ?? false
  } satisfies FinancialDataAvailability;
}

export function summarizeMonth(
  sourceTransactions: Transaction[],
  selectedMonth = latestMonthKey(sourceTransactions)
) {
  const monthTransactions = sourceTransactions.filter((transaction) => monthKey(transaction.occurredAt) === selectedMonth);
  const income = sum(monthTransactions.filter((transaction) => transaction.type === "income").map((transaction) => transaction.amount));
  const expenses = sum(monthTransactions.filter((transaction) => transaction.type === "expense").map((transaction) => transaction.amount));
  return { month: selectedMonth, monthTransactions, income, expenses, net: income - expenses };
}

export function summarizePeriod(
  sourceTransactions: Transaction[],
  options: DashboardPeriodOptions = {}
) {
  const period = normalizeDashboardPeriod(options.period);
  const referenceDate = resolveReferenceDate(sourceTransactions, options.referenceDate);
  const { startDate, endExclusive } = getPeriodRange(period, referenceDate);
  const periodTransactions = sourceTransactions.filter((transaction) => {
    const transactionDate = parseUtcDate(transaction.occurredAt);
    return transactionDate >= startDate && transactionDate < endExclusive;
  });
  const income = sum(periodTransactions.filter((transaction) => transaction.type === "income").map((transaction) => transaction.amount));
  const expenses = sum(periodTransactions.filter((transaction) => transaction.type === "expense").map((transaction) => transaction.amount));
  return {
    period,
    periodLabel: formatPeriodLabel(period, startDate, endExclusive),
    periodStart: dateKey(startDate),
    periodEnd: dateKey(addUtcDays(endExclusive, -1)),
    periodTransactions,
    income,
    expenses,
    net: income - expenses
  };
}

export function calculateSpendingDna(
  sourceTransactions: Transaction[],
  sourceBudgets: Budget[],
  options: DashboardPeriodOptions = {}
): SpendingDna {
  const period = normalizeDashboardPeriod(options.period);
  const timeZone = resolveTimeZone(options.timeZone);
  const summary = summarizePeriod(sourceTransactions, { ...options, period });
  const budgetMultiplier = periodBudgetMultiplier(period);
  const expenseTransactions = summary.periodTransactions.filter((transaction) => transaction.type === "expense");
  const userId = sourceTransactions[0]?.userId ?? sourceBudgets[0]?.userId ?? "current-user";
  const metadata = buildFinancialMetadata(metadataAvailability({ transactions: sourceTransactions, budgets: sourceBudgets }));
  if (expenseTransactions.length === 0) {
    const emptyMetric = metric(0, "low", ["Seçili dönemde harcama işlemi bulunmadığı için metrik hesaplanmadı."]);
    return {
      userId,
      overallRisk: 0,
      paydayReflexScore: 0,
      weekendNightScore: 0,
      campaignSensitivity: 0,
      savingDiscipline: 0,
      categories: [],
      patterns: ["Harcama verisi eklendiğinde Spending DNA davranış profili oluşacak."],
      nightSpendingScore: 0,
      weekendSpendingScore: 0,
      dataConfidence: 0,
      dataConfidenceLevel: "low",
      missingData: metadata.missingData,
      reasons: ["Seçili dönemde harcama işlemi bulunmadığı için zaman bazlı skorlar hesaplanmadı."],
      timeZone,
      metrics: {
        overallRisk: emptyMetric,
        paydayReflexScore: emptyMetric,
        nightSpendingScore: emptyMetric,
        weekendSpendingScore: emptyMetric,
        weekendNightScore: emptyMetric,
        campaignSensitivity: emptyMetric,
        savingDiscipline: emptyMetric
      },
      metadata
    };
  }

  const referenceMonth = summary.periodStart.slice(0, 7);
  const categoryRisks = categories
    .filter((category) => category.kind === "expense")
    .map((category): SpendingDnaCategory => {
      const categorySpend = sum(expenseTransactions.filter((transaction) => transaction.categoryId === category.id).map((transaction) => transaction.amount));
      const budget = sourceBudgets.find((item) => item.categoryId === category.id);
      const periodLimit = budget ? budget.monthlyLimit * budgetMultiplier : undefined;
      const mandatory = isMandatoryCategory(category.id);
      const hasBudget = periodLimit !== undefined;
      const historicalAverage = historicalMonthlyAverage(sourceTransactions, category.id, referenceMonth);
      let riskScore = 0;
      let confidence: DataConfidence = "low";
      const reasons: string[] = [];

      if (periodLimit !== undefined) {
        const usageRatio = periodLimit > 0 ? categorySpend / periodLimit : 0;
        riskScore = clamp(usageRatio * 100);
        confidence = "high";
        reasons.push(`${category.name} kategorisi için bütçenin %${Math.round(usageRatio * 100)}'i kullanılmış.`);
      } else if (historicalAverage > 0 && categorySpend > 0) {
        const deviationRatio = categorySpend / historicalAverage;
        riskScore = clamp(30 + (deviationRatio - 1) * 35, 0, mandatory ? 70 : 100);
        confidence = "medium";
        reasons.push(`Bu ay ${category.name} harcaman son ${historicalRiskWindowMonths} ay ortalamanın ${deviationRatio.toFixed(1)} katı.`);
        reasons.push("Bu kategori için bütçe tanımlı olmadığı için güven orta seviyede tutuldu.");
      } else if (categorySpend > 0) {
        riskScore = mandatory ? 20 : 30;
        confidence = "low";
        reasons.push("Bu kategori için bütçe ve yeterli geçmiş veri bulunmadığı için güven düşük.");
        if (mandatory) reasons.push(`${category.name} zorunlu gider olarak değerlendirildi; yüksek tutar otomatik 100 risk yapılmadı.`);
      } else {
        confidence = "low";
        reasons.push(`${category.name} kategorisinde seçili dönemde harcama bulunmadı.`);
      }

      return {
        categoryId: category.id,
        categoryName: category.name,
        riskScore,
        riskLevel: riskFromScore(riskScore),
        monthlySpend: categorySpend,
        budgetLimit: periodLimit ? Math.round(periodLimit) : undefined,
        dataConfidence: confidenceScore(confidence),
        confidence,
        reasons,
        explanation: metric(riskScore, confidence, reasons)
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);

  const nightTransactions = expenseTransactions.filter((transaction) => isLocalNight(transaction.occurredAt, timeZone));
  const weekendTransactions = expenseTransactions.filter((transaction) => isLocalWeekend(transaction.occurredAt, timeZone));
  const weekendNightTransactions = expenseTransactions.filter((transaction) => isLocalWeekendNight(transaction.occurredAt, timeZone));
  const paydayReflex = calculatePaydayReflexScore({ transactions: sourceTransactions.map(toPaydayInput) });
  const discretionaryTransactions = expenseTransactions.filter(isDiscretionaryTransaction);
  const campaignTransactions = discretionaryTransactions.filter((transaction) => transaction.tags?.includes("campaign"));
  const totalExpense = Math.max(sum(expenseTransactions.map((transaction) => transaction.amount)), 1);
  const incomeBase = Math.max(summary.income, totalExpense, 1);
  const savingDiscipline = clamp(100 - (totalExpense / incomeBase) * 100 + 28);
  const topCategory = categoryRisks.find((category) => category.monthlySpend > 0);
  const nightRatio = sum(nightTransactions.map((transaction) => transaction.amount)) / totalExpense;
  const weekendRatio = sum(weekendTransactions.map((transaction) => transaction.amount)) / totalExpense;
  const weekendNightRatio = sum(weekendNightTransactions.map((transaction) => transaction.amount)) / totalExpense;
  const discretionarySpend = Math.max(sum(discretionaryTransactions.map((transaction) => transaction.amount)), 0);
  const campaignSpend = sum(campaignTransactions.map((transaction) => transaction.amount));
  const campaignSpendShareScore = discretionarySpend > 0 ? (campaignSpend / discretionarySpend) * 100 : 0;
  const campaignFrequencyScore = discretionaryTransactions.length > 0 ? (campaignTransactions.length / discretionaryTransactions.length) * 100 : 0;
  const postCampaignBudgetBreach = campaignTransactions.some((transaction) => {
    const budget = sourceBudgets.find((item) => item.categoryId === transaction.categoryId);
    if (!budget) return false;
    const spend = sum(expenseTransactions.filter((item) => item.categoryId === transaction.categoryId).map((item) => item.amount));
    return spend > budget.monthlyLimit * budgetMultiplier;
  });
  const postCampaignBudgetBreachScore = postCampaignBudgetBreach ? 100 : 0;
  const campaignSensitivity = clamp(campaignSpendShareScore * 0.4 + campaignFrequencyScore * 0.3 + postCampaignBudgetBreachScore * 0.3);
  const categoryConfidence = confidenceFromRatio(
    sum(categoryRisks.filter((category) => category.monthlySpend > 0).map((category) => confidenceScore(category.confidence ?? "low"))) /
      Math.max(categoryRisks.filter((category) => category.monthlySpend > 0).length, 1)
  );
  const patterns = [
    topCategory
      ? `${topCategory.categoryName} kategorisi bu dönemin en belirgin harcama sinyali: ${topCategory.monthlySpend.toLocaleString("tr-TR")} TL.`
      : undefined,
    nightRatio >= 0.2 ? "Lokal saate göre gece harcamaları bütçe sapmasına anlamlı katkı veriyor." : undefined,
    weekendRatio >= 0.2 ? "Lokal hafta sonu harcamaları ayrıca izlenmeli." : undefined,
    weekendNightRatio >= 0.15 ? "Hafta sonu gece harcamaları belirgin bir risk sinyali oluşturuyor." : undefined,
    campaignTransactions.length > 0 ? "Kampanya etiketli işlemler harcama kararlarında ayrıca izlenmeli." : undefined
  ].filter((pattern): pattern is string => Boolean(pattern));
  const overallRisk = clamp(sum(categoryRisks.slice(0, 3).map((category) => category.riskScore)) / 3);
  const paydayScore = paydayReflex.score ?? 0;
  const nightScore = clamp(nightRatio * 100);
  const weekendScore = clamp(weekendRatio * 100);
  const weekendNightScore = clamp(weekendNightRatio * 100);
  const savingDisciplineConfidence: DataConfidence = summary.income > 0 ? "high" : "low";
  const metrics = {
    overallRisk: metric(overallRisk, categoryConfidence, [
      `Genel risk en yüksek 3 kategori riskinin ortalamasıyla hesaplandı: ${overallRisk}/100.`,
      topCategory ? `En yüksek sinyal ${topCategory.categoryName} kategorisinde.` : "Belirgin kategori riski bulunmadı."
    ]),
    paydayReflexScore: metric(paydayScore, paydayReflex.confidence, paydayReflex.reasons),
    nightSpendingScore: metric(nightScore, "high", [`Gece harcamalarının toplam harcamalara oranı %${Math.round(nightRatio * 100)}.`]),
    weekendSpendingScore: metric(weekendScore, "high", [`Hafta sonu harcamalarının toplam harcamalara oranı %${Math.round(weekendRatio * 100)}.`]),
    weekendNightScore: metric(weekendNightScore, "high", [`Hafta sonu gece harcamalarının toplam harcamalara oranı %${Math.round(weekendNightRatio * 100)}.`]),
    campaignSensitivity: metric(
      campaignSensitivity,
      campaignTransactions.length > 0 ? "high" : "low",
      campaignTransactions.length > 0
        ? [
            `Kampanya etiketli harcamaların isteğe bağlı harcamalar içindeki payı %${Math.round(campaignSpendShareScore)}.`,
            `Kampanya etiketli işlem frekansı %${Math.round(campaignFrequencyScore)}.`,
            postCampaignBudgetBreach ? "Kampanya sonrası en az bir kategori bütçesi aşıldı." : "Kampanya sonrası bütçe aşımı sinyali görülmedi."
          ]
        : ["Kampanya etiketli isteğe bağlı harcama bulunmadığı için kampanya hassasiyeti düşük güvenle 0 hesaplandı."]
    ),
    savingDiscipline: metric(savingDiscipline, savingDisciplineConfidence, [
      summary.income > 0
        ? `Gelir/gider dengesi ${summary.net.toLocaleString("tr-TR")} TL olduğu için tasarruf disiplini hesaplandı.`
        : "Gelir verisi bulunmadığı için tasarruf disiplini düşük güvenle hesaplandı."
    ])
  };

  return {
    userId,
    overallRisk,
    paydayReflexScore: paydayScore,
    nightSpendingScore: nightScore,
    weekendSpendingScore: weekendScore,
    weekendNightScore,
    campaignSensitivity,
    savingDiscipline,
    categories: categoryRisks,
    patterns: patterns.length ? patterns : ["Harcama dağılımı şu an belirgin bir risk deseni göstermiyor."],
    dataConfidence: confidenceScore(metadata.dataConfidence),
    dataConfidenceLevel: metadata.dataConfidence,
    missingData: metadata.missingData,
    reasons: [
      `Zaman bazlı skorlar ${timeZone} lokal saatine göre hesaplandı.`,
      metadata.dataConfidence !== "high" ? "Bazı finansal veri alanları eksik olduğu için genel güven düşürüldü." : "Harcama riskleri bütçe, gelir ve işlem verisiyle destekleniyor."
    ],
    timeZone,
    metrics,
    metadata
  };
}

export function calculateDashboardSummary(
  sourceAccounts: Account[],
  sourceTransactions: Transaction[],
  sourceGoals: Goal[],
  sourceActions: ActionItem[],
  sourceBudgets: Budget[],
  options: DashboardPeriodOptions = {}
): DashboardSummary {
  const summary = summarizePeriod(sourceTransactions, options);
  const expenseTransactions = summary.periodTransactions.filter((transaction) => transaction.type === "expense");
  const categoryBreakdown = categories
    .filter((category) => category.kind === "expense")
    .map((category) => ({
      categoryId: category.id,
      name: category.name,
      value: sum(expenseTransactions.filter((transaction) => transaction.categoryId === category.id).map((transaction) => transaction.amount)),
      color: category.color
    }))
    .filter((item) => item.value > 0);
  const dna = calculateSpendingDna(sourceTransactions, sourceBudgets, options);
  const accountBalance = sum(sourceAccounts.map((account) => account.balance));
  const savingsRate = summary.income > 0 ? ((summary.income - summary.expenses) / summary.income) * 100 : 0;
  const hasFinancialActivity = sourceTransactions.length > 0 || accountBalance !== 0 || sourceGoals.length > 0 || sourceActions.length > 0;
  const financialHealthScore = hasFinancialActivity ? clamp(62 + savingsRate * 0.35 - dna.overallRisk * 0.25 + (accountBalance > 0 ? 8 : -12)) : 0;
  const topRiskCategory = dna.categories.find((category) => category.riskScore >= 65);

  return {
    period: summary.period,
    periodLabel: summary.periodLabel,
    periodStart: summary.periodStart,
    periodEnd: summary.periodEnd,
    income: summary.income,
    expenses: summary.expenses,
    balance: accountBalance,
    savingsRate: Math.round(savingsRate),
    financialHealthScore,
    categoryBreakdown,
    upcomingActions: sourceActions.filter((action) => action.status === "pending"),
    goals: sourceGoals,
    riskAlerts: topRiskCategory
      ? [
          {
            title: `${topRiskCategory.categoryName} bütçe riski`,
            description: `${topRiskCategory.categoryName} kategorisi seçili dönemde ${topRiskCategory.monthlySpend.toLocaleString("tr-TR")} TL seviyesinde.`,
            level: topRiskCategory.riskLevel
          }
        ]
      : []
  };
}

export function calculateCampaignReadiness(
  sourceTransactions: Transaction[],
  sourceBudgets: Budget[],
  options: DashboardPeriodOptions = {}
) {
  const period = normalizeDashboardPeriod(options.period);
  const summary = summarizePeriod(sourceTransactions, { ...options, period });
  const expenseTransactions = summary.periodTransactions.filter((transaction) => transaction.type === "expense");
  if (expenseTransactions.length === 0) {
    return {
      score: 0,
      riskLevel: "low" as RiskLevel,
      safeLimit: 0,
      notes: ["Kampanya hazırlık skoru için önce gelir, gider veya bütçe verisi eklenmeli."]
    };
  }

  const dna = calculateSpendingDna(sourceTransactions, sourceBudgets, { ...options, period });
  const highestCategoryRisk = dna.categories[0]?.riskScore ?? 0;
  const score = clamp(100 - dna.campaignSensitivity * 0.45 - highestCategoryRisk * 0.3 + dna.savingDiscipline * 0.25);
  const totalExpense = sum(expenseTransactions.map((transaction) => transaction.amount));
  const budgetTotal = sum(sourceBudgets.map((budget) => budget.monthlyLimit * periodBudgetMultiplier(period)));
  const limitBase = summary.income > 0 ? summary.income : Math.max(budgetTotal, totalExpense);
  const riskCategory = dna.categories.find((category) => category.riskScore >= 65) ?? dna.categories.find((category) => category.monthlySpend > 0);
  return {
    score,
    riskLevel: riskFromScore(100 - score),
    safeLimit: Math.max(500, Math.round((limitBase * (score / 100) * 0.12) / 100) * 100),
    notes: [
      "Kampanya döneminde kayıtlı gelir, gider ve bütçe limitleri birlikte izlenmeli.",
      riskCategory && riskCategory.riskScore >= 65
        ? `${riskCategory.categoryName} kategorisinde satın alma öncesi Emotional Delay önerilir.`
        : "Belirgin kategori riski oluşana kadar güvenli limit kontrollü tutulur."
    ]
  };
}

type PersonalFinanceData = {
  accounts?: Account[];
  actions?: ActionItem[];
  budgets?: Budget[];
  goals?: Goal[];
  subscriptions?: Subscription[];
  user?: Pick<UserProfile, "payday">;
  transactions?: Transaction[];
};

function amountDueBetween(transactions: Transaction[], start: Date, end: Date, predicate: (transaction: Transaction) => boolean) {
  return sum(
    transactions
      .filter(predicate)
      .filter((transaction) => {
        const date = parseUtcDate(transaction.occurredAt);
        return date >= start && date <= end;
      })
      .map((transaction) => transaction.amount)
  );
}

function goalEmergencyBuffer(goals: Goal[]) {
  return goals.find((goal) => emergencyGoalPattern.test(goal.title))?.currentAmount ?? 0;
}

function daysBetween(left: Date, right: Date) {
  return Math.max(0, Math.ceil((right.getTime() - left.getTime()) / 86_400_000));
}

export function buildWhatIfScenarios(input: WhatIfRequest = {}, source: PersonalFinanceData = {}): WhatIfResponse {
  const sourceAccounts = source.accounts ?? [];
  const sourceActions = source.actions ?? [];
  const sourceBudgets = source.budgets ?? [];
  const sourceGoals = source.goals ?? [];
  const sourceTransactions = source.transactions ?? [];
  const sourceSubscriptions = source.subscriptions ?? [];
  const timeZone = resolveTimeZone(input.timeZone);
  const referenceDate = resolveReferenceDate(sourceTransactions, input.decisionDate);
  const dashboard = calculateDashboardSummary(sourceAccounts, sourceTransactions, sourceGoals, sourceActions, sourceBudgets, { timeZone, referenceDate: dateKey(referenceDate) });
  const dna = calculateSpendingDna(sourceTransactions, sourceBudgets, { timeZone, referenceDate: dateKey(referenceDate) });
  const hasFinancialActivity = sourceTransactions.length > 0 || dashboard.balance !== 0 || sourceBudgets.length > 0 || sourceGoals.length > 0 || sourceActions.length > 0;
  const requestedAmount = positiveAmount(input.amount);
  const emptyMetadata = buildFinancialMetadata(
    metadataAvailability({ accounts: sourceAccounts, transactions: sourceTransactions, budgets: sourceBudgets, goals: sourceGoals, hasDebtPayments: false })
  );
  if (!hasFinancialActivity) {
    return {
      question: input.description ?? "What-if senaryosu için önce gelir, gider, bütçe veya hedef verisi eklenmeli.",
      safeLimit: 0,
      emotionalDelayMinutes: 0,
      cards: [],
      assumptions: ["Simülasyon boş finansal veriyle otomatik varsayım üretmez."],
      dataConfidence: 0,
      dataConfidenceLevel: "low",
      missingData: ["financial_activity", ...emptyMetadata.missingData],
      metadata: { ...emptyMetadata, dataConfidence: "low" }
    };
  }

  const defaultCategory = dna.categories.find((category) => category.monthlySpend > 0 || category.riskScore > 0);
  const resolvedCategoryId = input.categoryId ?? defaultCategory?.categoryId ?? sourceBudgets[0]?.categoryId ?? "cat-other";
  const selectedBudget = sourceBudgets.find((budget) => budget.categoryId === resolvedCategoryId);
  const categorySpend = sum(sourceTransactions.filter((transaction) => transaction.type === "expense" && transaction.categoryId === resolvedCategoryId).map((transaction) => transaction.amount));
  const defaultAmountBase = Math.max(selectedBudget?.monthlyLimit ?? 0, categorySpend, dashboard.expenses, 1000);
  const amount = requestedAmount ?? Math.max(500, Math.round((defaultAmountBase * 0.35) / 100) * 100);
  const categoryRisk = dna.categories.find((category) => category.categoryId === resolvedCategoryId)?.riskScore ?? dna.overallRisk;
  const categoryBudgetRemaining = selectedBudget ? Math.max(0, selectedBudget.monthlyLimit - categorySpend) : undefined;
  const monthEnd = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 0));
  const currentBalance = sum(sourceAccounts.map((account) => account.balance));
  const expectedIncomeUntilMonthEnd = amountDueBetween(
    sourceTransactions,
    referenceDate,
    monthEnd,
    (transaction) => transaction.type === "income"
  );
  const fixedExpensesDue = amountDueBetween(
    sourceTransactions,
    referenceDate,
    monthEnd,
    (transaction) => transaction.type === "expense" && (transaction.recurring === true || isMandatoryCategory(transaction.categoryId))
  );
  const debtPaymentsDue = 0;
  const plannedSavings = 0;
  const emergencyBuffer = goalEmergencyBuffer(sourceGoals);
  const availableCash = currentBalance + expectedIncomeUntilMonthEnd - fixedExpensesDue - debtPaymentsDue - plannedSavings - emergencyBuffer;
  const safeLimit = Math.max(0, Math.round(Math.min(categoryBudgetRemaining ?? Number.POSITIVE_INFINITY, Math.max(0, availableCash) * safeCashSafetyFactor) / 100) * 100);
  const balancedAmount = Math.max(0, Math.round(Math.min(amount * whatIfBalancedMultiplier, Math.max(0, availableCash) * balancedCashFactor) / 100) * 100);
  const currentSavingsGap = sum(sourceGoals.map((goal) => Math.max(goal.targetAmount - goal.currentAmount, 0)));
  const detection = detectPayday(sourceTransactions.map(toPaydayInput));
  const nextIncomeDay = detection.paydayDayOfMonth
    ? new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + (referenceDate.getUTCDate() > detection.paydayDayOfMonth ? 1 : 0), detection.paydayDayOfMonth))
    : undefined;
  const metadata = buildFinancialMetadata(
    metadataAvailability({
      accounts: sourceAccounts,
      transactions: sourceTransactions,
      budgets: sourceBudgets,
      goals: sourceGoals,
      hasFixedExpenses: fixedExpensesDue > 0 || sourceTransactions.some((transaction) => transaction.recurring === true),
      hasDebtPayments: false
    })
  );
  const missingData = [
    ...metadata.missingData,
    selectedBudget ? undefined : "categoryBudget",
    requestedAmount ? undefined : "requestedAmount",
    sourceSubscriptions.length ? undefined : "subscriptions"
  ].filter((item): item is string => Boolean(item));
  const dataConfidenceLevel = metadata.dataConfidence;
  const dataConfidence = confidenceScore(dataConfidenceLevel);
  const responseScenarioId = stableScenarioId(resolvedCategoryId, amount);

  const makeCard = (id: ScenarioCard["id"], spendAmount: number, label: string, recommendation: string): ScenarioCard => {
    const debtImpact = spendAmount;
    const monthEndBalance = dashboard.balance - spendAmount;
    const savingsImpactPercent = currentSavingsGap > 0 ? Math.round((spendAmount / currentSavingsGap) * 100) : 0;
    const riskLevel = id === "safe" ? "low" : id === "balanced" ? riskFromScore(Math.max(categoryRisk, 45)) : riskFromScore(Math.max(categoryRisk, 70));
    const warning = spendAmount > safeLimit ? "Bu senaryo güvenli limitin üzerinde kalıyor." : undefined;
    return {
      id,
      scenarioId: stableScenarioId(resolvedCategoryId, amount, id),
      label,
      spendAmount,
      monthEndBalance,
      debtImpact,
      savingsImpactPercent,
      recommendation,
      riskLevel,
      reasons: [
        `${getCategoryName(resolvedCategoryId)} kategorisi için güvenli limit ${safeLimit.toLocaleString("tr-TR")} TL.`,
        `Harcanabilir nakit ${availableCash.toLocaleString("tr-TR")} TL olarak hesaplandı.`,
        categoryBudgetRemaining !== undefined ? `Kategori bütçesinde kalan tutar ${categoryBudgetRemaining.toLocaleString("tr-TR")} TL.` : "Bu kategori için bütçe tanımlı değil.",
        currentSavingsGap > 0 ? `Aktif hedeflerin kalan tutarına etkisi yaklaşık %${savingsImpactPercent}.` : undefined
      ].filter((reason): reason is string => Boolean(reason)),
      warning
    };
  };

  return {
    scenarioId: responseScenarioId,
    question: input.description ?? `${getCategoryName(resolvedCategoryId)} kategorisinde ${amount.toLocaleString("tr-TR")} TL harcarsam ne olur?`,
    safeLimit,
    emotionalDelayMinutes: categoryRisk >= 65 || amount > safeLimit ? 10 : 0,
    cards: [
      makeCard("safe", Math.min(safeLimit, amount), "Güvenli senaryo", "Güvenli limitte kal, hedefleri bozma."),
      makeCard("balanced", Math.min(balancedAmount, amount), "Dengeli senaryo", "Harcamayı kıs ve kalanını hedefe aktar."),
      makeCard("risky", amount, "Riskli senaryo", "Satın almadan önce 10 dakika bekleme ve alternatif fiyat kontrolü önerilir.")
    ],
    assumptions: [
      "Aylık gelir ve sabit giderler kayıtlı finans verilerine göre hesaplandı.",
      "Kart borcu etkisi işlem tutarı kadar kabul edildi.",
      "Tasarruf etkisi aktif hedeflerin kalan tutarına oranla hesaplandı.",
      ...metadata.assumptions
    ],
    dataConfidence,
    dataConfidenceLevel,
    missingData,
    resolvedCategoryId,
    resolvedCategoryName: getCategoryName(resolvedCategoryId),
    metadata: { ...metadata, missingData, assumptions: [...new Set(metadata.assumptions)] },
    cashflow: {
      currentBalance,
      expectedIncomeUntilMonthEnd,
      fixedExpensesDue,
      debtPaymentsDue,
      plannedSavings,
      emergencyBuffer,
      availableCash,
      categoryBudgetRemaining,
      daysUntilNextIncome: nextIncomeDay ? daysBetween(referenceDate, nextIncomeDay) : undefined
    }
  };
}

export function detectSubscriptionLeakage(sourceSubscriptions: Subscription[], referenceDate = new Date()): SubscriptionLeak[] {
  const unusedBefore = new Date(referenceDate);
  unusedBefore.setUTCDate(unusedBefore.getUTCDate() - 60);
  return sourceSubscriptions.flatMap((subscription) => {
    const leaks: SubscriptionLeak[] = [];
    if (subscription.lastUsedAt && new Date(subscription.lastUsedAt) < unusedBefore) {
      leaks.push({
        subscriptionId: subscription.id,
        merchant: subscription.merchant,
        issue: "unused",
        monthlyImpact: subscription.amount,
        recommendation: "Son 60 günde kullanılmayan aboneliği iptal etmeyi değerlendir."
      });
    }
    if (subscription.previousAmount && subscription.amount > subscription.previousAmount * 1.15) {
      leaks.push({
        subscriptionId: subscription.id,
        merchant: subscription.merchant,
        issue: "price_increase",
        monthlyImpact: subscription.amount - subscription.previousAmount,
        recommendation: "Fiyat artışını alternatif planla karşılaştır."
      });
    }
    return leaks;
  }).concat(detectDuplicateSubscriptions(sourceSubscriptions));
}

export function buildAgentEvidence(source: PersonalFinanceData = {}): AgentEvidence[] {
  const sourceAccounts = source.accounts ?? [];
  const sourceActions = source.actions ?? [];
  const sourceBudgets = source.budgets ?? [];
  const sourceGoals = source.goals ?? [];
  const sourceTransactions = source.transactions ?? [];
  const dashboard = calculateDashboardSummary(sourceAccounts, sourceTransactions, sourceGoals, sourceActions, sourceBudgets);
  const dna = calculateSpendingDna(sourceTransactions, sourceBudgets);
  return [
    { label: `${dashboard.periodLabel} gelir`, value: `${dashboard.income.toLocaleString("tr-TR")} TL`, source: "transaction" },
    { label: `${dashboard.periodLabel} gider`, value: `${dashboard.expenses.toLocaleString("tr-TR")} TL`, source: "transaction" },
    { label: "En yüksek risk", value: `${dna.categories[0]?.categoryName ?? "Kategori"} ${dna.categories[0]?.riskScore ?? 0}/100`, source: "budget" },
    { label: "Kampanya hassasiyeti", value: `${dna.campaignSensitivity}/100`, source: "simulation" }
  ];
}

export function calculateBusinessDashboard(sourceBusiness: Business, sourceCashEvents: BusinessCashEvent[], referenceDate = new Date()): BusinessDashboard {
  const businessId = sourceBusiness.id;
  const referenceDay = parseUtcDate(referenceDate.toISOString());
  const relatedEvents = sourceCashEvents
    .filter((event) => event.businessId === businessId)
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const futureEvents = relatedEvents.filter((event) => parseUtcDate(event.dueAt) >= referenceDay);
  const byDays = (days: number) => {
    const maxDate = addUtcDays(referenceDay, days);
    return futureEvents
      .filter((event) => parseUtcDate(event.dueAt) <= maxDate)
      .reduce((balance, event) => balance + (event.type === "inflow" ? event.amount : -event.amount), sourceBusiness.cashBalance);
  };
  const projected30Days = byDays(30);
  const projected60Days = byDays(60);
  const projected90Days = byDays(90);
  const liquidityRisk: RiskLevel = projected30Days < 80000 ? "high" : projected60Days < 100000 ? "medium" : "low";
  return {
    businessId,
    cashBalance: sourceBusiness.cashBalance,
    projected30Days,
    projected60Days,
    projected90Days,
    liquidityRisk,
    upcomingPayments: futureEvents.filter((event) => event.type === "outflow"),
    expectedCollections: futureEvents.filter((event) => event.type === "inflow")
  };
}

export function calculateCollectionScore(customerId: string, sourceCustomers: BusinessCustomer[]): CollectionScore {
  const customer = sourceCustomers.find((item) => item.id === customerId);
  if (!customer) {
    throw new Error(`Business customer not found: ${customerId}`);
  }
  const lateRatio = customer.invoicesLate / Math.max(customer.invoicesPaid + customer.invoicesLate, 1);
  const score = clamp(100 - customer.averageDelayDays * 1.6 - lateRatio * 45 - customer.outstandingAmount / 4000);
  const riskLevel = riskFromScore(100 - score);
  return {
    customerId: customer.id,
    score,
    riskLevel,
    recommendation:
      riskLevel === "high" || riskLevel === "critical"
        ? "Tahsilatı bölümlü ödeme planına bağla ve yeni işi avansla başlat."
        : "Standart vade korunabilir; ödeme tarihinden 5 gün önce hatırlatma gönder."
  };
}

export function simulateAiCfo(
  amount: number,
  decision: string,
  sourceBusiness: Business,
  sourceCashEvents: BusinessCashEvent[]
): AiCfoSimulation {
  const dashboard = calculateBusinessDashboard(sourceBusiness, sourceCashEvents);
  const afterInvestment = dashboard.projected30Days - amount;
  const riskLevel = afterInvestment < 60000 ? "high" : afterInvestment < 120000 ? "medium" : "low";
  return {
    summary: `${decision} için kısa vadeli nakit etkisi ${amount.toLocaleString("tr-TR")} TL. 30 günlük projeksiyon ${afterInvestment.toLocaleString("tr-TR")} TL seviyesine iner.`,
    cashImpact: -amount,
    riskLevel,
    recommendedPlan:
      riskLevel === "high"
        ? "Yatırımı iki faza böl, ilk fazı tahsilatlardan sonra başlat ve pazarlama bütçesini kademeli artır."
        : "Yatırım kontrollü şekilde yapılabilir; yine de tahsilat tarihlerine bağlı alarm kur.",
    evidence: [
      { label: "Mevcut kasa", value: `${dashboard.cashBalance.toLocaleString("tr-TR")} TL`, source: "business" },
      { label: "30 gün projeksiyon", value: `${dashboard.projected30Days.toLocaleString("tr-TR")} TL`, source: "business" },
      { label: "Likidite riski", value: dashboard.liquidityRisk, source: "business" }
    ]
  };
}

function detectDuplicateSubscriptions(sourceSubscriptions: Subscription[]): SubscriptionLeak[] {
  const groups = new Map<string, Subscription[]>();
  for (const subscription of sourceSubscriptions) {
    const key = `${subscription.categoryId}:${merchantFamily(subscription.merchant)}`;
    groups.set(key, [...(groups.get(key) ?? []), subscription]);
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      subscriptionId: group.map((subscription) => subscription.id).join("/"),
      merchant: group.map((subscription) => subscription.merchant).join(" / "),
      issue: "duplicate" as const,
      monthlyImpact: Math.min(...group.map((subscription) => subscription.amount)),
      recommendation: "Aynı kategori ve satıcı ailesinde görünen abonelikleri tek plana düşürmeyi değerlendir."
    }));
}

function merchantFamily(merchant: string) {
  const ignoredTokens = new Set(["app", "basic", "max", "mini", "plus", "premium", "pro", "standard", "standart", "tr", "trial"]);
  const tokens = merchant
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9ğüşöçıİ ]/gi, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && !ignoredTokens.has(token));
  return tokens[0] ?? merchant.toLocaleLowerCase("tr-TR").trim();
}
