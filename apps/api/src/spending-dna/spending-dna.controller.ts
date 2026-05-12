import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { calculateSpendingDna, type DashboardPeriodOptions } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("spending-dna")
@UseGuards(JwtAuthGuard)
export class SpendingDnaController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get()
  async get(@CurrentUser() user: AuthUser, @Query() query: DashboardPeriodOptions) {
    await this.store.ensureMonthlySalaryTransactions(user.id);
    const data = this.store.getPersonalData(user.id);
    return { ...calculateSpendingDna(data.transactions, data.budgets, query, data.categories), userId: user.id };
  }
}
