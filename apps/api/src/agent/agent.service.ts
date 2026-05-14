import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
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
  type AgentPlanStep,
  type AgentQualitySignal,
  type AgentResponse
} from "@fintwin/shared";
import { QwenService, type QwenChatResult } from "../ai/qwen.service.js";
import { DataStoreService } from "../data/data-store.service.js";
import { buildTokenFriendlyAgentContext } from "./agent-context.js";
import { composeSimulationAnswer } from "./simulation-response.js";

type AgentIntent = "assistant" | "simulation" | "subscriptions" | "education" | "twin";

type StructuredAssistantAnswer = {
  answer: string;
  confidence: number;
  warnings: string[];
  model?: string;
  tokenUsage?: AgentQualitySignal["tokenUsage"];
  contextVersion?: number;
  contextChars?: number;
  truncatedSections?: string[];
};

type EducationAnswer = {
  answer: string;
  warnings: string[];
  model?: string;
  tokenUsage?: AgentQualitySignal["tokenUsage"];
};

type AgentGraphQualityResult = {
  qualityWarnings?: string[];
  model?: string;
  tokenUsage?: AgentQualitySignal["tokenUsage"];
  contextVersion?: number;
  contextChars?: number;
  truncatedSections?: string[];
};

const AgentState = Annotation.Root({
  message: Annotation<string>(),
  intent: Annotation<AgentIntent>(),
  answer: Annotation<string>(),
  confidence: Annotation<number>(),
  routedAgents: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),
  suggestedActions: Annotation<ActionItem[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),
  agenticPlan: Annotation<AgentPlanStep[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),
  qualityWarnings: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),
  model: Annotation<string | undefined>(),
  tokenUsage: Annotation<AgentQualitySignal["tokenUsage"] | undefined>(),
  contextVersion: Annotation<number | undefined>(),
  contextChars: Annotation<number | undefined>(),
  truncatedSections: Annotation<string[]>({
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
    await this.store.ensureMonthlySalaryTransactions(userId);
    const data = this.store.getPersonalData(userId);
    const graph = new StateGraph(AgentState)
      .addNode("supervisor", async (state) => {
        const intent = this.routeIntent(state.message);
        return {
          intent,
          routedAgents: ["Supervisor Agent"],
          agenticPlan: [
            {
              agent: "Supervisor Agent",
              purpose: "Mesaj niyetini seçip doğru finans uzmanına yönlendirmek.",
              status: "completed",
              output: intent
            }
          ]
        };
      })
      .addNode("twin", async () => {
        const dna = calculateSpendingDna(data.transactions, data.budgets, {}, data.categories);
        const topCategory = dna.categories[0];
        const topReason = topCategory?.reasons?.[0] ? ` Neden: ${topCategory.reasons[0]}` : "";
        return {
          answer: `Spending DNA profilinde en yüksek risk ${topCategory?.categoryName ?? "henüz belirlenmedi"} kategorisinde ${topCategory?.riskScore ?? 0}/100. Maaş sonrası refleks skoru ${dna.paydayReflexScore}/100. Veri güveni: ${dna.dataConfidenceLevel ?? "low"}.${topReason}`,
          confidence: 0.88,
          routedAgents: ["Twin Agent", "Risk Agent"],
          agenticPlan: [
            {
              agent: "Twin Agent",
              purpose: "Spending DNA metriklerini deterministik servislerden hesaplamak.",
              status: "completed",
              output: `${topCategory?.categoryName ?? "kategori yok"} risk ${topCategory?.riskScore ?? 0}/100`
            },
            {
              agent: "Risk Agent",
              purpose: "Davranışsal risk sinyalini kısa yoruma çevirmek.",
              status: "completed"
            }
          ]
        };
      })
      .addNode("simulation", async (state) => {
        const parsedAmount = parseAmountFromText(state.message);
        if (!parsedAmount.value || parsedAmount.confidence < 0.45) {
          return {
            answer: "What-if simülasyonu yapabilmem için tutarı da net yazar mısın? Örneğin: \"10.000 TL telefon alırsam ne olur?\"",
            confidence: 0.9,
            routedAgents: ["Simulation Agent"],
            agenticPlan: [
              {
                agent: "Simulation Agent",
                purpose: "Mesajdan karar tutarını çıkarmak.",
                status: "blocked",
                output: parsedAmount.reason ?? "Tutar güveni düşük."
              }
            ],
            qualityWarnings: ["Net tutar bulunmadığı için what-if varsayımı üretilmedi."]
          };
        }
        const parsedCategory = resolveCategoryFromText(state.message);
        const simulation = buildWhatIfScenarios(
          { amount: parsedAmount.value, categoryId: parsedCategory.categoryId, description: state.message },
          {
            accounts: data.accounts,
            actions: data.actions,
            budgets: data.budgets,
            categories: data.categories,
            goals: data.goals,
            subscriptions: data.subscriptions,
            user: data.user,
            transactions: data.transactions
          }
        );
        if (simulation.cards.length === 0) {
          return {
            answer: "What-if simülasyonu için önce gelir, gider, bütçe veya hedef verisi eklenmeli. Demo varsayım üretmeden bekliyorum.",
            confidence: 0.9,
            routedAgents: ["Simulation Agent"],
            agenticPlan: [
              {
                agent: "Simulation Agent",
                purpose: "Gerçek finans verisiyle karar senaryosu üretmek.",
                status: "blocked",
                output: "Yeterli gelir, gider, bütçe veya hedef verisi yok."
              }
            ],
            qualityWarnings: ["What-if için boş veriyle sahte senaryo üretilmedi."]
          };
        }
        return {
          answer: composeSimulationAnswer({ simulation, parsedAmount, parsedCategory }),
          confidence: 0.9,
          routedAgents: ["Simulation Agent", "Action Agent"],
          agenticPlan: [
            {
              agent: "Simulation Agent",
              purpose: "Tutar, kategori, bütçe, hedef ve nakit akışıyla üç karar senaryosu üretmek.",
              status: "completed",
              output: `${parsedAmount.value} ${parsedAmount.currency} / ${simulation.resolvedCategoryName ?? parsedCategory.category ?? "kategori belirsiz"}`
            },
            {
              agent: "Action Agent",
              purpose: "Riskli harcama için kullanıcı onaylı bekleme aksiyonu önermek.",
              status: "completed"
            }
          ],
          suggestedActions: [
            {
              id: `act-agent-${randomUUID()}`,
              userId,
              type: "delay_purchase",
              title: "Satın alma kararına bilinçli mola",
              description: `${simulation.emotionalDelayMinutes || 10} dakika bekleyip harcama sınırını tekrar değerlendir.`,
              status: "pending",
              source: "agent"
            }
          ]
        };
      })
      .addNode("subscriptions", async () => {
        const leaks = detectSubscriptionLeakage(data.subscriptions);
        if (leaks.length === 0) {
          return {
            answer: "Şu an kayıtlı aboneliklerde sızıntı görünmüyor. Daha net analiz için ekstre importu yaptıkça kullanılmayan, yinelenen veya fiyatı artan abonelikleri burada işaretlerim.",
            confidence: 0.86,
            routedAgents: ["Risk Agent", "Action Agent"],
            agenticPlan: [
              {
                agent: "Risk Agent",
                purpose: "Aboneliklerde tekrar, fiyat artışı ve kullanım sızıntısı aramak.",
                status: "completed",
                output: "Sızıntı bulunmadı."
              },
              {
                agent: "Action Agent",
                purpose: "Gerekiyorsa abonelik aksiyonu önermek.",
                status: "skipped",
                output: "Aksiyon gerektiren aday yok."
              }
            ]
          };
        }
        const topLeak = leaks[0];
        return {
          answer: `${leaks.length} abonelik sızıntısı bulundu. En hızlı kazanım: ${topLeak.merchant} için ${topLeak.recommendation}`,
          confidence: 0.86,
          routedAgents: ["Risk Agent", "Action Agent"],
          agenticPlan: [
            {
              agent: "Risk Agent",
              purpose: "Abonelik sızıntılarını deterministik kurallarla sıralamak.",
              status: "completed",
              output: `${leaks.length} aday, ilk aday ${topLeak.merchant}`
            },
            {
              agent: "Action Agent",
              purpose: "Abonelik için kullanıcı onaylı takip/iptal aksiyonu önermek.",
              status: "skipped",
              output: "Bu turda otomatik kayıt yazılmadı."
            }
          ]
        };
      })
      .addNode("education", async (state) => {
        const education = await this.educationalAnswer(state.message);
        return {
          answer: education.answer,
          confidence: 0.78,
          routedAgents: ["Education Agent"],
          agenticPlan: [
            {
              agent: "Education Agent",
              purpose: "Finans kavramını kısa ve eğitim odaklı açıklamak.",
              status: education.warnings.length ? "blocked" : "completed",
              output: education.model ? `${education.model} / maxTokens=450` : "maxTokens=450"
            }
          ],
          qualityWarnings: education.warnings,
          model: education.model,
          tokenUsage: education.tokenUsage
        };
      })
      .addNode("assistant", async (state) => {
        const assistant = await this.assistantAnswer(userId, state.message);
        return {
          answer: assistant.answer,
          confidence: assistant.confidence,
          routedAgents: ["LLM Agent", "Twin Agent", "Evidence Guard"],
          agenticPlan: [
            {
              agent: "Twin Agent",
              purpose: "Kullanıcı finans profilini token dostu bağlama çevirmek.",
              status: "completed",
              output: `${assistant.contextChars ?? 0} karakter bağlam`
            },
            {
              agent: "LLM Agent",
              purpose: "Yalnızca özet bağlama dayanarak Türkçe cevap üretmek.",
              status: "completed",
              output: assistant.model ?? "model bilinmiyor"
            },
            {
              agent: "Evidence Guard",
              purpose: "Cevabı otomatik işlem iddiası ve riskli yatırım dili açısından kontrol etmek.",
              status: "completed",
              output: assistant.warnings[0]
            }
          ],
          qualityWarnings: assistant.warnings,
          model: assistant.model,
          tokenUsage: assistant.tokenUsage,
          contextVersion: assistant.contextVersion,
          contextChars: assistant.contextChars,
          truncatedSections: assistant.truncatedSections ?? []
        };
      })
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
    const dashboard = calculateDashboardSummary(data.accounts, data.transactions, data.goals, data.actions, data.budgets, {}, data.categories);
    const readiness = calculateCampaignReadiness(data.transactions, data.budgets, {}, data.categories);
    const suggestedActions = await this.persistSuggestedActions(result.suggestedActions);
    const response = {
      answer:
        result.answer ??
        `Finansal sağlık skorun ${dashboard.financialHealthScore}/100. Dikkatli harcama sınırın ${readiness.safeLimit} TL.`,
      confidence: result.confidence ?? 0.82,
      routedAgents: result.routedAgents,
      evidence: buildAgentEvidence({
        accounts: data.accounts,
        actions: data.actions,
        budgets: data.budgets,
        categories: data.categories,
        goals: data.goals,
        transactions: data.transactions
      }),
      assumptions: [
        "Hesaplama oturum açan kullanıcının kayıtlı verileriyle yapılmıştır.",
        "LLM açıklama üretir; tutar ve skorlar deterministik servislerden gelir.",
        "KOBİ verileri bireysel dashboard metriklerine karıştırılmaz."
      ],
      suggestedActions,
      agenticPlan: result.agenticPlan,
      quality: this.buildQualitySignal(result)
    };
    await this.store.saveAgentConversation(userId, { message, answer: response.answer, evidence: response.evidence });
    return response;
  }

  listConversations(userId: string) {
    return this.store.listAgentConversations(userId);
  }

  getConversation(userId: string, id: string) {
    return this.store.getAgentConversation(userId, id);
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

  private routeIntent(message: string): AgentIntent {
    const normalized = message.toLocaleLowerCase("tr-TR");
    if (/(alırsam|alsam|harcarsam|ödersem|yaparsam|ertelersem|senaryo|what-if|ne olur|olursa|giderse|zamlanırsa)/i.test(normalized)) return "simulation";
    if (/(abonelik|subscription|tekrarlayan|sızıntı)/i.test(normalized)) return "subscriptions";
    if (/(nedir|anlat|öğret|faiz|enflasyon|kredi)/i.test(normalized)) return "education";
    if (/(dna|risk|profil|ikiz|sağlık skoru|skor)/i.test(normalized)) return "twin";
    return "assistant";
  }

  private async educationalAnswer(message: string): Promise<EducationAnswer> {
    const unavailable =
      "Finansal eğitim cevabı için Qwen yapılandırması gerekli. QWEN_API_KEY eklenmeden bu bölüm demo cevap üretmez.";
    if (!this.qwen.isConfigured()) return { answer: unavailable, warnings: [unavailable] };
    try {
      const response = await this.qwen.chat([
        { role: "system", content: "Türkçe, kısa ve finansal tavsiye yerine eğitim odaklı açıklama yap. En fazla 5 kısa paragraf yaz." },
        { role: "user", content: message }
    ], { maxTokens: 450 });
      return {
        answer: response.content || "",
        warnings: [],
        model: response.model,
        tokenUsage: normalizeUsage(response.usage)
      };
    } catch {
      return { answer: unavailable, warnings: [unavailable] };
    }
  }

  private async assistantAnswer(userId: string, message: string): Promise<StructuredAssistantAnswer> {
    const context = await this.buildAgentContext(userId);
    const diagnostics = contextDiagnostics(context);

    if (!this.qwen.isConfigured()) {
      throw new ServiceUnavailableException("Fintwin Agent için QWEN_API_KEY tanımlı değil; sessiz özet cevabı üretilmedi.");
    }

    try {
      const response = await this.qwen.chat(
        [
          {
            role: "system",
            content:
              [
                "Sen Fintwin içindeki Türkçe finansal ikiz asistansın.",
                "Sadece verilen token dostu bağlama dayan; bağlamda olmayan veriyi uydurma.",
                "Yatırım tavsiyesi verme; eğitim ve kişisel finans organizasyonu odağında kal.",
                "Otomatik işlem yaptığını, DB'ye yazdığını veya para hareketi yaptığını iddia etme.",
                "Cevabı SADECE JSON olarak dön: {\"answer\":\"...\",\"confidence\":0.0,\"warnings\":[\"...\"]}.",
                "answer en fazla 7 cümle olsun; önce net cevap, sonra gerekçe, sonda 1-3 adım ver.",
                "En az iki somut veri noktasına değin; eksik veri varsa açıkça söyle."
              ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify({
              message,
              outputRules: [
                "En fazla 7 cümle.",
                "Önce net cevap, sonra gerekçe, en sonda yapılacak 1-3 adım.",
                "Varsayım üretme; bağlamda yoksa 'bu veri yok' de.",
                "Kullanıcı onayı olmadan işlem yaptığını söyleme."
              ],
              context
            })
          }
        ],
        { temperature: 0.35, maxTokens: 700 }
      );
      return this.parseAssistantAnswer(response, diagnostics);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("Qwen Agent cevabı alınamadı; sessiz özet cevabı üretilmedi.");
    }
  }

  private async buildAgentContext(userId: string) {
    const data = this.store.getPersonalData(userId);
    if (!data.user) {
      throw new ServiceUnavailableException("Agent bağlamı için kullanıcı profili bulunamadı.");
    }
    const decisionHistory = await this.store.listSimulationHistory(userId);
    return buildTokenFriendlyAgentContext({ ...data, user: data.user }, decisionHistory);
  }

  private parseAssistantAnswer(response: QwenChatResult, diagnostics: ReturnType<typeof contextDiagnostics>): StructuredAssistantAnswer {
    const parsed = parseStructuredAssistantJson(response.content);
    const answer = requiredAssistantText(parsed.answer);
    const guardWarnings = validateAssistantSafety(answer);
    if (guardWarnings.length) {
      throw new ServiceUnavailableException(`Qwen Agent güvenlik kontrolü geçemedi: ${guardWarnings.join(", ")}`);
    }
    return {
      answer,
      confidence: confidenceValue(parsed.confidence),
      warnings: normalizeStringArray(parsed.warnings),
      model: response.model,
      tokenUsage: normalizeUsage(response.usage),
      contextVersion: diagnostics.contextVersion,
      contextChars: diagnostics.contextChars,
      truncatedSections: diagnostics.truncatedSections
    };
  }

  private buildQualitySignal(result: AgentGraphQualityResult): AgentQualitySignal {
    const warnings = [...new Set(result.qualityWarnings ?? [])];
    return {
      grounded: warnings.length === 0,
      contextVersion: result.contextVersion,
      contextChars: result.contextChars,
      truncatedSections: [...new Set(result.truncatedSections ?? [])],
      model: result.model,
      tokenUsage: result.tokenUsage,
      warnings
    };
  }
}

function parseStructuredAssistantJson(content: string): Record<string, unknown> {
  const text = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const json = text.startsWith("{") && text.endsWith("}") ? text : text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new SyntaxError("Qwen Agent JSON output missing.");
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new SyntaxError("Qwen Agent JSON output must be an object.");
  return parsed as Record<string, unknown>;
}

function requiredAssistantText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new SyntaxError("Qwen Agent answer is empty.");
  return text;
}

function confidenceValue(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.8;
  return Math.min(Math.max(number, 0), 1);
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 5);
}

function normalizeUsage(usage: QwenChatResult["usage"]): AgentQualitySignal["tokenUsage"] | undefined {
  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens
  };
}

function validateAssistantSafety(answer: string) {
  const warnings: string[] = [];
  if (/(db'?ye yazdım|kaydı oluşturdum|işlemi yaptım|satın aldım|ödeme yaptım|para hareketi yaptım)/i.test(answer)) {
    warnings.push("otomatik işlem iddiası");
  }
  if (/(kesin al|kesin sat|hemen al|hemen sat|yatırım tavsiyem)/i.test(answer)) {
    warnings.push("yatırım tavsiyesi dili");
  }
  return warnings;
}

function contextDiagnostics(context: unknown) {
  const record = context && typeof context === "object" ? (context as Record<string, unknown>) : {};
  const budget = record.contextBudget && typeof record.contextBudget === "object" ? (record.contextBudget as Record<string, unknown>) : {};
  return {
    contextVersion: typeof record.contextVersion === "number" ? record.contextVersion : undefined,
    contextChars: typeof budget.approximateChars === "number" ? budget.approximateChars : JSON.stringify(context).length,
    truncatedSections: Array.isArray(budget.truncatedSections) ? budget.truncatedSections.map(String) : []
  };
}
