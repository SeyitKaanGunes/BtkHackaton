import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { calculateDashboardSummary, type DashboardPeriodOptions } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get("personal")
  personal(@CurrentUser() user: AuthUser, @Query() query: DashboardPeriodOptions) {
    const data = this.store.getPersonalData(user.id);
    return calculateDashboardSummary(data.accounts, data.transactions, data.goals, data.actions, data.budgets, query);
  }
}
