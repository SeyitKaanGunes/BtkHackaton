import type {
  Account,
  ActionItem,
  Budget,
  Business,
  BusinessCashEvent,
  BusinessCustomer,
  Goal,
  InvestmentHolding,
  Subscription,
  Transaction,
  UserProfile
} from "./types.js";

export const DEMO_USER_ID = "user-demo";
export const DEMO_BUSINESS_ID = "business-demo";

export const demoUser: UserProfile = {
  id: DEMO_USER_ID,
  name: "Seyit Kaan",
  email: "seyit@example.com",
  persona: "young_professional",
  accountType: "personal",
  monthlyIncome: 48500,
  payday: 5,
  currency: "TRY"
};

export const accounts: Account[] = [
  { id: "acc-main", userId: DEMO_USER_ID, name: "Vadesiz Hesap", type: "debit", balance: 18400, currency: "TRY" },
  { id: "acc-card", userId: DEMO_USER_ID, name: "Kredi Kartı", type: "credit", balance: -12600, currency: "TRY", creditLimit: 60000 },
  { id: "acc-save", userId: DEMO_USER_ID, name: "Birikim", type: "savings", balance: 32000, currency: "TRY" }
];

export const transactions: Transaction[] = [
  { id: "tx-001", userId: DEMO_USER_ID, accountId: "acc-main", categoryId: "cat-salary", merchant: "Ankara AI Studio", amount: 48500, currency: "TRY", type: "income", occurredAt: "2026-05-05T09:00:00.000Z", paymentMethod: "transfer" },
  { id: "tx-002", userId: DEMO_USER_ID, accountId: "acc-main", categoryId: "cat-rent", merchant: "Ev Kirası", amount: 14500, currency: "TRY", type: "expense", occurredAt: "2026-05-06T10:00:00.000Z", paymentMethod: "transfer", recurring: true },
  { id: "tx-003", userId: DEMO_USER_ID, accountId: "acc-card", categoryId: "cat-tech", merchant: "TeknoMarket", amount: 9800, currency: "TRY", type: "expense", occurredAt: "2026-05-07T20:30:00.000Z", paymentMethod: "credit_card", tags: ["campaign"] },
  { id: "tx-004", userId: DEMO_USER_ID, accountId: "acc-card", categoryId: "cat-food", merchant: "Gece Burger", amount: 840, currency: "TRY", type: "expense", occurredAt: "2026-05-08T00:15:00.000Z", paymentMethod: "credit_card" },
  { id: "tx-005", userId: DEMO_USER_ID, accountId: "acc-card", categoryId: "cat-clothes", merchant: "ModaBox", amount: 4200, currency: "TRY", type: "expense", occurredAt: "2026-05-08T19:10:00.000Z", paymentMethod: "credit_card", tags: ["campaign"] },
  { id: "tx-006", userId: DEMO_USER_ID, accountId: "acc-main", categoryId: "cat-market", merchant: "Mahalle Market", amount: 2650, currency: "TRY", type: "expense", occurredAt: "2026-05-03T18:00:00.000Z", paymentMethod: "debit_card" },
  { id: "tx-007", userId: DEMO_USER_ID, accountId: "acc-main", categoryId: "cat-transport", merchant: "Ulaşım Kartı", amount: 1100, currency: "TRY", type: "expense", occurredAt: "2026-05-02T08:15:00.000Z", paymentMethod: "debit_card" },
  { id: "tx-008", userId: DEMO_USER_ID, accountId: "acc-card", categoryId: "cat-subscription", merchant: "StreamPlus", amount: 219, currency: "TRY", type: "expense", occurredAt: "2026-05-01T12:00:00.000Z", paymentMethod: "credit_card", recurring: true },
  { id: "tx-009", userId: DEMO_USER_ID, accountId: "acc-card", categoryId: "cat-subscription", merchant: "CloudBox", amount: 149, currency: "TRY", type: "expense", occurredAt: "2026-05-01T12:05:00.000Z", paymentMethod: "credit_card", recurring: true },
  { id: "tx-010", userId: DEMO_USER_ID, accountId: "acc-card", categoryId: "cat-subscription", merchant: "CloudBox Pro", amount: 179, currency: "TRY", type: "expense", occurredAt: "2026-05-02T12:05:00.000Z", paymentMethod: "credit_card", recurring: true }
];

export const budgets: Budget[] = [
  { id: "budget-tech", userId: DEMO_USER_ID, categoryId: "cat-tech", monthlyLimit: 7000 },
  { id: "budget-clothes", userId: DEMO_USER_ID, categoryId: "cat-clothes", monthlyLimit: 4500 },
  { id: "budget-market", userId: DEMO_USER_ID, categoryId: "cat-market", monthlyLimit: 9000 },
  { id: "budget-food", userId: DEMO_USER_ID, categoryId: "cat-food", monthlyLimit: 5500 },
  { id: "budget-transport", userId: DEMO_USER_ID, categoryId: "cat-transport", monthlyLimit: 3000 },
  { id: "budget-subscription", userId: DEMO_USER_ID, categoryId: "cat-subscription", monthlyLimit: 700 }
];

