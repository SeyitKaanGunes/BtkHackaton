import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { calculateCampaignReadiness } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("campaigns")
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get("readiness")
  readiness(@CurrentUser() user: AuthUser) {
    const data = this.store.getPersonalData(user.id);
    return calculateCampaignReadiness(data.transactions, data.budgets);
  }
}
