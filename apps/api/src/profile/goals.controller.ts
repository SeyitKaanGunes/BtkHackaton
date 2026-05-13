import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import type { GoalCreateRequest, GoalUpdateRequest } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("goals")
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.store.getPersonalData(user.id).goals;
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: GoalCreateRequest) {
    return this.store.createGoal(user.id, body);
  }

  @Patch(":id")
  async update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: GoalUpdateRequest) {
    const updated = await this.store.updateGoal(user.id, id, body);
    if (!updated) throw new NotFoundException("Goal not found.");
    return updated;
  }

  @Delete(":id")
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const removed = await this.store.deleteGoal(user.id, id);
    if (!removed) throw new NotFoundException("Goal not found.");
    return removed;
  }
}
