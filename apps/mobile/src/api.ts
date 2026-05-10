import { Platform } from "react-native";
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
  type StatementPreviewResult,
  type SubscriptionReminderResult,
  type SubscriptionLeak,
  type WhatIfResponse
} from "@fintwin/shared";

const defaultUrl = Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";
const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const configuredUrl = runtimeEnv.EXPO_PUBLIC_API_URL?.trim();
const apiUrl = (configuredUrl || defaultUrl).replace(/\/$/, "");
const demoFallbackEnabled = runtimeEnv.EXPO_PUBLIC_ENABLE_DEMO_FALLBACK === "true";
let authToken = runtimeEnv.EXPO_PUBLIC_AUTH_TOKEN?.trim() || undefined;

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

export function setAuthToken(token: string) {
  authToken = token;
}

export function hasAuthToken() {
  return Boolean(authToken);
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers ?? {})
    }
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

async function request<T>(path: string, fallback: () => T, init?: RequestInit): Promise<T> {
  const isStatementEndpoint = path.startsWith("/documents/statement-agent/");
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        ...(init?.headers ?? {})
      }
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
  throw new Error("Demo fallback is disabled. Set EXPO_PUBLIC_ENABLE_DEMO_FALLBACK=true to use local demo responses.");
}

export function login(input: { email: string; password: string }) {
  return fetchJson<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function register(input: { name: string; email: string; password: string }) {
  return fetchJson<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function loadMobileHome(): Promise<{
  dashboard: DashboardSummary;
  dna: SpendingDna;
  campaign: ReturnType<typeof calculateCampaignReadiness>;
  leaks: SubscriptionLeak[];
  simulation: WhatIfResponse;
}> {
  const [dashboard, dna, campaign, leaks, simulation] = await Promise.all([
    request("/dashboard/personal", calculateDashboardSummary),
    request("/spending-dna", calculateSpendingDna),
    request("/campaigns/readiness", calculateCampaignReadiness),
    request("/subscriptions/leakage", detectSubscriptionLeakage),
    request("/simulations/what-if", () => buildWhatIfScenarios({ amount: 10000, categoryId: "cat-tech" }), {
      method: "POST",
      body: JSON.stringify({ amount: 10000, categoryId: "cat-tech" })
    })
  ]);
  return { dashboard, dna, campaign, leaks, simulation };
}

export function loadInvestmentPortfolio(): Promise<InvestmentPortfolioSummary> {
  return request<InvestmentPortfolioSummary>("/investments/portfolio", demoInvestmentPortfolio);
}

export function searchInvestmentSymbols(query: string): Promise<MarketSymbolResult[]> {
  return request<MarketSymbolResult[]>(`/investments/symbols?query=${encodeURIComponent(query)}`, () => suggestInvestmentSymbols(query));
}

export function addInvestmentHolding(input: InvestmentHoldingCreateRequest): Promise<InvestmentPortfolioSummary> {
  return request<InvestmentPortfolioSummary>("/investments/holdings", demoInvestmentPortfolio, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function deleteInvestmentHolding(id: string): Promise<InvestmentPortfolioSummary> {
  return request<InvestmentPortfolioSummary>(`/investments/holdings/${encodeURIComponent(id)}`, demoInvestmentPortfolio, {
    method: "DELETE"
  });
}

export function sendAgentMessage(message: string) {
  return request<AgentResponse>(
    "/agent/chat",
    () => ({
      answer: "Demo agent: Bu karar tasarruf hedefini etkiliyor. Güvenli limitte kalmak için harcamayı azaltmayı öneriyorum.",
      confidence: 0.82,
      routedAgents: ["Supervisor Agent", "Simulation Agent"],
      evidence: [{ label: "Mobil fallback", value: "Yerel API kapalı", source: "simulation" }],
      assumptions: ["iOS simulator API'ye ulaşamazsa demo veri gösterilir."],
      suggestedActions: []
    }),
    { method: "POST", body: JSON.stringify({ message }) }
  );
}

export function scanReceipt(imageBase64?: string, mimeType?: string) {
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

export function importReceiptExpense(imageBase64?: string, mimeType?: string): Promise<ReceiptExpenseImportResult> {
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
          id: "tx-receipt-mobile-fallback",
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
        evidence: ["Mobil fallback Receipt Agent sonucu"]
      };
    },
    { method: "POST", body: JSON.stringify({ imageBase64, mimeType }) }
  );
}

export function importStatementPreview(fileBase64?: string, mimeType?: string, fileName?: string): Promise<StatementPreviewResult> {
  return request<StatementPreviewResult>(
    "/documents/statement-agent/preview",
    () => {
      throw new Error("Statement preview demo fallback yok");
    },
    { method: "POST", body: JSON.stringify({ fileBase64, mimeType, fileName }) }
  );
}

export function confirmStatementImport(documentId: string, selectedItemIndexes?: number[], skipDuplicates?: boolean): Promise<StatementConfirmResult> {
  return request<StatementConfirmResult>(
    "/documents/statement-agent/confirm",
    () => {
      throw new Error("Statement confirm demo fallback yok");
    },
    { method: "POST", body: JSON.stringify({ documentId, selectedItemIndexes, skipDuplicates }) }
  );
}

export function createSubscriptionReminder(input: { merchant: string; amount?: number; remindAt: string; note?: string }): Promise<SubscriptionReminderResult> {
  return request<SubscriptionReminderResult>(
    "/actions/subscription-reminder",
    () => ({
      scheduled: true,
      action: {
        id: `act-subscription-mobile-fallback-${input.merchant}`,
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

export async function loadBusiness(): Promise<{ dashboard: BusinessDashboard; scores: CollectionScore[] }> {
  const [dashboard, atlas, mavi] = await Promise.all([
    request("/business/business-demo/dashboard", () => calculateBusinessDashboard("business-demo")),
    request("/business/business-demo/customers/cus-2/collection-score", () => calculateCollectionScore("cus-2")),
    request("/business/business-demo/customers/cus-3/collection-score", () => calculateCollectionScore("cus-3"))
  ]);
  return { dashboard, scores: [atlas, mavi] };
}
