import { Body, Controller, Get, Inject, NotFoundException, Param, Patch, UseGuards } from "@nestjs/common";
import { detectSubscriptionLeakage, type SubscriptionUpdateRequest } from "@fintwin/shared";
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

  @Patch(":id")
  async update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: SubscriptionUpdateRequest) {
    const updated = await this.store.updateSubscription(user.id, id, body);
    if (!updated) throw new NotFoundException("Subscription not found.");
    return updated;
  }
}
