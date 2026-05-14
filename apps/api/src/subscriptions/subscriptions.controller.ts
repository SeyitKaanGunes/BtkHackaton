import { Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { detectSubscriptionLeakage, type SubscriptionCreateRequest, type SubscriptionUpdateRequest } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("subscriptions")
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get("leakage")
  leakage(@CurrentUser() user: AuthUser) {
    return detectSubscriptionLeakage(this.store.getPersonalData(user.id).subscriptions);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.store.getPersonalData(user.id).subscriptions;
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: SubscriptionCreateRequest) {
    return this.store.createSubscription(user.id, body);
  }

  @Patch(":id")
  async update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: SubscriptionUpdateRequest) {
    const updated = await this.store.updateSubscription(user.id, id, body);
    if (!updated) throw new NotFoundException("Subscription not found.");
    return updated;
  }
}
