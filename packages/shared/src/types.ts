export type Currency = "TRY" | "USD" | "EUR";

export type TransactionType = "income" | "expense";

export type RiskLevel = "low" | "medium" | "high" | "critical";

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
  persona: "student" | "young_professional" | "family" | "senior";
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

export interface StatementImportResult {
  agentName: "Statement Agent";
  statementMonth: string;
  totalAmount: number;
  importedCount: number;
  skippedCount: number;
  items: StatementLineItem[];
  transactions: Transaction[];
  evidence: string[];
}

export interface SpendingDnaCategory {
  categoryId: string;
  categoryName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  monthlySpend: number;
  budgetLimit?: number;
}

export interface SpendingDna {
  userId: string;
  overallRisk: number;
  paydayReflexScore: number;
  weekendNightScore: number;
  campaignSensitivity: number;
  savingDiscipline: number;
  categories: SpendingDnaCategory[];
  patterns: string[];
}

export interface ScenarioCard {
  id: "safe" | "balanced" | "risky";
  label: string;
  spendAmount: number;
  monthEndBalance: number;
  debtImpact: number;
  savingsImpactPercent: number;
  recommendation: string;
}

export interface WhatIfRequest {
  amount: number;
  categoryId: string;
  decisionDate?: string;
  description?: string;
}

export interface WhatIfResponse {
  question: string;
  safeLimit: number;
  emotionalDelayMinutes: number;
  cards: ScenarioCard[];
  assumptions: string[];
}

export interface DashboardSummary {
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

export interface Business {
  id: string;
  ownerUserId: string;
  name: string;
  sector: string;
  cashBalance: number;
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

export interface BusinessCashEvent {
  id: string;
  businessId: string;
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
