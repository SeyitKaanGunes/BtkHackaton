import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  buildAgentEvidence,
  buildWhatIfScenarios,
  calculateCampaignReadiness,
  calculateDashboardSummary,
  calculateSpendingDna,
  detectSubscriptionLeakage,
  parseAmountFromText,
  resolveCategoryFromText,
  type ActionItem,
  type AgentResponse
} from "@fintwin/shared";
import { QwenService } from "../ai/qwen.service.js";
import { DataStoreService } from "../data/data-store.service.js";
import { composeSimulationAnswer } from "./simulation-response.js";

const AgentState = Annotation.Root({
  message: Annotation<string>(),
  intent: Annotation<string>(),
  answer: Annotation<string>(),
  confidence: Annotation<number>(),
  routedAgents: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),
  suggestedActions: Annotation<ActionItem[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  })
});

@Injectable()
export class AgentService {
  constructor(
    @Inject(DataStoreService) private readonly store: DataStoreService,
    @Inject(QwenService) private readonly qwen: QwenService
  ) {}

  async chat(userId: string, message: string): Promise<AgentResponse> {
    const data = this.store.getPersonalData(userId);
    const graph = new StateGraph(AgentState)
      .addNode("supervisor", async (state) => ({
        intent: this.routeIntent(state.message),
        routedAgents: ["Supervisor Agent"]
      }))
      .addNode("twin", async () => {
        const dna = calculateSpendingDna(data.transactions, data.budgets);
        return {
          answer: `Spending DNA profilinde en yüksek risk ${dna.categories[0]?.categoryName} kategorisinde ${dna.categories[0]?.riskScore}/100. Maaş sonrası refleks skoru ${dna.paydayReflexScore}/100.`,
          confidence: 0.88,
          routedAgents: ["Twin Agent", "Risk Agent"]
        };
      })
      .addNode("simulation", async (state) => {
        const parsedAmount = parseAmountFromText(state.message);
        if (!parsedAmount.value || parsedAmount.confidence < 0.45) {
          return {
            answer: "What-if simülasyonu yapabilmem için tutarı da net yazar mısın? Örneğin: \"10.000 TL telefon alırsam ne olur?\"",
            confidence: 0.9,
            routedAgents: ["Simulation Agent"]
          };
        }
        const parsedCategory = resolveCategoryFromText(state.message);
        const simulation = buildWhatIfScenarios(
          { amount: parsedAmount.value, categoryId: parsedCategory.categoryId, description: state.message },
          {
            accounts: data.accounts,
            actions: data.actions,
            budgets: data.budgets,
            goals: data.goals,
            user: data.user,
            transactions: data.transactions
          }
        );
        if (simulation.cards.length === 0) {
          return {
            answer: "What-if simülasyonu için önce gelir, gider, bütçe veya hedef verisi eklenmeli. Demo varsayım üretmeden bekliyorum.",
            confidence: 0.9,
            routedAgents: ["Simulation Agent"]
          };
        }
        return {
          answer: composeSimulationAnswer({ simulation, parsedAmount, parsedCategory }),
          confidence: 0.9,
          routedAgents: ["Simulation Agent", "Action Agent"],
          suggestedActions: [
            {
              id: `act-agent-${randomUUID()}`,
              userId,
              type: "delay_purchase",
              title: "Satın alma kararına bilinçli mola",
              description: `${simulation.emotionalDelayMinutes || 10} dakika bekleyip güvenli limiti tekrar değerlendir.`,
              status: "pending",
              source: "agent"
            }
          ]
        };
      })
      .addNode("subscriptions", async () => {
        const leaks = detectSubscriptionLeakage(data.subscriptions);
        return {
          answer: `${leaks.length} abonelik sızıntısı bulundu. En hızlı kazanım: ${leaks[0]?.merchant} için ${leaks[0]?.recommendation}`,
          confidence: 0.86,
          routedAgents: ["Risk Agent", "Action Agent"]
        };
      })
      .addNode("education", async (state) => ({
        answer: await this.educationalAnswer(state.message),
        confidence: 0.78,
        routedAgents: ["Education Agent"]
      }))
      .addNode("assistant", async (state) => ({
        answer: await this.assistantAnswer(userId, state.message),
        confidence: this.qwen.isConfigured() ? 0.8 : 0.72,
        routedAgents: ["LLM Agent", "Twin Agent"]
      }))
      .addConditionalEdges("supervisor", (state) => state.intent, {
        assistant: "assistant",
        simulation: "simulation",
        subscriptions: "subscriptions",
        education: "education",
        twin: "twin"
      })
      .addEdge(START, "supervisor")
      .addEdge("assistant", END)
      .addEdge("twin", END)
      .addEdge("simulation", END)
      .addEdge("subscriptions", END)
      .addEdge("education", END)
      .compile();

    const result = await graph.invoke({ message });
    const dashboard = calculateDashboardSummary(data.accounts, data.transactions, data.goals, data.actions, data.budgets);
    const readiness = calculateCampaignReadiness(data.transactions, data.budgets);
    const suggestedActions = await this.persistSuggestedActions(result.suggestedActions);
    return {
      answer:
        result.answer ??
        `Finansal sağlık skorun ${dashboard.financialHealthScore}/100. Kampanya hazırlık skorun ${readiness.score}/100 ve güvenli limit ${readiness.safeLimit} TL.`,
      confidence: result.confidence ?? 0.82,
      routedAgents: result.routedAgents,
      evidence: buildAgentEvidence({
        accounts: data.accounts,
        actions: data.actions,
        budgets: data.budgets,
        goals: data.goals,
        transactions: data.transactions
      }),
      assumptions: [
        "Hesaplama oturum açan kullanıcının kayıtlı verileriyle yapılmıştır.",
        "LLM açıklama üretir; tutar ve skorlar deterministik servislerden gelir.",
        "KOBİ verileri bireysel dashboard metriklerine karıştırılmaz."
      ],
      suggestedActions
    };
  }

