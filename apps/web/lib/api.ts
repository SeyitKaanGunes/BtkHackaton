import type {
  AgentResponse,
  ActionItem,
  AiCfoSimulation,
  Business,
  BusinessCashEvent,
  BusinessCashEventCreateRequest,
  BusinessCreateRequest,
  BusinessCustomer,
  BusinessCustomerCreateRequest,
  BusinessDashboard,
  CollectionScore,
  Currency,
  DashboardPeriod,
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
  SpeechToTextRequest,
  SpeechToTextResult,
  SubscriptionLeak,
  SubscriptionReminderResult,
  TextToSpeechRequest,
  TextToSpeechResult,
  Transaction,
  TransactionType,
  WhatIfResponse
} from "@fintwin/shared";

const apiUrl = resolveApiUrl();

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

function resolveApiUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const isProduction = process.env.NODE_ENV === "production";
  if (!configured) {
    if (isProduction) throw new Error("NEXT_PUBLIC_API_URL is required when NODE_ENV=production.");
    return "http://localhost:4000";
  }

  const normalized = configured.replace(/\/$/, "");
  if (isProduction && (normalized === "http://localhost:4000" || normalized.includes("your-api-domain.com"))) {
    throw new Error("NEXT_PUBLIC_API_URL must point to the production API when NODE_ENV=production.");
  }
  return normalized;
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

export interface DashboardRequestOptions extends AuthOptions {
  period?: DashboardPeriod;
  referenceDate?: string;
}

export interface BusinessOverview {
  business: Business;
  dashboard: BusinessDashboard;
  customers: BusinessCustomer[];
  scores: CollectionScore[];
  collectionScores: Array<CollectionScore & { customerName: string; outstandingAmount: number }>;
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

export class ReceiptApiError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "ReceiptApiError";
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
  const isReceiptEndpoint = path.startsWith("/documents/receipt");
  const isDocumentEndpoint = isStatementEndpoint || isReceiptEndpoint;
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
    if (error instanceof ReceiptApiError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown API error";
    if (isDocumentEndpoint) {
      throw new Error(`Belge API'sine ulaşılamadı. Demo sonuç üretilmedi. API adresini ve backend'i kontrol edin: ${message}`);
    }
    throw new Error(`Fintwin API request failed for ${path}: ${message}`);
  }
}

function periodPath(path: string, options?: DashboardRequestOptions) {
  const params = new URLSearchParams();
  if (options?.period) params.set("period", options.period);
  if (options?.referenceDate) params.set("referenceDate", options.referenceDate);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
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

export function loginWithGoogle(input: { idToken: string; nonce?: string }) {
  return request<AuthResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function getCurrentUser(options?: AuthOptions) {
  return request<AuthUserProfile>("/auth/me", undefined, options);
}

export function getPersonalDashboard(options?: DashboardRequestOptions) {
  return request<DashboardSummary>(periodPath("/dashboard/personal", options), undefined, options);
}

export function getSpendingDna(options?: DashboardRequestOptions) {
  return request<SpendingDna>(periodPath("/spending-dna", options), undefined, options);
}

export function getCampaignReadiness(options?: DashboardRequestOptions) {
  return request<CampaignReadiness>(periodPath("/campaigns/readiness", options), undefined, options);
}

export function getSubscriptionLeaks(options?: AuthOptions) {
  return request<SubscriptionLeak[]>("/subscriptions/leakage", undefined, options);
}

export function getWhatIf(options?: AuthOptions) {
  return request<WhatIfResponse>(
    "/simulations/what-if",
    {
      method: "POST",
      body: JSON.stringify({})
    },
    options
  );
}

export function getActions(options?: AuthOptions) {
  return request<ActionItem[]>("/actions", undefined, options);
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

export function getBusinessOverview(options?: AuthOptions) {
  return request<BusinessOverview>("/business/primary/overview", undefined, options);
}

export function createBusiness(input: BusinessCreateRequest, options?: AuthOptions) {
  return request<Business>(
    "/business",
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    options
  );
}

export function getBusinessDashboard(id: string, options?: AuthOptions) {
  return request<BusinessDashboard>(`/business/${id}/dashboard`, undefined, options);
}

export function getBusinessCustomers(id: string, options?: AuthOptions) {
  return request<BusinessCustomer[]>(`/business/${id}/customers`, undefined, options);
}

export function createBusinessCustomer(id: string, input: BusinessCustomerCreateRequest, options?: AuthOptions) {
  return request<BusinessCustomer>(
    `/business/${id}/customers`,
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    options
  );
}

export function createBusinessCashEvent(id: string, input: BusinessCashEventCreateRequest, options?: AuthOptions) {
  return request<BusinessCashEvent>(
    `/business/${id}/cash-events`,
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    options
  );
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

export function synthesizeSpeech(input: TextToSpeechRequest | string, options?: AuthOptions): Promise<TextToSpeechResult> {
  const body = typeof input === "string" ? { text: input } : input;
  return request<TextToSpeechResult>(
    "/speech/tts",
    {
      method: "POST",
      body: JSON.stringify(body)
    },
    options
  );
}

export function transcribeSpeech(input: SpeechToTextRequest, options?: AuthOptions): Promise<SpeechToTextResult> {
  return request<SpeechToTextResult>(
    "/speech/stt",
    {
      method: "POST",
      body: JSON.stringify(input)
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

export function approveAction(id: string, options?: AuthOptions): Promise<ActionItem> {
  return request<ActionItem>(
    `/actions/${encodeURIComponent(id)}/approve`,
    {
      method: "POST"
    },
    options
  );
}

export function dismissAction(id: string, options?: AuthOptions): Promise<ActionItem> {
  return request<ActionItem>(
    `/actions/${encodeURIComponent(id)}/dismiss`,
    {
      method: "POST"
    },
    options
  );
}

export function createTransaction(
  input: {
    merchant: string;
    amount: number;
    type: TransactionType;
    currency: Currency;
    categoryId: string;
    occurredAt: string;
    paymentMethod: Transaction["paymentMethod"];
  },
  options?: AuthOptions
): Promise<Transaction> {
  return request<Transaction>(
    "/transactions",
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    options
  );
}

export function simulateBusinessDecision(businessId: string, input: { amount: number; decision?: string }, options?: AuthOptions): Promise<AiCfoSimulation> {
  return request<AiCfoSimulation>(
    `/business/${encodeURIComponent(businessId)}/ai-cfo/simulate`,
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
