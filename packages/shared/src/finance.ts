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
  Business,
  BusinessDashboard,
  BusinessCashEvent,
  BusinessCustomer,
  CollectionScore,
  DashboardSummary,
  Goal,
  RiskLevel,
  ScenarioCard,
  SpendingDna,
  SubscriptionLeak,
  Subscription,
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

function positiveAmount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

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
  selectedMonth = latestMonthKey(sourceTransactions)
) {
  const monthTransactions = sourceTransactions.filter((transaction) => monthKey(transaction.occurredAt) === selectedMonth);
  const income = sum(monthTransactions.filter((transaction) => transaction.type === "income").map((transaction) => transaction.amount));
  const expenses = sum(monthTransactions.filter((transaction) => transaction.type === "expense").map((transaction) => transaction.amount));
  return { month: selectedMonth, monthTransactions, income, expenses, net: income - expenses };
}

export function calculateSpendingDna(
  sourceTransactions: Transaction[] = transactions,
  sourceBudgets: Budget[] = budgets
): SpendingDna {
  const expenseTransactions = sourceTransactions.filter((transaction) => transaction.type === "expense");
  if (expenseTransactions.length === 0) {
    return {
      userId: DEMO_USER_ID,
      overallRisk: 0,
      paydayReflexScore: 0,
      weekendNightScore: 0,
      campaignSensitivity: 0,
      savingDiscipline: 0,
      categories: [],
      patterns: ["Harcama verisi eklendiğinde Spending DNA davranış profili oluşacak."]
    };
  }

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
  const incomeBase = Math.max(sum(sourceTransactions.filter((transaction) => transaction.type === "income").map((transaction) => transaction.amount)), totalExpense, 1);
  const savingDiscipline = clamp(100 - (totalExpense / incomeBase) * 100 + 28);
  const topCategory = categoryRisks.find((category) => category.monthlySpend > 0);
  const paydayRatio = sum(paydayTransactions.map((transaction) => transaction.amount)) / totalExpense;
  const weekendNightRatio = sum(weekendNightTransactions.map((transaction) => transaction.amount)) / totalExpense;
  const campaignRatio = sum(campaignTransactions.map((transaction) => transaction.amount)) / totalExpense;
  const patterns = [
    topCategory
      ? `${topCategory.categoryName} kategorisi bu dönemin en belirgin harcama sinyali: ${topCategory.monthlySpend.toLocaleString("tr-TR")} TL.`
      : undefined,
    paydayRatio >= 0.25 ? "Maaş sonrası ilk günlerde harcama yoğunluğu artıyor." : undefined,
    weekendNightRatio >= 0.2 ? "Akşam veya hafta sonu harcamaları bütçe sapmasına anlamlı katkı veriyor." : undefined,
    campaignRatio > 0 ? "Kampanya etiketli işlemler harcama kararlarında ayrıca izlenmeli." : undefined
  ].filter((pattern): pattern is string => Boolean(pattern));

  return {
    userId: DEMO_USER_ID,
    overallRisk: clamp(sum(categoryRisks.slice(0, 3).map((category) => category.riskScore)) / 3),
    paydayReflexScore: clamp((sum(paydayTransactions.map((transaction) => transaction.amount)) / totalExpense) * 100 + 24),
    weekendNightScore: clamp((sum(weekendNightTransactions.map((transaction) => transaction.amount)) / totalExpense) * 100 + 16),
    campaignSensitivity: clamp((sum(campaignTransactions.map((transaction) => transaction.amount)) / totalExpense) * 100 + 18),
    savingDiscipline,
    categories: categoryRisks,
    patterns: patterns.length ? patterns : ["Harcama dağılımı şu an belirgin bir risk deseni göstermiyor."]
  };
}

