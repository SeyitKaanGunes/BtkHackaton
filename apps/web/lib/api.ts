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

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, fallback: () => T, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    return (await response.json()) as T;
  } catch {
    return fallback();
  }
}

export function getPersonalDashboard() {
  return request<DashboardSummary>("/dashboard/personal", calculateDashboardSummary);
}

export function getSpendingDna() {
  return request<SpendingDna>("/spending-dna", calculateSpendingDna);
}

export function getCampaignReadiness() {
  return request<ReturnType<typeof calculateCampaignReadiness>>("/campaigns/readiness", calculateCampaignReadiness);
}

export function getSubscriptionLeaks() {
  return request<SubscriptionLeak[]>("/subscriptions/leakage", detectSubscriptionLeakage);
}

export function getWhatIf() {
  return request<WhatIfResponse>("/simulations/what-if", () => buildWhatIfScenarios({ amount: 10000, categoryId: "cat-tech" }), {
    method: "POST",
    body: JSON.stringify({ amount: 10000, categoryId: "cat-tech", description: "Kampanya döneminde 10.000 TL harcarsam ne olur?" })
  });
}

export function getBusinessDashboard(id = "business-demo") {
  return request<BusinessDashboard>(`/business/${id}/dashboard`, () => calculateBusinessDashboard(id));
}

export function getCollectionScore(customerId: string) {
  return request<CollectionScore>(`/business/business-demo/customers/${customerId}/collection-score`, () => calculateCollectionScore(customerId));
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
      evidence: ["Fallback Statement Agent sonucu"]
    }),
    { method: "POST", body: JSON.stringify(input) }
  );
}
