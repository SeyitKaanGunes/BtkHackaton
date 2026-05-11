import { Inject, Injectable } from "@nestjs/common";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  buildAgentEvidence,
  buildWhatIfScenarios,
  calculateCampaignReadiness,
  calculateDashboardSummary,
  calculateSpendingDna,
  detectSubscriptionLeakage,
  type ActionItem,
  type AgentResponse
} from "@fintwin/shared";
import { QwenService } from "../ai/qwen.service.js";
import { DataStoreService } from "../data/data-store.service.js";

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
        const simulation = buildWhatIfScenarios(
          { amount: this.extractAmount(state.message), categoryId: this.extractCategoryId(state.message), description: state.message },
          {
            accounts: data.accounts,
            actions: data.actions,
            budgets: data.budgets,
            goals: data.goals,
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
          answer: `What-if sonucu: güvenli limit ${simulation.safeLimit.toLocaleString("tr-TR")} TL. Riskli senaryoda ay sonu bakiye ${simulation.cards[2]!.monthEndBalance.toLocaleString("tr-TR")} TL olur.`,
          confidence: 0.9,
          routedAgents: ["Simulation Agent", "Action Agent"],
          suggestedActions: [
            {
              id: `act-agent-${Date.now()}`,
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
      suggestedActions: result.suggestedActions
    };
  }

  private routeIntent(message: string) {
    const normalized = message.toLocaleLowerCase("tr-TR");
    if (/(alırsam|harcarsam|ertelersem|senaryo|what-if|ne olur)/i.test(normalized)) return "simulation";
    if (/(abonelik|subscription|tekrarlayan|sızıntı)/i.test(normalized)) return "subscriptions";
    if (/(nedir|anlat|öğret|faiz|enflasyon|kredi)/i.test(normalized)) return "education";
    if (/(dna|risk|profil|ikiz|sağlık skoru|skor)/i.test(normalized)) return "twin";
    return "assistant";
  }

  private extractAmount(message: string) {
    const match = message.replace(/\./g, "").match(/(\d{3,})/);
    return match ? Number(match[1]) : undefined;
  }

  private extractCategoryId(message: string) {
    const normalized = message.toLocaleLowerCase("tr-TR");
    if (/(teknoloji|elektronik|telefon|bilgisayar|yazılım|software|tekno)/i.test(normalized)) return "cat-tech";
    if (/(market|bakkal|gıda|groceries)/i.test(normalized)) return "cat-market";
    if (/(yemek|restoran|burger|kahve|kafe)/i.test(normalized)) return "cat-food";
    if (/(ulaşım|taksi|metro|otobüs|benzin)/i.test(normalized)) return "cat-transport";
    if (/(giyim|kıyafet|moda|ayakkabı)/i.test(normalized)) return "cat-clothes";
    if (/(abonelik|subscription|üyelik|stream|cloud)/i.test(normalized)) return "cat-subscription";
    return undefined;
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
