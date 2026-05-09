import {
  buildWhatIfScenarios,
  calculateBusinessDashboard,
  calculateCampaignReadiness,
  calculateCollectionScore,
  calculateDashboardSummary,
  calculateSpendingDna,
  demoInvestmentPortfolio,
  detectSubscriptionLeakage,
  suggestInvestmentSymbols,
  type AgentResponse,
  type BusinessDashboard,
  type CollectionScore,
  type DashboardSummary,
  type InvestmentHoldingCreateRequest,
  type InvestmentPortfolioSummary,
  type MarketSymbolResult,
  type ReceiptExpenseImportResult,
  type ReceiptScanResult,
  type SpendingDna,
  type StatementConfirmResult,
  type StatementImportResult,
  type StatementPreviewResult,
  type SubscriptionReminderResult,
  type SubscriptionLeak,
  type WhatIfResponse
} from "@fintwin/shared";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const demoFallbackEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK === "true";

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    persona: string;
    monthlyIncome: number;
    payday: number;
    currency: string;
  };
  oauth: {
    googleReady: boolean;
  };
}

export interface AuthOptions {
  token?: string;
}

function browserAuthToken() {
  if (typeof window === "undefined") return undefined;
  const stored = window.localStorage.getItem("fintwin_token");
  if (stored) return stored;
  const match = document.cookie.match(/(?:^|;\s*)fintwin_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function withAuthHeaders(init?: RequestInit, options?: AuthOptions): RequestInit {
  const token = options?.token ?? browserAuthToken();
  return {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  };
}

async function fetchJson<T>(path: string, init?: RequestInit, options?: AuthOptions): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...withAuthHeaders(init, options),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return (await response.json()) as T;
}

export class StatementApiError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "StatementApiError";
  }
}

