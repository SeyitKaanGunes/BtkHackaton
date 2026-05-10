import type {
  AgentResponse,
  AiCfoSimulation,
  Business,
  BusinessCustomer,
  BusinessDashboard,
  CollectionScore,
  DashboardSummary,
  InvestmentHoldingCreateRequest,
  InvestmentPortfolioSummary,
  MarketSymbolResult,
  ReceiptExpenseImportResult,
  ReceiptScanResult,
  RiskLevel,
  SpendingDna,
  StatementConfirmResult,
  StatementPreviewResult,
  SubscriptionLeak,
  SubscriptionReminderResult,
  WhatIfResponse
} from "@fintwin/shared";

const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const apiUrl = requiredPublicEnv("EXPO_PUBLIC_API_URL").replace(/\/$/, "");
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

export type AuthUserProfile = AuthResponse["user"];

export interface CampaignReadiness {
  score: number;
  riskLevel: RiskLevel;
  safeLimit: number;
  notes: string[];
}

export class ApiRequestError extends Error {
  constructor(
    public readonly path: string,
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(`API ${status}: ${message}`);
    this.name = "ApiRequestError";
  }
}

export class StatementApiError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "StatementApiError";
  }
}

export class ReceiptApiError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "ReceiptApiError";
  }
}

export function setAuthToken(token: string) {
  authToken = token;
}

export function hasAuthToken() {
  return Boolean(authToken);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isStatementEndpoint = path.startsWith("/documents/statement-agent/");
  const isReceiptEndpoint = path.startsWith("/documents/receipt");
  const isDocumentEndpoint = isStatementEndpoint || isReceiptEndpoint;
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
      await throwApiError(path, response, isStatementEndpoint);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiRequestError || error instanceof StatementApiError || error instanceof ReceiptApiError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown API error";
    if (isDocumentEndpoint) {
      throw new Error(`Belge API'sine ulaşılamadı. Demo sonuç üretilmedi. API adresini ve backend'i kontrol edin: ${message}`);
    }
    throw new Error(`Fintwin API request failed for ${path}: ${message}`);
  }
}

export function login(input: { email: string; password: string }) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function register(input: { name: string; email: string; password: string }) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getCurrentUser() {
  return request<AuthUserProfile>("/auth/me");
}

export async function loadMobileHome(): Promise<{
  user: AuthUserProfile;
  dashboard: DashboardSummary;
  dna: SpendingDna;
  campaign: CampaignReadiness;
  leaks: SubscriptionLeak[];
  simulation: WhatIfResponse;
}> {
  const [user, dashboard, dna, campaign, leaks, simulation] = await Promise.all([
    getCurrentUser(),
    request<DashboardSummary>("/dashboard/personal"),
    request<SpendingDna>("/spending-dna"),
    request<CampaignReadiness>("/campaigns/readiness"),
    request<SubscriptionLeak[]>("/subscriptions/leakage"),
    request<WhatIfResponse>("/simulations/what-if", {
      method: "POST",
      body: JSON.stringify({})
    })
  ]);
  return { user, dashboard, dna, campaign, leaks, simulation };
}

export function loadInvestmentPortfolio(): Promise<InvestmentPortfolioSummary> {
  return request<InvestmentPortfolioSummary>("/investments/portfolio");
}

export function searchInvestmentSymbols(query: string): Promise<MarketSymbolResult[]> {
  return request<MarketSymbolResult[]>(`/investments/symbols?query=${encodeURIComponent(query)}`);
}

export function addInvestmentHolding(input: InvestmentHoldingCreateRequest): Promise<InvestmentPortfolioSummary> {
  return request<InvestmentPortfolioSummary>("/investments/holdings", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function deleteInvestmentHolding(id: string): Promise<InvestmentPortfolioSummary> {
  return request<InvestmentPortfolioSummary>(`/investments/holdings/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export function sendAgentMessage(message: string) {
  return request<AgentResponse>("/agent/chat", { method: "POST", body: JSON.stringify({ message }) });
}

export function scanReceipt(imageBase64?: string, mimeType?: string) {
  return request<ReceiptScanResult>("/documents/receipt-scan", { method: "POST", body: JSON.stringify({ imageBase64, mimeType }) });
}

export function importReceiptExpense(imageBase64?: string, mimeType?: string): Promise<ReceiptExpenseImportResult> {
  return request<ReceiptExpenseImportResult>("/documents/receipt-agent/import", { method: "POST", body: JSON.stringify({ imageBase64, mimeType }) });
}

export function importStatementPreview(fileBase64?: string, mimeType?: string, fileName?: string): Promise<StatementPreviewResult> {
  return request<StatementPreviewResult>("/documents/statement-agent/preview", { method: "POST", body: JSON.stringify({ fileBase64, mimeType, fileName }) });
}

export function confirmStatementImport(documentId: string, selectedItemIndexes?: number[], skipDuplicates?: boolean): Promise<StatementConfirmResult> {
  return request<StatementConfirmResult>("/documents/statement-agent/confirm", { method: "POST", body: JSON.stringify({ documentId, selectedItemIndexes, skipDuplicates }) });
}

export function createSubscriptionReminder(input: { merchant: string; amount?: number; remindAt: string; note?: string }): Promise<SubscriptionReminderResult> {
  return request<SubscriptionReminderResult>("/actions/subscription-reminder", { method: "POST", body: JSON.stringify(input) });
}

export async function loadBusiness(): Promise<{ business: Business; dashboard: BusinessDashboard; customers: BusinessCustomer[]; scores: CollectionScore[] }> {
  const [business] = await request<Business[]>("/business");
  if (!business) throw new Error("KOBI profili bulunamadi.");

  const [dashboard, customers] = await Promise.all([
    request<BusinessDashboard>(`/business/${business.id}/dashboard`),
    request<BusinessCustomer[]>(`/business/${business.id}/customers`)
  ]);
  const scores = await Promise.all(customers.map((customer) => request<CollectionScore>(`/business/${business.id}/customers/${customer.id}/collection-score`)));
  return { business, dashboard, customers, scores };
}

export function simulateBusinessDecision(businessId: string, input: { amount: number; decision?: string }): Promise<AiCfoSimulation> {
  return request<AiCfoSimulation>(`/business/${businessId}/ai-cfo/simulate`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

async function throwApiError(path: string, response: Response, isStatementEndpoint: boolean): Promise<never> {
  const body = await readErrorBody(response);
  const message = apiMessage(body) ?? (response.statusText || "API request failed");
  const code = apiCode(body);
  if (isStatementEndpoint && code) {
    throw new StatementApiError(message, code);
  }
  if (path.startsWith("/documents/receipt") && code) {
    throw new ReceiptApiError(message, code);
  }
  throw new ApiRequestError(path, response.status, message, code);
}

async function readErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function apiMessage(body: unknown) {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  if (Array.isArray(record.message)) return record.message.join(", ");
  if (typeof record.message === "string") return record.message;
  if (typeof record.error === "string") return record.error;
  return undefined;
}

function apiCode(body: unknown) {
  return body && typeof body === "object" && typeof (body as Record<string, unknown>).code === "string" ? String((body as Record<string, unknown>).code) : undefined;
}

function requiredPublicEnv(key: string) {
  const value = runtimeEnv[key]?.trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}
