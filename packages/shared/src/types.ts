import type { DataConfidence, FinancialResultMetadata } from "./financial-metadata.js";

export type Currency = "TRY" | "USD" | "EUR";

export type InvestmentAssetType = "stock" | "forex" | "gold" | "commodity" | "crypto" | "fund" | "cash" | "other";

export type MarketDataSource = "twelve_data" | "user" | "unavailable";

export type MarketSymbolSource = "twelve_data" | "local";

export type TransactionType = "income" | "expense";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type DashboardPeriod = "daily" | "weekly" | "monthly" | "yearly";

export type AccountType = "personal" | "business";

export interface DashboardPeriodOptions {
  period?: DashboardPeriod | string;
  referenceDate?: string;
  timeZone?: string;
}

export type ActionStatus = "pending" | "approved" | "dismissed";

export type ActionType =
  | "payment_reminder"
  | "budget_limit"
  | "spending_goal"
  | "calendar_bill"
  | "delay_purchase"
  | "saving_plan";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  persona: "student" | "young_professional" | "family" | "senior" | "business_owner";
  accountType: AccountType;
  monthlyIncome: number;
  payday: number;
  currency: Currency;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: "cash" | "debit" | "credit" | "savings";
  balance: number;
  currency: Currency;
  creditLimit?: number;
}

export interface MarketSymbolResult {
  symbol: string;
  name: string;
  assetType: InvestmentAssetType;
  currency?: string;
  exchange?: string;
  micCode?: string;
  country?: string;
  source: MarketSymbolSource;
}

export interface InvestmentHoldingCreateRequest {
  symbol?: string;
  name?: string;
  assetType?: InvestmentAssetType;
  quantity: number;
  averageCost?: number;
  costCurrency?: Currency;
  exchange?: string;
  micCode?: string;
  marketCurrency?: string;
  annualInterestRate?: number;
}

