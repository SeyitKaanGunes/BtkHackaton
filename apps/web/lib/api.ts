import type {
  AgentResponse,
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

const apiUrl = requiredPublicEnv("NEXT_PUBLIC_API_URL").replace(/\/$/, "");

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

export interface AuthOptions {
  token?: string;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly path: string,
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export class StatementApiError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "StatementApiError";
  }
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

async function request<T>(path: string, init?: RequestInit, options?: AuthOptions): Promise<T> {
  const isStatementEndpoint = path.startsWith("/documents/statement-agent/");
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...withAuthHeaders(init, options),
      cache: "no-store"
    });
    if (!response.ok) {
      await throwApiError(path, response, isStatementEndpoint);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiRequestError || error instanceof StatementApiError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown API error";
    throw new Error(`Fintwin API request failed for ${path}: ${message}`);
  }
}

export function register(input: { name: string; email: string; password: string }) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function login(input: { email: string; password: string }) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getCurrentUser(options?: AuthOptions) {
  return request<AuthUserProfile>("/auth/me", undefined, options);
}

export function getPersonalDashboard(options?: AuthOptions) {
  return request<DashboardSummary>("/dashboard/personal", undefined, options);
}

export function getSpendingDna(options?: AuthOptions) {
  return request<SpendingDna>("/spending-dna", undefined, options);
}

export function getCampaignReadiness(options?: AuthOptions) {
  return request<CampaignReadiness>("/campaigns/readiness", undefined, options);
}

export function getSubscriptionLeaks(options?: AuthOptions) {
  return request<SubscriptionLeak[]>("/subscriptions/leakage", undefined, options);
}

export function getWhatIf(options?: AuthOptions) {
  return request<WhatIfResponse>(
    "/simulations/what-if",
    {
      method: "POST",
      body: JSON.stringify({ amount: 10000, categoryId: "cat-tech", description: "Kampanya doneminde 10.000 TL harcarsam ne olur?" })
    },
    options
  );
}

export function getInvestmentPortfolio(options?: AuthOptions) {
  return request<InvestmentPortfolioSummary>("/investments/portfolio", undefined, options);
}

export function searchMarketSymbols(query: string, options?: AuthOptions) {
  return request<MarketSymbolResult[]>(`/investments/symbols?query=${encodeURIComponent(query)}`, undefined, options);
}

export function addInvestmentHolding(input: InvestmentHoldingCreateRequest, options?: AuthOptions) {
  return request<InvestmentPortfolioSummary>(
    "/investments/holdings",
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    options
  );
}

export function deleteInvestmentHolding(id: string, options?: AuthOptions) {
  return request<InvestmentPortfolioSummary>(
    `/investments/holdings/${encodeURIComponent(id)}`,
    {
      method: "DELETE"
    },
    options
  );
}

export function getBusinesses(options?: AuthOptions) {
  return request<Business[]>("/business", undefined, options);
}

export function getBusinessDashboard(id: string, options?: AuthOptions) {
  return request<BusinessDashboard>(`/business/${id}/dashboard`, undefined, options);
}

export function getBusinessCustomers(id: string, options?: AuthOptions) {
  return request<BusinessCustomer[]>(`/business/${id}/customers`, undefined, options);
}

export function getCollectionScore(businessId: string, customerId: string, options?: AuthOptions) {
  return request<CollectionScore>(`/business/${businessId}/customers/${customerId}/collection-score`, undefined, options);
}

export async function postAgentMessage(message: string, options?: AuthOptions): Promise<AgentResponse> {
  return request<AgentResponse>(
    "/agent/chat",
    {
      method: "POST",
      body: JSON.stringify({ message })
    },
    options
  );
}

export async function postReceiptScan(imageBase64?: string, mimeType?: string, options?: AuthOptions): Promise<ReceiptScanResult> {
  return request<ReceiptScanResult>(
    "/documents/receipt-scan",
    {
      method: "POST",
      body: JSON.stringify({ imageBase64, mimeType })
    },
    options
  );
}

export async function postReceiptExpenseImport(imageBase64?: string, mimeType?: string, textHint?: string, options?: AuthOptions): Promise<ReceiptExpenseImportResult> {
  return request<ReceiptExpenseImportResult>(
    "/documents/receipt-agent/import",
    {
      method: "POST",
      body: JSON.stringify({ imageBase64, mimeType, textHint })
    },
    options
  );
}

export async function postStatementPreview(
  input: {
    fileBase64?: string;
    mimeType?: string;
    fileName?: string;
  },
  options?: AuthOptions
): Promise<StatementPreviewResult> {
  return request<StatementPreviewResult>(
    "/documents/statement-agent/preview",
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    options
  );
}

export async function postStatementConfirm(
  input: {
    documentId: string;
    selectedItemIndexes?: number[];
    skipDuplicates?: boolean;
  },
  options?: AuthOptions
): Promise<StatementConfirmResult> {
  return request<StatementConfirmResult>(
    "/documents/statement-agent/confirm",
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    options
  );
}

export async function postSubscriptionReminder(input: { merchant: string; amount?: number; remindAt: string; note?: string }, options?: AuthOptions): Promise<SubscriptionReminderResult> {
  return request<SubscriptionReminderResult>(
    "/actions/subscription-reminder",
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    options
  );
}

async function throwApiError(path: string, response: Response, isStatementEndpoint: boolean): Promise<never> {
  const body = await readErrorBody(response);
  const message = apiMessage(body) ?? (response.statusText || "API request failed");
  const code = apiCode(body);
  if (isStatementEndpoint && code) {
    throw new StatementApiError(message, code);
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
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}
