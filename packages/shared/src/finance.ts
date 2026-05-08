import {
  accounts,
  actions,
  budgets,
  business,
  businessCashEvents,
  businessCustomers,
  categories,
  DEMO_BUSINESS_ID,
  DEMO_USER_ID,
  goals,
  subscriptions,
  transactions
} from "./demo-data.js";
import type {
  Account,
  ActionItem,
  AgentEvidence,
  AiCfoSimulation,
  Budget,
  BusinessDashboard,
  CollectionScore,
  DashboardSummary,
  Goal,
  RiskLevel,
  ScenarioCard,
  SpendingDna,
  SubscriptionLeak,
  Transaction,
  WhatIfRequest,
  WhatIfResponse
} from "./types.js";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const riskFromScore = (score: number): RiskLevel => {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
};

const monthKey = (iso: string) => iso.slice(0, 7);

export const demoDataset = {
  userId: DEMO_USER_ID,
  businessId: DEMO_BUSINESS_ID,
  accounts,
  actions,
  budgets,
  business,
  businessCashEvents,
  businessCustomers,
  categories,
  goals,
  subscriptions,
  transactions
};

export function getCategoryName(categoryId: string): string {
  return categories.find((category) => category.id === categoryId)?.name ?? "Diğer";
}

export function summarizeMonth(
  sourceTransactions: Transaction[] = transactions,
  selectedMonth = "2026-05"
) {
  const monthTransactions = sourceTransactions.filter((transaction) => monthKey(transaction.occurredAt) === selectedMonth);
  const income = sum(monthTransactions.filter((transaction) => transaction.type === "income").map((transaction) => transaction.amount));
  const expenses = sum(monthTransactions.filter((transaction) => transaction.type === "expense").map((transaction) => transaction.amount));
  return { monthTransactions, income, expenses, net: income - expenses };
}

