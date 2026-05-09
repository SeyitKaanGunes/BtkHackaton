import { Controller, Get, Inject } from "@nestjs/common";
import { detectSubscriptionLeakage } from "@fintwin/shared";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get("leakage")
  leakage() {
    return detectSubscriptionLeakage(this.store.subscriptions);
  }
}
