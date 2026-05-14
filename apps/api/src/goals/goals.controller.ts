import { BadRequestException, Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  calculateDashboardSummary,
  calculateSpendingDna,
  type BudgetUpsertRequest,
  type GoalAdviceResponse,
  type GoalCreateRequest,
  type GoalUpdateRequest,
  type SavingsPlanUpsertRequest
} from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { QwenService } from "../ai/qwen.service.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

const savingsTitles = {
  monthly: "Aylık birikim hedefi",
  yearly: "Yıllık birikim hedefi"
};

@Controller("goals")
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(
    @Inject(DataStoreService) private readonly store: DataStoreService,
    @Inject(QwenService) private readonly qwen: QwenService
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    const data = this.store.getPersonalData(user.id);
    const goals = data.goals;
    return {
      goals,
      budgets: data.budgets,
      categories: this.store.getCategories("expense"),
      savingsPlan: {
        monthly: goals.find((goal) => goal.title === savingsTitles.monthly),
        yearly: goals.find((goal) => goal.title === savingsTitles.yearly)
      }
    };
  }

  @Get("advice")
  async advice(@CurrentUser() user: AuthUser): Promise<GoalAdviceResponse> {
    await this.store.ensureMonthlySalaryTransactions(user.id);
    const data = this.store.getPersonalData(user.id);
    const dashboard = calculateDashboardSummary(data.accounts, data.transactions, data.goals, data.actions, data.budgets, {}, data.categories);
    const dna = calculateSpendingDna(data.transactions, data.budgets, {}, data.categories);
    return this.buildGoalAdvice({
      userName: user.name,
      income: dashboard.income,
      expenses: dashboard.expenses,
      balance: dashboard.balance,
      savingsRate: dashboard.savingsRate,
      goals: data.goals,
      budgets: data.budgets.map((budget) => ({
        categoryName: data.categories.find((category) => category.id === budget.categoryId)?.name ?? budget.categoryId,
        monthlyLimit: budget.monthlyLimit,
        monthlySpend: dna.categories.find((category) => category.categoryId === budget.categoryId)?.monthlySpend ?? 0
      }))
    });
  }

  @Post()
  createGoal(@CurrentUser() user: AuthUser, @Body() body: Partial<GoalCreateRequest>) {
    return this.store.addGoal(user.id, {
      title: requiredText(body.title, "title"),
      targetAmount: requiredNumber(body.targetAmount, "targetAmount"),
      currentAmount: optionalNumber(body.currentAmount, "currentAmount"),
      deadline: requiredText(body.deadline, "deadline")
    });
  }

  @Patch(":id")
  async updateGoal(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: GoalUpdateRequest) {
    const updated = await this.store.updateGoal(user.id, id, body);
    if (!updated) throw new NotFoundException("Goal not found.");
    return updated;
  }

  @Delete(":id")
  async deleteGoal(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const removed = await this.store.deleteGoal(user.id, id);
    if (!removed) throw new NotFoundException("Goal not found.");
    return removed;
  }

  @Post("savings-plan")
  saveSavingsPlan(@CurrentUser() user: AuthUser, @Body() body: Partial<SavingsPlanUpsertRequest>) {
    return this.store.upsertSavingsPlan(user.id, {
      monthlyAmount: requiredNumber(body.monthlyAmount, "monthlyAmount"),
      yearlyAmount: requiredNumber(body.yearlyAmount, "yearlyAmount")
    });
  }

  @Post("budgets")
  saveBudget(@CurrentUser() user: AuthUser, @Body() body: Partial<BudgetUpsertRequest>) {
    return this.store.upsertBudget(user.id, {
      categoryId: requiredText(body.categoryId, "categoryId"),
      monthlyLimit: requiredNumber(body.monthlyLimit, "monthlyLimit")
    });
  }

  private async buildGoalAdvice(context: {
    userName: string;
    income: number;
    expenses: number;
    balance: number;
    savingsRate: number;
    goals: Array<{ title: string; targetAmount: number; currentAmount: number; deadline: string }>;
    budgets: Array<{ categoryName: string; monthlyLimit: number; monthlySpend: number }>;
  }): Promise<GoalAdviceResponse> {
    const unavailable = (summary: string): GoalAdviceResponse => ({
      summary,
      actions: [],
      generatedAt: new Date().toISOString(),
      source: "unavailable"
    });

    if (!this.qwen.isConfigured()) {
      return unavailable("Hedef tavsiyesi için QWEN_API_KEY yapılandırılmalı. Hedefler kaydedildi, fakat kişisel yorum üretilemedi.");
    }

    try {
      const response = await this.qwen.chat(
        [
          {
            role: "system",
            content:
              "Sen Fintwin içindeki Türkçe hedef koçusun. Kullanıcının hedefleri, birikim planı ve kategori limitlerine göre çok basit, günlük dille tavsiye ver. Yatırım tavsiyesi verme, kesin kazanç vaadi verme, kullanıcıyı suçlama. Kısa, uygulanabilir ve sakin yaz. Sadece JSON döndür."
          },
          {
            role: "user",
            content: JSON.stringify({
              instruction:
                "summary 3-5 kısa cümle olsun. Kullanıcı hedeflerine ulaşmak için bugün neye dikkat etmeli açıkça söyle. actions tam 3 madde olsun; her madde tek cümle, net ve yapılabilir olsun. JSON şeması: {\"summary\":\"...\",\"actions\":[\"...\"]}",
              context: {
                ...context,
                goals: context.goals
                  .slice()
                  .sort((left, right) => left.deadline.localeCompare(right.deadline))
                  .slice(0, 6),
                budgets: context.budgets
                  .slice()
                  .sort((left, right) => right.monthlySpend / Math.max(right.monthlyLimit, 1) - left.monthlySpend / Math.max(left.monthlyLimit, 1))
                  .slice(0, 6)
              }
            })
          }
        ],
        { temperature: 0.3, maxTokens: 500 }
      );
      const parsed = parseGoalAdvice(response.content);
      if (!parsed.summary) return unavailable("Hedef tavsiyesi boş döndü. Hedefler kaydedildi, fakat yorum gösterilemiyor.");
      return {
        summary: parsed.summary,
        actions: parsed.actions,
        generatedAt: new Date().toISOString(),
        model: response.model,
        source: "llm"
      };
    } catch {
      return unavailable("Hedef tavsiyesi şu anda alınamadı. Hedefler kaydedildi, fakat yorum gösterilemiyor.");
    }
  }
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${field} zorunlu.`);
  }
  return value.trim();
}

function requiredNumber(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new BadRequestException(`${field} sayı olmalı.`);
  return parsed;
}

function optionalNumber(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredNumber(value, field);
}

function parseGoalAdvice(content: string): Pick<GoalAdviceResponse, "summary" | "actions"> {
  const normalized = content.trim();
  const jsonText = normalized.match(/\{[\s\S]*\}/)?.[0] ?? normalized;
  try {
    const parsed = JSON.parse(jsonText) as { summary?: unknown; actions?: unknown };
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
      actions: Array.isArray(parsed.actions) ? parsed.actions.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 3) : []
    };
  } catch {
    return { summary: normalized, actions: [] };
  }
}