export function calculateDashboardSummary(
  sourceAccounts: Account[] = accounts,
  sourceTransactions: Transaction[] = transactions,
  sourceGoals: Goal[] = goals,
  sourceActions: ActionItem[] = actions,
  sourceBudgets: Budget[] = budgets
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
  const dna = calculateSpendingDna(sourceTransactions, sourceBudgets);
  const accountBalance = sum(sourceAccounts.map((account) => account.balance));
  const savingsRate = summary.income > 0 ? ((summary.income - summary.expenses) / summary.income) * 100 : 0;
  const hasFinancialActivity = sourceTransactions.length > 0 || accountBalance !== 0 || sourceGoals.length > 0 || sourceActions.length > 0;
  const financialHealthScore = hasFinancialActivity ? clamp(62 + savingsRate * 0.35 - dna.overallRisk * 0.25 + (accountBalance > 0 ? 8 : -12)) : 0;
  const topRiskCategory = dna.categories.find((category) => category.riskScore >= 65);

  return {
    period: summary.month,
    periodLabel: monthLabelFromKey(summary.month),
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
            description: `${topRiskCategory.categoryName} kategorisi bu ay ${topRiskCategory.monthlySpend.toLocaleString("tr-TR")} TL seviyesinde.`,
            level: topRiskCategory.riskLevel
          }
        ]
      : []
  };
}

export function calculateCampaignReadiness(sourceTransactions: Transaction[] = transactions, sourceBudgets: Budget[] = budgets) {
  const expenseTransactions = sourceTransactions.filter((transaction) => transaction.type === "expense");
  if (expenseTransactions.length === 0) {
    return {
      score: 0,
      riskLevel: "low" as RiskLevel,
      safeLimit: 0,
      notes: ["Kampanya hazırlık skoru için önce gelir, gider veya bütçe verisi eklenmeli."]
    };
  }

  const dna = calculateSpendingDna(sourceTransactions, sourceBudgets);
  const highestCategoryRisk = dna.categories[0]?.riskScore ?? 0;
  const score = clamp(100 - dna.campaignSensitivity * 0.45 - highestCategoryRisk * 0.3 + dna.savingDiscipline * 0.25);
  const summary = summarizeMonth(sourceTransactions);
  const totalExpense = sum(expenseTransactions.map((transaction) => transaction.amount));
  const budgetTotal = sum(sourceBudgets.map((budget) => budget.monthlyLimit));
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
  transactions?: Transaction[];
};

export function buildWhatIfScenarios(input: WhatIfRequest = {}, source: PersonalFinanceData = {}): WhatIfResponse {
  const sourceAccounts = source.accounts ?? accounts;
  const sourceActions = source.actions ?? actions;
  const sourceBudgets = source.budgets ?? budgets;
  const sourceGoals = source.goals ?? goals;
  const sourceTransactions = source.transactions ?? transactions;
  const dashboard = calculateDashboardSummary(sourceAccounts, sourceTransactions, sourceGoals, sourceActions, sourceBudgets);
  const dna = calculateSpendingDna(sourceTransactions, sourceBudgets);
  const hasFinancialActivity = sourceTransactions.length > 0 || dashboard.balance !== 0 || sourceBudgets.length > 0 || sourceGoals.length > 0 || sourceActions.length > 0;
  const requestedAmount = positiveAmount(input.amount);
  if (!hasFinancialActivity && !requestedAmount && !input.categoryId) {
    return {
      question: "What-if senaryosu için önce gelir, gider, bütçe veya hedef verisi eklenmeli.",
      safeLimit: 0,
      emotionalDelayMinutes: 0,
      cards: [],
      assumptions: ["Simülasyon boş finansal veriyle otomatik varsayım üretmez."]
    };
  }

  const defaultCategory = dna.categories.find((category) => category.monthlySpend > 0 || category.riskScore > 0);
  const resolvedCategoryId = input.categoryId ?? defaultCategory?.categoryId ?? sourceBudgets[0]?.categoryId ?? "cat-other";
  const selectedBudget = sourceBudgets.find((budget) => budget.categoryId === resolvedCategoryId);
  const categorySpend = sum(sourceTransactions.filter((transaction) => transaction.type === "expense" && transaction.categoryId === resolvedCategoryId).map((transaction) => transaction.amount));
  const defaultAmountBase = Math.max(selectedBudget?.monthlyLimit ?? 0, categorySpend, dashboard.expenses, 1000);
  const amount = requestedAmount ?? Math.max(500, Math.round((defaultAmountBase * 0.35) / 100) * 100);
  const categoryRisk = dna.categories.find((category) => category.categoryId === resolvedCategoryId)?.riskScore ?? dna.overallRisk;
  const safeLimitBase = selectedBudget?.monthlyLimit ?? defaultAmountBase;
  const safeLimit = Math.max(0, Math.round((safeLimitBase * 0.55) / 100) * 100);
  const currentSavingsGap = sum(sourceGoals.map((goal) => Math.max(goal.targetAmount - goal.currentAmount, 0)));

  const makeCard = (id: ScenarioCard["id"], multiplier: number, label: string, recommendation: string): ScenarioCard => {
    const spendAmount = Math.round(amount * multiplier);
    const debtImpact = spendAmount;
    const monthEndBalance = dashboard.balance - spendAmount;
    const savingsImpactPercent = currentSavingsGap > 0 ? Math.round((spendAmount / currentSavingsGap) * 100) : 0;
    return { id, label, spendAmount, monthEndBalance, debtImpact, savingsImpactPercent, recommendation };
  };

  return {
    question: input.description ?? `${getCategoryName(resolvedCategoryId)} kategorisinde ${amount.toLocaleString("tr-TR")} TL harcarsam ne olur?`,
    safeLimit,
    emotionalDelayMinutes: categoryRisk >= 65 || amount > safeLimit ? 10 : 0,
    cards: [
      makeCard("safe", Math.min(safeLimit / Math.max(amount, 1), 1), "Güvenli senaryo", "Güvenli limitte kal, hedefleri bozma."),
      makeCard("balanced", 0.7, "Dengeli senaryo", "Harcamayı kıs ve kalanını hedefe aktar."),
      makeCard("risky", 1, "Riskli senaryo", "Satın almadan önce 10 dakika bekleme ve alternatif fiyat kontrolü önerilir.")
    ],
    assumptions: [
      "Aylık gelir ve sabit giderler kayıtlı finans verilerine göre hesaplandı.",
      "Kart borcu etkisi işlem tutarı kadar kabul edildi.",
      "Tasarruf etkisi aktif hedeflerin kalan tutarına oranla hesaplandı."
    ]
  };
}