export interface InvestmentHolding {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  assetType: InvestmentAssetType;
  quantity: number;
  averageCost: number;
  costCurrency: Currency;
  exchange?: string;
  micCode?: string;
  marketCurrency?: string;
  annualInterestRate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentQuote {
  symbol: string;
  name?: string;
  price: number;
  currency: string;
  change?: number;
  percentChange?: number;
  previousClose?: number;
  exchange?: string;
  updatedAt: string;
  source: MarketDataSource;
  isStale: boolean;
  message?: string;
}

export interface InvestmentPosition extends InvestmentHolding {
  quote: InvestmentQuote;
  isPriced: boolean;
  marketDataMessage?: string;
  marketValue: number;
  marketValueTry: number;
  costBasis: number;
  costBasisTry: number;
  profitLossTry: number;
  profitLossPercent: number;
  dailyInterestTry: number;
  projectedEndOfDayValueTry: number;
}

export interface InvestmentPortfolioSummary {
  positions: InvestmentPosition[];
  totalMarketValueTry: number;
  totalCostTry: number;
  totalProfitLossTry: number;
  totalProfitLossPercent: number;
  totalDailyInterestTry: number;
  projectedEndOfDayValueTry: number;
  pricedPositionCount: number;
  unpricedPositionCount: number;
  unpricedCostTry: number;
  hasMarketDataGap: boolean;
  marketDataMessages: string[];
  allocation: Array<{ assetType: InvestmentAssetType; label: string; valueTry: number; weight: number }>;
  provider: "Twelve Data";
  refreshedAt: string;
  cacheTtlHours: number;
  warning?: string;
}

export interface Category {
  id: string;
  name: string;
  kind: TransactionType;
  color: string;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  merchant: string;
  amount: number;
  currency: Currency;
  type: TransactionType;
  occurredAt: string;
  paymentMethod: "cash" | "debit_card" | "credit_card" | "transfer";
  tags?: string[];
  recurring?: boolean;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  monthlyLimit: number;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
}

export interface GoalCreateRequest {
  title: string;
  targetAmount: number;
  currentAmount?: number;
  deadline: string;
}

export interface BudgetUpsertRequest {
  categoryId: string;
  monthlyLimit: number;
}

export interface SavingsPlanUpsertRequest {
  monthlyAmount: number;
  yearlyAmount: number;
}

export interface PlanningOverview {
  goals: Goal[];
  budgets: Budget[];
  categories: Category[];
  savingsPlan: {
    monthly?: Goal;
    yearly?: Goal;
  };
}

export interface GoalAdviceResponse {
  summary: string;
  actions: string[];
  generatedAt: string;
  model?: string;
  source: "llm" | "unavailable";
}

export interface Subscription {
  id: string;
  userId: string;
  merchant: string;
  categoryId: string;
  amount: number;
  currency: Currency;
  cadence: "monthly" | "yearly";
  lastUsedAt?: string;
  previousAmount?: number;
}

export interface ActionItem {
  id: string;
  userId: string;
  type: ActionType;
  title: string;
  description: string;
  dueAt?: string;
  status: ActionStatus;
  source: "agent" | "system" | "user";
}

export interface ReceiptScanResult {
  merchant: string;
  totalAmount: number;
  taxAmount: number;
  occurredAt: string;
  categoryName: string;
  paymentMethod: Transaction["paymentMethod"];
  confidence: number;
  lineItems: Array<{ name: string; amount: number }>;
}

export interface ReceiptExpenseImportResult {
  agentName: "Receipt Agent";
  receipt: ReceiptScanResult;
  transaction: Transaction;
  addedToExpenses: true;
  evidence: string[];
}

export interface StatementLineItem {
  merchant: string;
  amount: number;
  occurredAt: string;
  categoryName: string;
  paymentMethod: Transaction["paymentMethod"];
  confidence: number;
}

export interface StatementSubscriptionCandidate {
  id: string;
  merchant: string;
  amount: number;
  categoryName: string;
  occurrenceCount: number;
  lastChargedAt: string;
  nextEstimatedAt: string;
  confidence: number;
}

export interface StatementPreviewItem extends StatementLineItem {
  index: number;
  existingTransactionId?: string;
}

export interface StatementPreviewResult {
  agentName: "Statement Agent";
  documentId: string;
  statementMonth: string;
  totalAmount: number;
  items: StatementPreviewItem[];
  warnings: string[];
  sourceType: "pdf-text" | "pdf-vision" | "image";
  lowConfidenceCount: number;
  sumMismatch: boolean;
  avgConfidence: number;
  duplicateCount: number;
}

export interface StatementConfirmResult {
  agentName: "Statement Agent";
  documentId: string;
  importedCount: number;
  skippedCount: number;
  duplicateCount: number;
  transactions: Transaction[];
  recurringSubscriptions: StatementSubscriptionCandidate[];
  statementMonth: string;
  totalAmount: number;
}

export interface SubscriptionReminderRequest {
  merchant: string;
  amount?: number;
  remindAt: string;
  note?: string;
}

export interface SubscriptionReminderResult {
  action: ActionItem;
  scheduled: true;
}

export interface SpendingDnaCategory {
  categoryId: string;
  categoryName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  monthlySpend: number;
  budgetLimit?: number;
  dataConfidence?: number;
  confidence?: DataConfidence;
  reasons?: string[];
  explanation?: SpendingDnaMetric;
}

export interface SpendingDnaMetric {
  score: number;
  confidence: DataConfidence;
  reasons: string[];
}

export interface SpendingDnaMetrics {
  overallRisk: SpendingDnaMetric;
  paydayReflexScore: SpendingDnaMetric;
  nightSpendingScore: SpendingDnaMetric;
  weekendSpendingScore: SpendingDnaMetric;
  weekendNightScore: SpendingDnaMetric;
  campaignSensitivity: SpendingDnaMetric;
  savingDiscipline: SpendingDnaMetric;
}

export interface SpendingDna {
  userId: string;
  overallRisk: number;
  paydayReflexScore: number;
  nightSpendingScore?: number;
  weekendSpendingScore?: number;
  weekendNightScore: number;
  campaignSensitivity: number;
  savingDiscipline: number;
  categories: SpendingDnaCategory[];
  patterns: string[];
  dataConfidence?: number;
  dataConfidenceLevel?: DataConfidence;
  missingData?: string[];
  reasons?: string[];
  timeZone?: string;
  metrics?: SpendingDnaMetrics;
  metadata?: FinancialResultMetadata;
  commentary?: SpendingDnaCommentary;
}

export interface SpendingDnaCommentary {
  summary: string;
  takeaways: string[];
  generatedAt: string;
  model?: string;
  source: "llm" | "unavailable";
}

export interface ScenarioCard {
  id: "safe" | "balanced" | "risky";
  scenarioId?: string;
  label: string;
  spendAmount: number;
  monthEndBalance: number;
  debtImpact: number;
  savingsImpactPercent: number;
  recommendation: string;
  riskLevel?: RiskLevel;
  reasons?: string[];
  warning?: string;
}

export interface WhatIfRequest {
  amount?: number;
  categoryId?: string;
  decisionDate?: string;
  description?: string;
  timeZone?: string;
}

export interface WhatIfResponse {
  scenarioId?: string;
  question: string;
  safeLimit: number;
  emotionalDelayMinutes: number;
  cards: ScenarioCard[];
  assumptions: string[];
  dataConfidence?: number;
  dataConfidenceLevel?: DataConfidence;
  missingData?: string[];
  resolvedCategoryId?: string;
  resolvedCategoryName?: string;
  metadata?: FinancialResultMetadata;
  cashflow?: {
    currentBalance: number;
    expectedIncomeUntilMonthEnd: number;
    fixedExpensesDue: number;
    debtPaymentsDue: number;
    plannedSavings: number;
    emergencyBuffer: number;
    availableCash: number;
    categoryBudgetRemaining?: number;
    daysUntilNextIncome?: number;
  };
}

export interface DashboardSummary {
  period: DashboardPeriod;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  income: number;
  expenses: number;
  balance: number;
  savingsRate: number;
  financialHealthScore: number;
  categoryBreakdown: Array<{ categoryId: string; name: string; value: number; color: string }>;
  upcomingActions: ActionItem[];
  goals: Goal[];
  riskAlerts: Array<{ title: string; description: string; level: RiskLevel }>;
}

export interface SubscriptionLeak {
  subscriptionId: string;
  merchant: string;
  issue: "unused" | "duplicate" | "small_leak" | "price_increase";
  monthlyImpact: number;
  recommendation: string;
}

export interface AgentEvidence {
  label: string;
  value: string;
  source: "transaction" | "budget" | "goal" | "subscription" | "simulation" | "business";
}

export interface AgentResponse {
  answer: string;
  confidence: number;
  routedAgents: string[];
  evidence: AgentEvidence[];
  assumptions: string[];
  suggestedActions: ActionItem[];
}

export interface TextToSpeechRequest {
  text: string;
  voiceName?: string;
}

export interface TextToSpeechResult {
  audioBase64: string;
  mimeType: string;
  model: string;
  voiceName: string;
}

export interface SpeechToTextRequest {
  audioBase64: string;
  mimeType?: string;
  fileName?: string;
  language?: string;
}

export interface SpeechToTextResult {
  text: string;
  model: string;
}

export interface SpeechCapabilities {
  stt: {
    available: boolean;
    reason?: string;
  };
  tts: {
    available: boolean;
    reason?: string;
  };
}

export interface Business {
  id: string;
  ownerUserId: string;
  name: string;
  sector: string;
  cashBalance: number;
}

export interface BusinessCreateRequest {
  name: string;
  sector: string;
  cashBalance?: number;
}

export interface BusinessCustomer {
  id: string;
  businessId: string;
  name: string;
  averageDelayDays: number;
  invoicesPaid: number;
  invoicesLate: number;
  outstandingAmount: number;
}

export interface BusinessCustomerCreateRequest {
  name: string;
  averageDelayDays?: number;
  invoicesPaid?: number;
  invoicesLate?: number;
  outstandingAmount?: number;
}

export interface BusinessCashEvent {
  id: string;
  businessId: string;
  title: string;
  amount: number;
  type: "inflow" | "outflow";
  dueAt: string;
}

export interface BusinessCashEventCreateRequest {
  title: string;
  amount: number;
  type: "inflow" | "outflow";
  dueAt: string;
}

export interface BusinessDashboard {
  businessId: string;
  cashBalance: number;
  projected30Days: number;
  projected60Days: number;
  projected90Days: number;
  liquidityRisk: RiskLevel;
  upcomingPayments: BusinessCashEvent[];
  expectedCollections: BusinessCashEvent[];
}

export interface BusinessSummaryInsight {
  cashBalance: number;
  expectedCollections30Days: number;
  upcomingPayments30Days: number;
  overdueReceivables: number;
  projected30Days: number;
  lowestProjectedBalance30Days: number;
  cashRiskScore: number;
  riskLevel: RiskLevel;
}

export interface BusinessCashflowPoint {
  date: string;
  label: string;
  inflow: number;
  outflow: number;
  balance: number;
  riskLevel: RiskLevel;
  eventTitles: string[];
}

export interface BusinessCriticalDate {
  date: string;
  label: string;
  projectedBalance: number;
  riskLevel: RiskLevel;
}

export interface BusinessTwinInsight {
  summary: string;
  criticalDates: BusinessCriticalDate[];
}

export interface BusinessCoverageAnalysis {
  canCover: boolean;
  comfortLevel: "comfortable" | "tight" | "risk" | "missing_data";
  payrollTotal: number;
  rentTotal: number;
  requiredTotal: number;
  lowestBalanceAfterRequired: number;
  riskDate?: string;
  shortfall: number;
  relievingCollection?: BusinessCashEvent;
  deferrablePayment?: BusinessCashEvent;
  explanation: string;
}

export interface CollectionPriority {
  customerId: string;
  customerName: string;
  outstandingAmount: number;
  averageDelayDays: number;
  score: number;
  riskLevel: RiskLevel;
  priorityScore: number;
  action: string;
  reminderMessage: string;
}

export interface BusinessScenarioAnalysis {
  id: "collection_delay" | "payment_deferral" | "cash_injection";
  label: string;
  description: string;
  projected30Days: number;
  cashImpact: number;
  riskLevel: RiskLevel;
  recommendation: string;
}

export interface BusinessInsights {
  summary: BusinessSummaryInsight;
  twin: BusinessTwinInsight;
  cashflow: BusinessCashflowPoint[];
  coverage: BusinessCoverageAnalysis;
  collectionPriorities: CollectionPriority[];
  scenarios: BusinessScenarioAnalysis[];
  assumptions: string[];
  missingData: string[];
}

export interface CollectionScore {
  customerId: string;
  score: number;
  riskLevel: RiskLevel;
  recommendation: string;
}

export interface AiCfoSimulation {
  summary: string;
  cashImpact: number;
  riskLevel: RiskLevel;
  recommendedPlan: string;
  evidence: AgentEvidence[];
}
