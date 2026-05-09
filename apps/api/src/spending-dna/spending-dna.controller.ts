import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { calculateSpendingDna } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("spending-dna")
@UseGuards(JwtAuthGuard)
export class SpendingDnaController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    const data = this.store.getPersonalData(user.id);
    return { ...calculateSpendingDna(data.transactions, data.budgets), userId: user.id };
  }
}