async function request<T>(path: string, fallback: () => T, init?: RequestInit, options?: AuthOptions): Promise<T> {
  const isStatementEndpoint = path.startsWith("/documents/statement-agent/");
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...withAuthHeaders(init, options),
      cache: "no-store"
    });
    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = undefined;
      }
      const record = body && typeof body === "object" ? (body as Record<string, unknown>) : undefined;
      if (isStatementEndpoint && typeof record?.code === "string") {
        throw new StatementApiError(typeof record.message === "string" ? record.message : `API ${response.status}`, record.code);
      }
      throw new Error(`API ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (isStatementEndpoint && error instanceof StatementApiError) {
      throw error;
    }
    if (demoFallbackEnabled) {
      return fallback();
    }
    const message = error instanceof Error ? error.message : "Unknown API error";
    throw new Error(`Fintwin API request failed for ${path}: ${message}`);
  }
}

export function isDemoFallbackEnabled() {
  return demoFallbackEnabled;
}

export function fallbackOnly<T>(fallback: () => T): T {
  if (demoFallbackEnabled) {
    return fallback();
  }
  throw new Error("Demo fallback is disabled. Set NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true to use local demo responses.");
}

export function register(input: { name: string; email: string; password: string }) {
  return fetchJson<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function login(input: { email: string; password: string }) {
  return fetchJson<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getPersonalDashboard(options?: AuthOptions) {
  return request<DashboardSummary>("/dashboard/personal", calculateDashboardSummary, undefined, options);
}

export function getSpendingDna(options?: AuthOptions) {
  return request<SpendingDna>("/spending-dna", calculateSpendingDna, undefined, options);
}

export function getCampaignReadiness(options?: AuthOptions) {
  return request<ReturnType<typeof calculateCampaignReadiness>>("/campaigns/readiness", calculateCampaignReadiness, undefined, options);
}

export function getSubscriptionLeaks(options?: AuthOptions) {
  return request<SubscriptionLeak[]>("/subscriptions/leakage", detectSubscriptionLeakage, undefined, options);
}

export function getWhatIf(options?: AuthOptions) {
  return request<WhatIfResponse>("/simulations/what-if", () => buildWhatIfScenarios({ amount: 10000, categoryId: "cat-tech" }), {
    method: "POST",
    body: JSON.stringify({ amount: 10000, categoryId: "cat-tech", description: "Kampanya döneminde 10.000 TL harcarsam ne olur?" })
  }, options);
}

export function getInvestmentPortfolio(options?: AuthOptions) {
  return request<InvestmentPortfolioSummary>("/investments/portfolio", demoInvestmentPortfolio, undefined, options);
}

export function searchMarketSymbols(query: string, options?: AuthOptions) {
  return request<MarketSymbolResult[]>(`/investments/symbols?query=${encodeURIComponent(query)}`, () => suggestInvestmentSymbols(query), undefined, options);
}

export function addInvestmentHolding(input: InvestmentHoldingCreateRequest, options?: AuthOptions) {
  return request<InvestmentPortfolioSummary>("/investments/holdings", demoInvestmentPortfolio, {
    method: "POST",
    body: JSON.stringify(input)
  }, options);
}

export function deleteInvestmentHolding(id: string, options?: AuthOptions) {
  return request<InvestmentPortfolioSummary>(`/investments/holdings/${encodeURIComponent(id)}`, demoInvestmentPortfolio, {
    method: "DELETE"
  }, options);
}

export function getBusinessDashboard(id = "business-demo", options?: AuthOptions) {
  return request<BusinessDashboard>(`/business/${id}/dashboard`, () => calculateBusinessDashboard(id), undefined, options);
}

export function getCollectionScore(customerId: string, options?: AuthOptions) {
  return request<CollectionScore>(`/business/business-demo/customers/${customerId}/collection-score`, () => calculateCollectionScore(customerId), undefined, options);
}

export async function postAgentMessage(message: string): Promise<AgentResponse> {
  return request<AgentResponse>(
    "/agent/chat",
    () => ({
      answer: "Demo agent yanıtı: Harcama kararı bütçe ve tasarruf hedefini etkiliyor. Güvenli senaryo için tutarı azaltmayı öneriyorum.",
      confidence: 0.81,
      routedAgents: ["Supervisor Agent", "Simulation Agent"],
      evidence: [{ label: "Fallback", value: "API kapalıyken demo veri kullanıldı", source: "simulation" }],
      assumptions: ["Yerel API çalışmıyorsa web demo verisine düşer."],
      suggestedActions: []
    }),
    { method: "POST", body: JSON.stringify({ message }) }
  );
}

export async function postReceiptScan(imageBase64?: string, mimeType?: string): Promise<ReceiptScanResult> {
  return request<ReceiptScanResult>(
    "/documents/receipt-scan",
    () => ({
      merchant: "Demo Market",
      totalAmount: 1249.9,
      taxAmount: 113.63,
      occurredAt: "2026-05-08",
      categoryName: "Market",
      paymentMethod: "credit_card",
      confidence: 0.91,
      lineItems: [
        { name: "Temel gıda", amount: 720.4 },
        { name: "Temizlik", amount: 529.5 }
      ]
    }),
    { method: "POST", body: JSON.stringify({ imageBase64, mimeType }) }
  );
}

export async function postReceiptExpenseImport(imageBase64?: string, mimeType?: string, textHint?: string): Promise<ReceiptExpenseImportResult> {
  return request<ReceiptExpenseImportResult>(
    "/documents/receipt-agent/import",
    () => {
      const receipt: ReceiptScanResult = {
        merchant: "Demo Market",
        totalAmount: 1249.9,
        taxAmount: 113.63,
        occurredAt: "2026-05-08",
        categoryName: "Market",
        paymentMethod: "credit_card",
        confidence: 0.91,
        lineItems: [
          { name: "Temel gıda", amount: 720.4 },
          { name: "Temizlik", amount: 529.5 }
        ]
      };
      return {
        agentName: "Receipt Agent",
        receipt,
        addedToExpenses: true,
        transaction: {
          id: `tx-receipt-fallback`,
          userId: "user-demo",
          accountId: "acc-card",
          categoryId: "cat-market",
          merchant: receipt.merchant,
          amount: receipt.totalAmount,
          currency: "TRY",
          type: "expense",
          occurredAt: `${receipt.occurredAt}T12:00:00.000Z`,
          paymentMethod: receipt.paymentMethod,
          tags: ["receipt_agent"]
        },
        evidence: ["Fallback Receipt Agent sonucu"]
      };
    },
    { method: "POST", body: JSON.stringify({ imageBase64, mimeType, textHint }) }
  );
}

export async function postStatementImport(input: { statementText?: string; imageBase64?: string; mimeType?: string; fileName?: string }): Promise<StatementImportResult> {
  return request<StatementImportResult>(
    "/documents/statement-agent/import",
    () => ({
      agentName: "Statement Agent",
      statementMonth: "2026-05",
      totalAmount: 15059,
      importedCount: 4,
      skippedCount: 0,
      items: [
        { merchant: "TeknoMarket", amount: 9800, occurredAt: "2026-05-07", categoryName: "Teknoloji", paymentMethod: "credit_card", confidence: 0.88 },
        { merchant: "Gece Burger", amount: 840, occurredAt: "2026-05-08", categoryName: "Yemek", paymentMethod: "credit_card", confidence: 0.86 },
        { merchant: "ModaBox", amount: 4200, occurredAt: "2026-05-08", categoryName: "Giyim", paymentMethod: "credit_card", confidence: 0.84 },
        { merchant: "StreamPlus", amount: 219, occurredAt: "2026-05-01", categoryName: "Abonelik", paymentMethod: "credit_card", confidence: 0.9 }
      ],
      transactions: [],
      recurringSubscriptions: [
        {
          id: "recurring-streamplus-219",
          merchant: "StreamPlus",
          amount: 219,
          categoryName: "Abonelik",
          occurrenceCount: 2,
          lastChargedAt: "2026-05-01",
          nextEstimatedAt: "2026-06-01",
          confidence: 0.9
        }
      ],
      evidence: ["Fallback Statement Agent sonucu"]
    }),
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function postStatementPreview(input: {
  fileBase64?: string;
  mimeType?: string;
  fileName?: string;
}): Promise<StatementPreviewResult> {
  return request<StatementPreviewResult>(
    "/documents/statement-agent/preview",
    () => {
      throw new Error("Statement preview demo fallback yok");
    },
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function postStatementConfirm(input: {
  documentId: string;
  selectedItemIndexes?: number[];
  skipDuplicates?: boolean;
}): Promise<StatementConfirmResult> {
  return request<StatementConfirmResult>(
    "/documents/statement-agent/confirm",
    () => {
      throw new Error("Statement confirm demo fallback yok");
    },
    { method: "POST", body: JSON.stringify(input) }
  );
}

export async function postSubscriptionReminder(input: { merchant: string; amount?: number; remindAt: string; note?: string }): Promise<SubscriptionReminderResult> {
  return request<SubscriptionReminderResult>(
    "/actions/subscription-reminder",
    () => ({
      scheduled: true,
      action: {
        id: `act-subscription-fallback-${input.merchant}`,
        userId: "user-demo",
        type: "calendar_bill",
        title: `${input.merchant} aboneliğini hatırlat`,
        description: `${input.merchant} aboneliği için hatırlatma oluşturuldu.`,
        dueAt: `${input.remindAt}T09:00:00.000Z`,
        status: "pending",
        source: "agent"
      }
    }),
    { method: "POST", body: JSON.stringify(input) }
  );
}
