import { Platform } from "react-native";
import {
  buildWhatIfScenarios,
  calculateBusinessDashboard,
  calculateCampaignReadiness,
  calculateCollectionScore,
  calculateDashboardSummary,
  calculateSpendingDna,
  detectSubscriptionLeakage,
  type AgentResponse,
  type BusinessDashboard,
  type CollectionScore,
  type DashboardSummary,
  type ReceiptExpenseImportResult,
  type ReceiptScanResult,
  type SpendingDna,
  type StatementImportResult,
  type SubscriptionLeak,
  type WhatIfResponse
} from "@fintwin/shared";

const defaultUrl = Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";
const apiUrl = defaultUrl;

async function request<T>(path: string, fallback: () => T, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    return (await response.json()) as T;
  } catch {
    return fallback();
  }
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

export function importStatement(imageBase64?: string, mimeType?: string): Promise<StatementImportResult> {
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
      evidence: ["Mobil fallback Statement Agent sonucu"]
    }),
    { method: "POST", body: JSON.stringify({ imageBase64, mimeType }) }
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
