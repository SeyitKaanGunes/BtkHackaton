import type {
  ActionItem,
  AgentResponse,
  AiCfoSimulation,
  Business,
  BusinessCashEvent,
  BusinessCashEventCreateRequest,
  BusinessCreateRequest,
  BusinessCustomer,
  BusinessCustomerCreateRequest,
  BusinessDashboard,
  Category,
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
  SpeechToTextRequest,
  SpeechToTextResult,
  SpendingDna,
  StatementConfirmResult,
  StatementPreviewResult,
  SubscriptionLeak,
  SubscriptionReminderResult,
  TextToSpeechRequest,
  TextToSpeechResult,
  Transaction,
  TransactionType,
  WhatIfResponse
} from "@fintwin/shared";
import { NativeModules, Platform } from "react-native";
import * as Keychain from "react-native-keychain";

const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const devApiPort = "4000";
const devApiUrl = `http://localhost:${devApiPort}`;
const apiUrl = resolveApiUrl();
let authToken = runtimeEnv.EXPO_PUBLIC_AUTH_TOKEN?.trim() || undefined;
const biometricService = "fintwin.auth.biometric-token";
const biometricUsername = "fintwin-auth-token";

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

type MobileHomeOptions = {
  period?: DashboardPeriod;
  referenceDate?: string;
};

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

export function setAuthToken(token: string) {
  authToken = token;
}

export async function getBiometricAuthLabel() {
  try {
    const type = await Keychain.getSupportedBiometryType();
    if (type === Keychain.BIOMETRY_TYPE.FACE_ID) return "Face ID";
    if (type === Keychain.BIOMETRY_TYPE.TOUCH_ID) return "Touch ID";
    if (type === Keychain.BIOMETRY_TYPE.FINGERPRINT) return "Parmak izi";
    if (type === Keychain.BIOMETRY_TYPE.FACE) return "Yüz tanıma";
    if (type === Keychain.BIOMETRY_TYPE.IRIS) return "İris";
  } catch {
    return undefined;
  }
  return undefined;
}

async function canUseBiometricAuth() {
  try {
    return await Keychain.canImplyAuthentication({
      authenticationType: Keychain.AUTHENTICATION_TYPE.BIOMETRICS
    });
  } catch {
    return false;
  }
}

export async function persistAuthToken(token: string) {
  setAuthToken(token);

  if (!(await canUseBiometricAuth())) {
    return false;
  }

  try {
    await Keychain.setGenericPassword(biometricUsername, token, {
      service: biometricService,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      authenticationPrompt: {
        title: "Fintwin girişi",
        subtitle: "Sonraki girişlerde yüz tanımayı kullan",
        cancel: "Şifreyle devam et"
      }
    });
    return true;
  } catch {
    return false;
  }
}

export async function loadStoredAuthToken() {
  if (authToken) return authToken;
  try {
    const credentials = await Keychain.getGenericPassword({
      service: biometricService,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      authenticationPrompt: {
        title: "Fintwin'e giriş",
        subtitle: "Kayıtlı oturumunu yüz tanıma ile aç",
        cancel: "Şifreyle devam et"
      }
    });
    authToken = credentials ? credentials.password.trim() || undefined : undefined;
  } catch {
    authToken = undefined;
  }
  return authToken;
}