export const goals: Goal[] = [
  { id: "goal-emergency", userId: DEMO_USER_ID, title: "Acil Durum Fonu", targetAmount: 100000, currentAmount: 32000, deadline: "2026-12-31" },
  { id: "goal-holiday", userId: DEMO_USER_ID, title: "Yaz Tatili", targetAmount: 55000, currentAmount: 18000, deadline: "2026-08-15" }
];

export const subscriptions: Subscription[] = [
  { id: "sub-stream", userId: DEMO_USER_ID, merchant: "StreamPlus", categoryId: "cat-subscription", amount: 219, currency: "TRY", cadence: "monthly", lastUsedAt: "2026-02-18", previousAmount: 179, status: "active", source: "statement" },
  { id: "sub-cloud", userId: DEMO_USER_ID, merchant: "CloudBox", categoryId: "cat-subscription", amount: 149, currency: "TRY", cadence: "monthly", lastUsedAt: "2026-05-01", status: "active", source: "statement" },
  { id: "sub-cloud-pro", userId: DEMO_USER_ID, merchant: "CloudBox Pro", categoryId: "cat-subscription", amount: 179, currency: "TRY", cadence: "monthly", lastUsedAt: "2026-05-03", status: "watching", source: "statement" }
];

export const actions: ActionItem[] = [
  {
    id: "act-rent",
    userId: DEMO_USER_ID,
    type: "payment_reminder",
    title: "Kredi kartı ödeme hatırlatıcısı",
    description: "13 Mayıs 2026 için kart borcu ödeme taslağı oluşturuldu.",
    dueAt: "2026-05-13T09:00:00.000Z",
    status: "pending",
    source: "system"
  },
  {
    id: "act-delay",
    userId: DEMO_USER_ID,
    type: "delay_purchase",
    title: "Teknoloji alışverişini 24 saat ertele",
    description: "AI Twin teknoloji kategorisinde yüksek kampanya hassasiyeti tespit etti.",
    status: "pending",
    source: "agent"
  }
];

export const business: Business = {
  id: DEMO_BUSINESS_ID,
  ownerUserId: DEMO_USER_ID,
  name: "Fintwin Studio",
  sector: "SaaS ve danışmanlık",
  cashBalance: 268000
};

export const businessCustomers: BusinessCustomer[] = [
  { id: "cus-1", businessId: DEMO_BUSINESS_ID, name: "Northwind Teknoloji", averageDelayDays: 4, invoicesPaid: 12, invoicesLate: 2, outstandingAmount: 42000 },
  { id: "cus-2", businessId: DEMO_BUSINESS_ID, name: "Atlas Perakende", averageDelayDays: 18, invoicesPaid: 8, invoicesLate: 5, outstandingAmount: 86000 },
  { id: "cus-3", businessId: DEMO_BUSINESS_ID, name: "Mavi Lojistik", averageDelayDays: 31, invoicesPaid: 5, invoicesLate: 6, outstandingAmount: 64000 }
];

export const businessCashEvents: BusinessCashEvent[] = [
  { id: "be-1", businessId: DEMO_BUSINESS_ID, title: "Maaş ödemeleri", amount: 118000, type: "outflow", dueAt: "2026-05-31" },
  { id: "be-2", businessId: DEMO_BUSINESS_ID, title: "Ofis kirası", amount: 36000, type: "outflow", dueAt: "2026-05-15" },
  { id: "be-3", businessId: DEMO_BUSINESS_ID, title: "Northwind tahsilatı", amount: 42000, type: "inflow", dueAt: "2026-05-18" },
  { id: "be-4", businessId: DEMO_BUSINESS_ID, title: "Atlas tahsilatı", amount: 86000, type: "inflow", dueAt: "2026-06-08" },
  { id: "be-5", businessId: DEMO_BUSINESS_ID, title: "Vergi ödemesi", amount: 54000, type: "outflow", dueAt: "2026-06-25" },
  { id: "be-6", businessId: DEMO_BUSINESS_ID, title: "Yeni ekipman yatırımı", amount: 76000, type: "outflow", dueAt: "2026-07-08" }
];

export const demoInvestmentHoldings: InvestmentHolding[] = [
  {
    id: "inv-demo-thyao",
    userId: DEMO_USER_ID,
    symbol: "THYAO",
    name: "Turk Hava Yollari",
    assetType: "stock",
    quantity: 12,
    averageCost: 302,
    costCurrency: "TRY",
    exchange: "BIST",
    micCode: "XIST",
    marketCurrency: "TRY",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  },
  {
    id: "inv-demo-gold",
    userId: DEMO_USER_ID,
    symbol: "XAU_GRAM_TRY",
    name: "Gram Gold / Turkish Lira",
    assetType: "gold",
    quantity: 5,
    averageCost: 2450,
    costCurrency: "TRY",
    marketCurrency: "TRY",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  },
  {
    id: "inv-demo-cash",
    userId: DEMO_USER_ID,
    symbol: "CASH_TRY",
    name: "Vadeli Mevduat TRY",
    assetType: "cash",
    quantity: 25000,
    averageCost: 1,
    costCurrency: "TRY",
    marketCurrency: "TRY",
    annualInterestRate: 42,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  }
];
