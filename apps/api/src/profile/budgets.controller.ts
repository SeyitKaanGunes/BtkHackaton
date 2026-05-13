import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import type { BudgetCreateRequest, BudgetUpdateRequest } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("budgets")
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.store.getPersonalData(user.id).budgets;
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: BudgetCreateRequest) {
    return this.store.createBudget(user.id, body);
  }

  @Patch(":id")
  async update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: BudgetUpdateRequest) {
    const updated = await this.store.updateBudget(user.id, id, body);
    if (!updated) throw new NotFoundException("Budget not found.");
    return updated;
  }

  @Delete(":id")
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const removed = await this.store.deleteBudget(user.id, id);
    if (!removed) throw new NotFoundException("Budget not found.");
    return removed;
  }
}