export async function clearAuthToken() {
  authToken = undefined;
  try {
    await Keychain.resetGenericPassword({ service: biometricService });
  } catch {
    // Clearing in-memory state is enough if the platform keychain is unavailable.
  }
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
    if (path.startsWith("/auth/")) {
      throw new Error(`Giriş servisine ulaşılamadı. Backend açık mı kontrol et. Denenen adres: ${apiUrl}${path}. Detay: ${message}`);
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

export function updateFinanceProfile(input: Partial<Pick<AuthUserProfile, "monthlyIncome" | "payday" | "currency">>) {
  return request<AuthUserProfile>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function loadCategories(kind?: TransactionType): Promise<Category[]> {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : "";
  return request<Category[]>(`/categories${query}`);
}

function periodQuery(options: MobileHomeOptions = {}) {
  const params = new URLSearchParams();
  if (options.period) params.set("period", options.period);
  if (options.referenceDate) params.set("referenceDate", options.referenceDate);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function loadMobileHome(options: MobileHomeOptions = {}): Promise<{
  user: AuthUserProfile;
  dashboard: DashboardSummary;
  dna: SpendingDna;
  campaign: CampaignReadiness;
  leaks: SubscriptionLeak[];
  simulation: WhatIfResponse;
  investmentPortfolio: InvestmentPortfolioSummary;
  businessOverview: BusinessOverview | null;
}> {
  const query = periodQuery(options);
  const [user, dashboard, dna, campaign, leaks, simulation, investmentPortfolio, businessOverview] = await Promise.all([
    getCurrentUser(),
    request<DashboardSummary>(`/dashboard/personal${query}`),
    request<SpendingDna>(`/spending-dna${query}`),
    request<CampaignReadiness>(`/campaigns/readiness${query}`),
    request<SubscriptionLeak[]>("/subscriptions/leakage"),
    request<WhatIfResponse>("/simulations/what-if", {
      method: "POST",
      body: JSON.stringify({})
    }),
    loadInvestmentPortfolio(),
    loadBusinessOverview().catch((error) => {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    })
  ]);
  return { user, dashboard, dna, campaign, leaks, simulation, investmentPortfolio, businessOverview };
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

export function synthesizeSpeech(input: TextToSpeechRequest | string): Promise<TextToSpeechResult> {
  const body = typeof input === "string" ? { text: input } : input;
  return request<TextToSpeechResult>("/speech/tts", { method: "POST", body: JSON.stringify(body) });
}

export function transcribeSpeech(input: SpeechToTextRequest): Promise<SpeechToTextResult> {
  return request<SpeechToTextResult>("/speech/stt", { method: "POST", body: JSON.stringify(input) });
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

export function loadActions(): Promise<ActionItem[]> {
  return request<ActionItem[]>("/actions");
}

export function approveAction(id: string): Promise<ActionItem> {
  return request<ActionItem>(`/actions/${encodeURIComponent(id)}/approve`, { method: "POST" });
}

export function dismissAction(id: string): Promise<ActionItem> {
  return request<ActionItem>(`/actions/${encodeURIComponent(id)}/dismiss`, { method: "POST" });
}

export function createTransaction(input: {
  merchant: string;
  amount: number;
  type: TransactionType;
  currency: Currency;
  categoryId?: string;
  categoryName?: string;
  occurredAt: string;
  paymentMethod: Transaction["paymentMethod"];
  recurring?: boolean;
}): Promise<Transaction> {
  return request<Transaction>("/transactions", { method: "POST", body: JSON.stringify(input) });
}

export function importTransactionsCsv(csv: string): Promise<{ imported: number; rows: Transaction[] }> {
  return request<{ imported: number; rows: Transaction[] }>("/transactions/import-csv", { method: "POST", body: JSON.stringify({ csv }) });
}

export function saveFcmToken(input: { token: string; platform: "ios" | "android" | "web" }): Promise<{ saved: true; platform: string }> {
  return request<{ saved: true; platform: string }>("/notifications/fcm-token", { method: "POST", body: JSON.stringify(input) });
}

export function createBusiness(input: BusinessCreateRequest): Promise<Business> {
  return request<Business>("/business", { method: "POST", body: JSON.stringify(input) });
}

export function createBusinessCustomer(businessId: string, input: BusinessCustomerCreateRequest): Promise<BusinessCustomer> {
  return request<BusinessCustomer>(`/business/${encodeURIComponent(businessId)}/customers`, { method: "POST", body: JSON.stringify(input) });
}

export function createBusinessCashEvent(businessId: string, input: BusinessCashEventCreateRequest): Promise<BusinessCashEvent> {
  return request<BusinessCashEvent>(`/business/${encodeURIComponent(businessId)}/cash-events`, { method: "POST", body: JSON.stringify(input) });
}

export function loadBusinessOverview(): Promise<BusinessOverview> {
  return request<BusinessOverview>("/business/primary/overview");
}

export function loadBusiness(): Promise<BusinessOverview | null> {
  return loadBusinessOverview().catch((error) => {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  });
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

function resolveApiUrl() {
  const envApiUrl = runtimeEnv.EXPO_PUBLIC_API_URL?.trim();
  if (envApiUrl) return envApiUrl.replace(/\/$/, "");

  const isDevRuntime = typeof __DEV__ === "boolean" ? __DEV__ : runtimeEnv.NODE_ENV !== "production";
  if (isDevRuntime) {
    const host = inferMetroHost();
    if (host) return `http://${host}:${devApiPort}`;
    return devApiUrl;
  }

  throw new Error("EXPO_PUBLIC_API_URL is required.");
}

function inferMetroHost() {
  if (Platform.OS === "web") return "localhost";

  const scriptURL = (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode?.scriptURL;
  if (!scriptURL) return undefined;

  try {
    const host = new URL(scriptURL).hostname;
    if (!host) return undefined;
    if (Platform.OS === "android" && (host === "localhost" || host === "127.0.0.1")) return "10.0.2.2";
    return host;
  } catch {
    const host = scriptURL.match(/https?:\/\/([^/:]+)/)?.[1];
    if (!host) return undefined;
    if (Platform.OS === "android" && (host === "localhost" || host === "127.0.0.1")) return "10.0.2.2";
    return host;
  }
}