  private async persistSuggestedActions(actions: ActionItem[]) {
    if (!actions.length) return [];
    const persisted: ActionItem[] = [];
    for (const action of actions) {
      const existing = this.findMatchingPendingAction(action);
      persisted.push(existing ?? (await this.store.addAction(action)));
    }
    return persisted;
  }

  private findMatchingPendingAction(action: ActionItem) {
    return this.store
      .getPersonalData(action.userId)
      .actions.find((item) => item.status === "pending" && item.type === action.type && item.title === action.title && item.source === action.source);
  }

  private routeIntent(message: string) {
    const normalized = message.toLocaleLowerCase("tr-TR");
    if (/(alırsam|alsam|harcarsam|ödersem|yaparsam|ertelersem|senaryo|what-if|ne olur|olursa|giderse|zamlanırsa)/i.test(normalized)) return "simulation";
    if (/(abonelik|subscription|tekrarlayan|sızıntı)/i.test(normalized)) return "subscriptions";
    if (/(nedir|anlat|öğret|faiz|enflasyon|kredi)/i.test(normalized)) return "education";
    if (/(dna|risk|profil|ikiz|sağlık skoru|skor)/i.test(normalized)) return "twin";
    return "assistant";
  }

  private async educationalAnswer(message: string): Promise<string> {
    const unavailable =
      "Finansal eğitim cevabı için Qwen yapılandırması gerekli. QWEN_API_KEY eklenmeden bu bölüm demo cevap üretmez.";
    if (!this.qwen.isConfigured()) return unavailable;
    try {
      const response = await this.qwen.chat([
        { role: "system", content: "Türkçe, kısa ve finansal tavsiye yerine eğitim odaklı açıklama yap." },
        { role: "user", content: message }
    ]);
      return response.content || "";
    } catch {
      return unavailable;
    }
  }

  private async assistantAnswer(userId: string, message: string): Promise<string> {
    const data = this.store.getPersonalData(userId);
    const dashboard = calculateDashboardSummary(data.accounts, data.transactions, data.goals, data.actions, data.budgets);
    const dna = calculateSpendingDna(data.transactions, data.budgets);
    const leaks = detectSubscriptionLeakage(data.subscriptions);
    const fallback = `Finansal sağlık skorun ${dashboard.financialHealthScore}/100. Bu dönem gelir ${dashboard.income.toLocaleString("tr-TR")} TL, gider ${dashboard.expenses.toLocaleString("tr-TR")} TL ve net durum ${dashboard.balance.toLocaleString("tr-TR")} TL. En riskli kategori ${dna.categories[0]?.categoryName ?? "henüz belirlenmedi"}.`;

    if (!this.qwen.isConfigured()) return fallback;

    try {
      const response = await this.qwen.chat(
        [
          {
            role: "system",
            content:
              "Sen Fintwin mobil uygulamasındaki Türkçe finans asistanısın. Kullanıcının kayıtlı finans verilerine dayanarak kısa, net ve uygulanabilir cevap ver. Yatırım tavsiyesi verme; eğitim ve kişisel finans organizasyonu odağında kal. Otomatik işlem yaptığını iddia etme."
          },
          {
            role: "user",
            content: JSON.stringify({
              message,
              context: {
                period: dashboard.periodLabel,
                income: dashboard.income,
                expenses: dashboard.expenses,
                balance: dashboard.balance,
                financialHealthScore: dashboard.financialHealthScore,
                topRiskCategory: dna.categories[0]?.categoryName,
                subscriptionLeakCount: leaks.length,
                upcomingActionCount: dashboard.upcomingActions.length,
                goalCount: dashboard.goals.length
              }
            })
          }
        ],
        { temperature: 0.35 }
      );
      return response.content || fallback;
    } catch {
      return fallback;
    }
  }
}
