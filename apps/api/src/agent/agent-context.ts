import {
  calculateCampaignReadiness,
  calculateDashboardSummary,
  calculateSpendingDna,
  detectSubscriptionLeakage,
  summarizeDecisionJournal,
  type Account,
  type ActionItem,
  type Budget,
  type Category,
  type Goal,
  type InvestmentHolding,
  type SimulationHistoryItem,
  type Subscription,
  type Transaction,
  type UserProfile
} from "@fintwin/shared";

export const AGENT_CONTEXT_CHAR_BUDGET = 7_500;

type PersonalAgentData = {
  user: UserProfile;
  accounts: Account[];
  actions: ActionItem[];
  budgets: Budget[];
  categories: Category[];
  goals: Goal[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  investmentHoldings: InvestmentHolding[];
};

type ContextLimits = {
  accounts: number;
  budgets: number;
  goals: number;
  subscriptions: number;
  decisionHistory: number;
  transactions: number;
  portfolioAssets: number;
  actions: number;
  riskCategories: number;
};

const DEFAULT_LIMITS: ContextLimits = {
  accounts: 6,
  budgets: 8,
  goals: 6,
  subscriptions: 6,
  decisionHistory: 5,
  transactions: 8,
  portfolioAssets: 8,
  actions: 5,
  riskCategories: 4
};

export function buildTokenFriendlyAgentContext(
  data: PersonalAgentData,
  decisionHistory: SimulationHistoryItem[],
  options: { maxChars?: number } = {}
) {
  const maxChars = options.maxChars ?? AGENT_CONTEXT_CHAR_BUDGET;
  const limits = { ...DEFAULT_LIMITS };
  const truncatedSections = new Set<string>();
  let context = withContextBudget(assembleContext(data, decisionHistory, limits, maxChars, []), maxChars, []);

  while (JSON.stringify(context).length > maxChars && shrinkLimits(limits, truncatedSections)) {
    context = withContextBudget(assembleContext(data, decisionHistory, limits, maxChars, [...truncatedSections]), maxChars, [...truncatedSections]);
  }

  return context;
}

function assembleContext(
  data: PersonalAgentData,
  decisionHistory: SimulationHistoryItem[],
  limits: ContextLimits,
  maxChars: number,
  truncatedSections: string[]
) {
  const dashboard = calculateDashboardSummary(data.accounts, data.transactions, data.goals, data.actions, data.budgets, {}, data.categories);
  const readiness = calculateCampaignReadiness(data.transactions, data.budgets, {}, data.categories);
  const dna = calculateSpendingDna(data.transactions, data.budgets, {}, data.categories);
  const decisionSummary = summarizeDecisionJournal(decisionHistory);
  const leaks = detectSubscriptionLeakage(data.subscriptions);
  const categoryName = (categoryId: string) => data.categories.find((category) => category.id === categoryId)?.name ?? categoryId;
  const spendByCategory = new Map(dashboard.categoryBreakdown.map((item) => [item.categoryId, item.value]));
  const activeSubscriptions = data.subscriptions.filter((subscription) => subscription.status === "active" || subscription.status === "watching");
  const liquidBalance = data.accounts
    .filter((account) => account.type === "cash" || account.type === "debit" || account.type === "savings")
    .reduce((total, account) => total + account.balance, 0);
  const creditLimit = data.accounts.filter((account) => account.type === "credit").reduce((total, account) => total + (account.creditLimit ?? 0), 0);
  const portfolioByType = aggregateHoldings(data.investmentHoldings);
  const profileCompleteness = buildProfileCompleteness(data);

  return {
    contextVersion: 2,
    contextPolicy: {
      maxChars,
      truncatedSections,
      note: "Bu veri ham kayıt değil, LLM için token dostu finans özeti. Eksik veri varsa kesin hüküm verme."
    },
    user: {
      persona: data.user.persona,
      accountType: data.user.accountType,
      monthlyIncome: round(data.user.monthlyIncome),
      payday: data.user.payday,
      currency: data.user.currency
    },
    summary: {
      period: dashboard.periodLabel,
      income: round(dashboard.income),
      expenses: round(dashboard.expenses),
      balance: round(dashboard.balance),
      savingsRate: round(dashboard.savingsRate),
      financialHealthScore: dashboard.financialHealthScore,
      safeSpendLimit: round(readiness.safeLimit),
      campaignReadinessScore: readiness.score,
      dataConfidence: dna.dataConfidenceLevel ?? "low"
    },
    profileCompleteness,
    cashflow: {
      liquidBalance: round(liquidBalance),
      creditLimit: round(creditLimit),
      upcomingActionCount: data.actions.filter((action) => action.status === "pending").length,
      activeSubscriptionMonthlyTotal: round(activeSubscriptions.reduce((total, subscription) => total + subscription.amount, 0))
    },
    accounts: data.accounts
      .slice()
      .sort((left, right) => Math.abs(right.balance) - Math.abs(left.balance))
      .slice(0, limits.accounts)
      .map((account) => ({
        name: truncate(account.name, 40),
        type: account.type,
        balance: round(account.balance),
        currency: account.currency,
        creditLimit: account.creditLimit ? round(account.creditLimit) : undefined
      })),
    budgets: data.budgets
      .map((budget) => {
        const spent = spendByCategory.get(budget.categoryId) ?? 0;
        return {
          category: categoryName(budget.categoryId),
          monthlyLimit: round(budget.monthlyLimit),
          spent: round(spent),
          remaining: round(budget.monthlyLimit - spent),
          usedPct: budget.monthlyLimit > 0 ? round((spent / budget.monthlyLimit) * 100) : 0
        };
      })
      .sort((left, right) => right.usedPct - left.usedPct)
      .slice(0, limits.budgets),
    goals: data.goals
      .map((goal) => ({
        title: truncate(goal.title, 50),
        targetAmount: round(goal.targetAmount),
        currentAmount: round(goal.currentAmount),
        remainingAmount: round(Math.max(goal.targetAmount - goal.currentAmount, 0)),
        progressPct: goal.targetAmount > 0 ? round((goal.currentAmount / goal.targetAmount) * 100) : 0,
        deadline: goal.deadline
      }))
      .sort((left, right) => left.progressPct - right.progressPct)
      .slice(0, limits.goals),
    risks: {
      topCategories: dna.categories
        .filter((category) => category.monthlySpend > 0 || category.riskScore > 0)
        .slice(0, limits.riskCategories)
        .map((category) => ({
          category: category.categoryName,
          riskScore: category.riskScore,
          riskLevel: category.riskLevel,
          monthlySpend: round(category.monthlySpend),
          budgetLimit: category.budgetLimit ? round(category.budgetLimit) : undefined,
          reasons: (category.reasons ?? []).slice(0, 2).map((reason) => truncate(reason, 120))
        })),
      behaviorSignals: dna.patterns.slice(0, 5).map((pattern) => truncate(pattern, 140)),
      missingData: (dna.missingData ?? []).slice(0, 5)
    },
    subscriptions: {
      total: data.subscriptions.length,
      active: data.subscriptions.filter((subscription) => subscription.status === "active").length,
      watching: data.subscriptions.filter((subscription) => subscription.status === "watching").length,
      leakCount: leaks.length,
      leakHighlights: leaks.slice(0, limits.subscriptions).map((leak) => ({
        merchant: truncate(leak.merchant, 45),
        issue: leak.issue,
        monthlyImpact: round(leak.monthlyImpact),
        recommendation: truncate(leak.recommendation, 120)
      })),
      upcoming: activeSubscriptions
        .filter((subscription) => subscription.nextExpectedAt)
        .sort((left, right) => String(left.nextExpectedAt).localeCompare(String(right.nextExpectedAt)))
        .slice(0, limits.subscriptions)
        .map((subscription) => ({
          merchant: truncate(subscription.merchant, 45),
          amount: round(subscription.amount),
          cadence: subscription.cadence,
          nextExpectedAt: subscription.nextExpectedAt,
          status: subscription.status
        }))
    },
    decisionJournal: {
      totalScenarios: decisionSummary.totalScenarios,
      decidedScenarios: decisionSummary.decidedScenarios,
      netProtectedCash: round(decisionSummary.netProtectedCash),
      healthAdjustment: decisionSummary.healthAdjustment,
      insight: truncate(decisionSummary.insight, 180),
      recent: decisionHistory.slice(0, limits.decisionHistory).map((item) => ({
        question: truncate(item.question, 90),
        amount: item.amount ? round(item.amount) : undefined,
        categoryName: item.categoryName,
        riskLevel: item.riskLevel,
        decision: item.decisionEvents[0]?.userAction,
        createdAt: item.createdAt
      }))
    },
    recentTransactions: data.transactions
      .slice()
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, limits.transactions)
      .map((transaction) => ({
        merchant: truncate(transaction.merchant, 45),
        amount: round(transaction.amount),
        type: transaction.type,
        category: categoryName(transaction.categoryId),
        occurredAt: transaction.occurredAt.slice(0, 10),
        recurring: transaction.recurring === true ? true : undefined
      })),
    portfolio: {
      holdingCount: data.investmentHoldings.length,
      allocationByAssetType: portfolioByType,
      assets: data.investmentHoldings.slice(0, limits.portfolioAssets).map((holding) => ({
        symbol: holding.symbol,
        name: truncate(holding.name, 45),
        assetType: holding.assetType,
        quantity: round(holding.quantity),
        costCurrency: holding.costCurrency
      }))
    },
    actions: {
      pending: data.actions
        .filter((action) => action.status === "pending")
        .slice(0, limits.actions)
        .map((action) => ({
          type: action.type,
          title: truncate(action.title, 60),
          dueAt: action.dueAt
        }))
    }
  };
}

