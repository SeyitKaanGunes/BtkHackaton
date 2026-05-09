import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { buildWhatIfScenarios, type WhatIfRequest } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("simulations")
@UseGuards(JwtAuthGuard)
export class SimulationsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Post("what-if")
  whatIf(@CurrentUser() user: AuthUser, @Body() body: WhatIfRequest) {
    const data = this.store.getPersonalData(user.id);
    return buildWhatIfScenarios(body, {
      accounts: data.accounts,
      actions: data.actions,
      budgets: data.budgets,
      goals: data.goals,
      transactions: data.transactions
    });
  }
}
