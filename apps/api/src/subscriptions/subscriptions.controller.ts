import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { detectSubscriptionLeakage } from "@fintwin/shared";
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
}