export function calculateSpendingDna(
  sourceTransactions: Transaction[] = transactions,
  sourceBudgets: Budget[] = budgets
): SpendingDna {
  const expenseTransactions = sourceTransactions.filter((transaction) => transaction.type === "expense");
  const categoryRisks = categories
    .filter((category) => category.kind === "expense")
    .map((category) => {
      const categorySpend = sum(expenseTransactions.filter((transaction) => transaction.categoryId === category.id).map((transaction) => transaction.amount));
      const budget = sourceBudgets.find((item) => item.categoryId === category.id);
      const budgetPressure = budget ? (categorySpend / budget.monthlyLimit) * 100 : categorySpend / 100;
      const campaignBoost = expenseTransactions.some((transaction) => transaction.categoryId === category.id && transaction.tags?.includes("campaign")) ? 18 : 0;
      const riskScore = clamp(budgetPressure + campaignBoost, 0, 100);
      return {
        categoryId: category.id,
        categoryName: category.name,
        riskScore,
        riskLevel: riskFromScore(riskScore),
        monthlySpend: categorySpend,
        budgetLimit: budget?.monthlyLimit
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);

  const weekendNightTransactions = expenseTransactions.filter((transaction) => {
    const date = new Date(transaction.occurredAt);
    const hour = date.getUTCHours();
    const day = date.getUTCDay();
    return hour >= 19 || day === 0 || day === 6;
  });
  const paydayTransactions = expenseTransactions.filter((transaction) => new Date(transaction.occurredAt).getUTCDate() >= 5 && new Date(transaction.occurredAt).getUTCDate() <= 8);
  const campaignTransactions = expenseTransactions.filter((transaction) => transaction.tags?.includes("campaign"));
  const totalExpense = Math.max(sum(expenseTransactions.map((transaction) => transaction.amount)), 1);
  const savingDiscipline = clamp(100 - (totalExpense / 48500) * 100 + 28);

  return {
    userId: DEMO_USER_ID,
    overallRisk: clamp(sum(categoryRisks.slice(0, 3).map((category) => category.riskScore)) / 3),
    paydayReflexScore: clamp((sum(paydayTransactions.map((transaction) => transaction.amount)) / totalExpense) * 100 + 24),
    weekendNightScore: clamp((sum(weekendNightTransactions.map((transaction) => transaction.amount)) / totalExpense) * 100 + 16),
    campaignSensitivity: clamp((sum(campaignTransactions.map((transaction) => transaction.amount)) / totalExpense) * 100 + 18),
    savingDiscipline,
    categories: categoryRisks,
    patterns: [
      "Maaş sonrası ilk 72 saatte teknoloji ve giyim harcaması artıyor.",
      "Kampanya etiketli işlemler ayın en yüksek riskli harcama kümesini oluşturuyor.",
      "Gece yapılan küçük yemek harcamaları bütçe sapmasını görünmez büyütüyor."
    ]
  };
}

export function calculateDashboardSummary(
  sourceAccounts: Account[] = accounts,
  sourceTransactions: Transaction[] = transactions,
  sourceGoals: Goal[] = goals,
  sourceActions: ActionItem[] = actions
): DashboardSummary {
  const summary = summarizeMonth(sourceTransactions);
  const expenseTransactions = summary.monthTransactions.filter((transaction) => transaction.type === "expense");
  const categoryBreakdown = categories
    .filter((category) => category.kind === "expense")
    .map((category) => ({
      categoryId: category.id,
      name: category.name,
      value: sum(expenseTransactions.filter((transaction) => transaction.categoryId === category.id).map((transaction) => transaction.amount)),
      color: category.color
    }))
    .filter((item) => item.value > 0);
  const dna = calculateSpendingDna(sourceTransactions);
  const accountBalance = sum(sourceAccounts.map((account) => account.balance));
  const savingsRate = summary.income > 0 ? ((summary.income - summary.expenses) / summary.income) * 100 : 0;
  const financialHealthScore = clamp(62 + savingsRate * 0.35 - dna.overallRisk * 0.25 + (accountBalance > 0 ? 8 : -12));

  return {
    income: summary.income,
    expenses: summary.expenses,
    balance: accountBalance,
    savingsRate: Math.round(savingsRate),
    financialHealthScore,
    categoryBreakdown,
    upcomingActions: sourceActions.filter((action) => action.status === "pending"),
    goals: sourceGoals,
    riskAlerts: [
      {
        title: "Teknoloji kampanya riski",
        description: "Teknoloji kategorisi aylık limitin üzerinde ve kampanya etiketli işlem içeriyor.",
        level: "high"
      },
      {
        title: "Abonelik sızıntısı",
        description: "CloudBox ve CloudBox Pro aynı ihtiyaca benzer iki abonelik gibi görünüyor.",
        level: "medium"
      }
    ]
  };
}

export function calculateCampaignReadiness(sourceTransactions: Transaction[] = transactions) {
  const dna = calculateSpendingDna(sourceTransactions);
  const techRisk = dna.categories.find((category) => category.categoryId === "cat-tech")?.riskScore ?? 0;
  const score = clamp(100 - dna.campaignSensitivity * 0.45 - techRisk * 0.3 + dna.savingDiscipline * 0.25);
  return {
    score,
    riskLevel: riskFromScore(100 - score),
    safeLimit: Math.max(1000, Math.round((48500 * (score / 100) * 0.12) / 100) * 100),
    notes: [
      "Kampanya döneminde kredi kartı borcu ve tasarruf hedefi birlikte izlenmeli.",
      "Teknoloji kategorisinde satın alma öncesi Emotional Delay önerilir."
    ]
  };
}

export function buildWhatIfScenarios(input: WhatIfRequest): WhatIfResponse {
  const dashboard = calculateDashboardSummary();
  const selectedBudget = budgets.find((budget) => budget.categoryId === input.categoryId);
  const dna = calculateSpendingDna();
  const categoryRisk = dna.categories.find((category) => category.categoryId === input.categoryId)?.riskScore ?? dna.overallRisk;
  const safeLimit = Math.max(500, Math.round(((selectedBudget?.monthlyLimit ?? input.amount) * 0.55) / 100) * 100);
  const currentSavingsGap = sum(goals.map((goal) => Math.max(goal.targetAmount - goal.currentAmount, 0)));

  const makeCard = (id: ScenarioCard["id"], multiplier: number, label: string, recommendation: string): ScenarioCard => {
    const spendAmount = Math.round(input.amount * multiplier);
    const debtImpact = spendAmount;
    const monthEndBalance = dashboard.balance - spendAmount;
    const savingsImpactPercent = currentSavingsGap > 0 ? Math.round((spendAmount / currentSavingsGap) * 100) : 0;
    return { id, label, spendAmount, monthEndBalance, debtImpact, savingsImpactPercent, recommendation };
  };

  return {
    question: input.description ?? `${getCategoryName(input.categoryId)} kategorisinde ${input.amount} TL harcarsam ne olur?`,
    safeLimit,
    emotionalDelayMinutes: categoryRisk >= 65 || input.amount > safeLimit ? 10 : 0,
    cards: [
      makeCard("safe", Math.min(safeLimit / Math.max(input.amount, 1), 1), "Güvenli senaryo", "Güvenli limitte kal, hedefleri bozma."),
      makeCard("balanced", 0.7, "Dengeli senaryo", "Harcamayı kıs ve kalanını hedefe aktar."),
      makeCard("risky", 1, "Riskli senaryo", "Satın almadan önce 10 dakika bekleme ve alternatif fiyat kontrolü önerilir.")
    ],
    assumptions: [
      "Aylık gelir ve sabit giderler Mayıs 2026 demo verisine göre hesaplandı.",
      "Kart borcu etkisi işlem tutarı kadar kabul edildi.",
      "Tasarruf etkisi aktif hedeflerin kalan tutarına oranla hesaplandı."
    ]
  };
}

export function detectSubscriptionLeakage(): SubscriptionLeak[] {
  return subscriptions.flatMap((subscription) => {
    const leaks: SubscriptionLeak[] = [];
    if (subscription.lastUsedAt && new Date(subscription.lastUsedAt) < new Date("2026-03-01")) {
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
  }).concat([
    {
      subscriptionId: "sub-cloud",
      merchant: "CloudBox / CloudBox Pro",
      issue: "duplicate",
      monthlyImpact: 149,
      recommendation: "Aynı bulut depolama ihtiyacı için tek pakete düş."
    }
  ]);
}

export function buildAgentEvidence(): AgentEvidence[] {
  const dashboard = calculateDashboardSummary();
  const dna = calculateSpendingDna();
  return [
    { label: "Mayıs gelir", value: `${dashboard.income.toLocaleString("tr-TR")} TL`, source: "transaction" },
    { label: "Mayıs gider", value: `${dashboard.expenses.toLocaleString("tr-TR")} TL`, source: "transaction" },
    { label: "En yüksek risk", value: `${dna.categories[0]?.categoryName ?? "Kategori"} ${dna.categories[0]?.riskScore ?? 0}/100`, source: "budget" },
    { label: "Kampanya hassasiyeti", value: `${dna.campaignSensitivity}/100`, source: "simulation" }
  ];
}

export function calculateBusinessDashboard(businessId = DEMO_BUSINESS_ID): BusinessDashboard {
  const relatedEvents = businessCashEvents.filter((event) => event.businessId === businessId);
  const byDays = (days: number) => {
    const maxDate = new Date("2026-05-08T00:00:00.000Z");
    maxDate.setUTCDate(maxDate.getUTCDate() + days);
    return relatedEvents
      .filter((event) => new Date(event.dueAt) <= maxDate)
      .reduce((balance, event) => balance + (event.type === "inflow" ? event.amount : -event.amount), business.cashBalance);
  };
  const projected30Days = byDays(30);
  const projected60Days = byDays(60);
  const projected90Days = byDays(90);
  const liquidityRisk: RiskLevel = projected30Days < 80000 ? "high" : projected60Days < 100000 ? "medium" : "low";
  return {
    businessId,
    cashBalance: business.cashBalance,
    projected30Days,
    projected60Days,
    projected90Days,
    liquidityRisk,
    upcomingPayments: relatedEvents.filter((event) => event.type === "outflow"),
    expectedCollections: relatedEvents.filter((event) => event.type === "inflow")
  };
}

export function calculateCollectionScore(customerId: string): CollectionScore {
  const customer = businessCustomers.find((item) => item.id === customerId) ?? businessCustomers[0]!;
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

export function simulateAiCfo(amount: number, decision = "Yeni yatırım"): AiCfoSimulation {
  const dashboard = calculateBusinessDashboard();
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