export function detectSubscriptionLeakage(sourceSubscriptions: Subscription[] = subscriptions, referenceDate = new Date()): SubscriptionLeak[] {
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
  const sourceAccounts = source.accounts ?? accounts;
  const sourceActions = source.actions ?? actions;
  const sourceBudgets = source.budgets ?? budgets;
  const sourceGoals = source.goals ?? goals;
  const sourceTransactions = source.transactions ?? transactions;
  const dashboard = calculateDashboardSummary(sourceAccounts, sourceTransactions, sourceGoals, sourceActions, sourceBudgets);
  const dna = calculateSpendingDna(sourceTransactions, sourceBudgets);
  return [
    { label: `${dashboard.periodLabel} gelir`, value: `${dashboard.income.toLocaleString("tr-TR")} TL`, source: "transaction" },
    { label: `${dashboard.periodLabel} gider`, value: `${dashboard.expenses.toLocaleString("tr-TR")} TL`, source: "transaction" },
    { label: "En yüksek risk", value: `${dna.categories[0]?.categoryName ?? "Kategori"} ${dna.categories[0]?.riskScore ?? 0}/100`, source: "budget" },
    { label: "Kampanya hassasiyeti", value: `${dna.campaignSensitivity}/100`, source: "simulation" }
  ];
}

export function calculateBusinessDashboard(
  businessId = DEMO_BUSINESS_ID,
  sourceBusiness: Business = business,
  sourceCashEvents: BusinessCashEvent[] = businessCashEvents
): BusinessDashboard {
  const relatedEvents = sourceCashEvents.filter((event) => event.businessId === businessId);
  const byDays = (days: number) => {
    const maxDate = new Date("2026-05-08T00:00:00.000Z");
    maxDate.setUTCDate(maxDate.getUTCDate() + days);
    return relatedEvents
      .filter((event) => new Date(event.dueAt) <= maxDate)
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
    upcomingPayments: relatedEvents.filter((event) => event.type === "outflow"),
    expectedCollections: relatedEvents.filter((event) => event.type === "inflow")
  };
}

export function calculateCollectionScore(customerId: string, sourceCustomers: BusinessCustomer[] = businessCustomers): CollectionScore {
  const customer = sourceCustomers.find((item) => item.id === customerId) ?? sourceCustomers[0]!;
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
  decision = "Yeni yatırım",
  sourceBusiness: Business = business,
  sourceCashEvents: BusinessCashEvent[] = businessCashEvents
): AiCfoSimulation {
  const dashboard = calculateBusinessDashboard(sourceBusiness.id, sourceBusiness, sourceCashEvents);
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
