import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { calculateSpendingDna, summarizeDecisionJournal, type DashboardPeriodOptions, type SpendingDna, type SpendingDnaCommentary } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { QwenService } from "../ai/qwen.service.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("spending-dna")
@UseGuards(JwtAuthGuard)
export class SpendingDnaController {
  constructor(
    @Inject(DataStoreService) private readonly store: DataStoreService,
    @Inject(QwenService) private readonly qwen: QwenService
  ) {}

  @Get()
  async get(@CurrentUser() user: AuthUser, @Query() query: DashboardPeriodOptions & { commentary?: string }) {
    await this.store.ensureMonthlySalaryTransactions(user.id);
    const data = this.store.getPersonalData(user.id);
    const decisionSummary = summarizeDecisionJournal(await this.store.listSimulationHistory(user.id));
    const baseDna = calculateSpendingDna(data.transactions, data.budgets, query, data.categories);
    const dna = {
      ...baseDna,
      userId: user.id,
      patterns:
        decisionSummary.decidedScenarios > 0
          ? [...baseDna.patterns, decisionSummary.insight]
          : baseDna.patterns,
      reasons:
        decisionSummary.decidedScenarios > 0
          ? [...(baseDna.reasons ?? []), `Karar günlüğü sağlık skoruna ${decisionSummary.healthAdjustment >= 0 ? "+" : ""}${decisionSummary.healthAdjustment} puan davranış sinyali ekledi.`]
          : baseDna.reasons
    };
    const commentary =
      query.commentary === "llm"
        ? await this.buildCommentary(dna)
        : this.unavailableCommentary("Risk skorları hızlı yüklendi. LLM yorumu bu sayfa açılışında bekletilmiyor.");
    return { ...dna, commentary };
  }

  private unavailableCommentary(summary: string): SpendingDnaCommentary {
    return {
      summary,
      takeaways: [],
      generatedAt: new Date().toISOString(),
      source: "unavailable"
    };
  }

  private async buildCommentary(dna: SpendingDna): Promise<SpendingDnaCommentary> {
    if (!this.qwen.isConfigured()) {
      return this.unavailableCommentary("LLM yorumu için QWEN_API_KEY yapılandırılmalı. Risk skorları hesaplandı, fakat yorum üretilemedi.");
    }

    try {
      const response = await this.qwen.chat(
        [
          {
            role: "system",
            content:
              "Sen Fintwin içindeki Türkçe finans yorumlayıcısısın. Kullanıcı teknik finans terimlerini bilmeyen normal bir insan. Çok basit, günlük konuşma diliyle yaz. Skorları anlatırken 'bu şu anlama gelir' diye açıkla. Payday reflex, data confidence, risk level gibi İngilizce veya teknik terimler kullanma. Kullanıcıyı suçlama, korkutma, yatırım tavsiyesi verme. Sadece verilen harcama skorlarını yorumla. Sadece JSON döndür."
          },
          {
            role: "user",
            content: JSON.stringify({
              instruction:
                "summary 4-6 kısa cümle olsun ve düz bir insanın anlayacağı kadar basit olsun. Önce genel durumu söyle, sonra en çok dikkat isteyen 1-2 alanı açıkla, en son neye bakması gerektiğini söyle. takeaways 3 kısa madde olsun; her madde doğrudan yapılacak net bir kontrol veya alışkanlık önerisi olsun. JSON şeması: {\"summary\":\"...\",\"takeaways\":[\"...\"]}",
              scores: {
                overallRisk: dna.overallRisk,
                paydayReflexScore: dna.paydayReflexScore,
                nightSpendingScore: dna.nightSpendingScore ?? 0,
                weekendSpendingScore: dna.weekendSpendingScore ?? 0,
                weekendNightScore: dna.weekendNightScore,
                campaignSensitivity: dna.campaignSensitivity,
                savingDiscipline: dna.savingDiscipline,
                dataConfidenceLevel: dna.dataConfidenceLevel
              },
              topCategories: dna.categories
                .filter((category) => category.monthlySpend > 0 || category.riskScore > 0)
                .slice(0, 4)
                .map((category) => ({
                  name: category.categoryName,
                  riskScore: category.riskScore,
                  riskLevel: category.riskLevel,
                  monthlySpend: category.monthlySpend,
                  budgetLimit: category.budgetLimit,
                  reasons: category.reasons?.slice(0, 2) ?? []
                })),
              behaviorSignals: dna.patterns.slice(0, 5),
              missingData: (dna.missingData ?? []).slice(0, 5)
            })
          }
        ],
        { temperature: 0.2, maxTokens: 320, timeoutMs: 3500 }
      );
      const parsed = parseCommentary(response.content);
      if (!parsed.summary) return this.unavailableCommentary("LLM yorumu boş döndü. Risk skorları hesaplandı, fakat yorum gösterilemiyor.");
      return {
        summary: parsed.summary,
        takeaways: parsed.takeaways,
        generatedAt: new Date().toISOString(),
        model: response.model,
        source: "llm"
      };
    } catch {
      return this.unavailableCommentary("LLM yorumu 3.5 saniye içinde alınamadı. Risk skorları hesaplandı; yorum için sayfayı sonra tekrar açabilirsin.");
    }
  }
}

function parseCommentary(content: string): Pick<SpendingDnaCommentary, "summary" | "takeaways"> {
  const normalized = content.trim();
  const jsonText = normalized.match(/\{[\s\S]*\}/)?.[0] ?? normalized;
  try {
    const parsed = JSON.parse(jsonText) as { summary?: unknown; takeaways?: unknown };
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
      takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 4) : []
    };
  } catch {
    return { summary: normalized, takeaways: [] };
  }
}