function shrinkLimits(limits: ContextLimits, truncatedSections: Set<string>) {
  const order: Array<keyof ContextLimits> = [
    "transactions",
    "portfolioAssets",
    "subscriptions",
    "budgets",
    "goals",
    "decisionHistory",
    "accounts",
    "actions",
    "riskCategories"
  ];

  for (const key of order) {
    if (limits[key] > 2) {
      limits[key] -= 1;
      truncatedSections.add(key);
      return true;
    }
  }
  return false;
}

function aggregateHoldings(holdings: InvestmentHolding[]) {
  const totals = new Map<string, number>();
  for (const holding of holdings) {
    const approximateCost = holding.quantity * holding.averageCost;
    totals.set(holding.assetType, (totals.get(holding.assetType) ?? 0) + approximateCost);
  }
  return [...totals.entries()]
    .sort(([, left], [, right]) => right - left)
    .slice(0, 6)
    .map(([assetType, approximateCost]) => ({ assetType, approximateCost: round(approximateCost) }));
}

function buildProfileCompleteness(data: PersonalAgentData) {
  const missingCriticalData: string[] = [];
  if (data.user.monthlyIncome <= 0) missingCriticalData.push("gelir");
  if (data.accounts.length === 0) missingCriticalData.push("hesap");
  if (data.transactions.length === 0) missingCriticalData.push("işlem geçmişi");
  if (data.budgets.length === 0) missingCriticalData.push("bütçe");
  if (data.goals.length === 0) missingCriticalData.push("hedef");

  return {
    score: round(((5 - missingCriticalData.length) / 5) * 100),
    missingCriticalData,
    counts: {
      accounts: data.accounts.length,
      transactions: data.transactions.length,
      budgets: data.budgets.length,
      goals: data.goals.length,
      subscriptions: data.subscriptions.length,
      portfolioAssets: data.investmentHoldings.length
    }
  };
}

function withContextBudget<T extends object>(context: T, maxChars: number, truncatedSections: string[]) {
  return {
    ...context,
    contextBudget: {
      approximateChars: JSON.stringify(context).length,
      maxChars,
      truncatedSections
    }
  };
}

function truncate(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
}

function round(value: number) {
  return Number(value.toFixed(2));
}
