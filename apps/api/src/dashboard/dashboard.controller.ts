import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { calculateDashboardSummary, summarizeDecisionJournal, type DashboardPeriodOptions } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get("personal")
  async personal(@CurrentUser() user: AuthUser, @Query() query: DashboardPeriodOptions) {
    await this.store.ensureMonthlySalaryTransactions(user.id);
    const data = this.store.getPersonalData(user.id);
    const dashboard = calculateDashboardSummary(data.accounts, data.transactions, data.goals, data.actions, data.budgets, query, data.categories);
    const decisionSummary = summarizeDecisionJournal(await this.store.listSimulationHistory(user.id));
    return {
      ...dashboard,
      financialHealthScore: clampScore(dashboard.financialHealthScore + decisionSummary.healthAdjustment),
      riskAlerts:
        decisionSummary.boughtSpend > decisionSummary.avoidedSpend
          ? [
              ...dashboard.riskAlerts,
              {
                title: "Karar günlüğü nakit çıkışı",
                description: `İşaretlenen kararlarda ${decisionSummary.boughtSpend.toLocaleString("tr-TR")} TL satın alma görünüyor. Büyük harcamalarda What-if sonucunu tekrar kontrol et.`,
                level: "medium" as const
              }
            ]
          : dashboard.riskAlerts
    };
  }
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
