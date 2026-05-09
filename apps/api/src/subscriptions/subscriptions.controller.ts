import { Controller, Get } from "@nestjs/common";
import { detectSubscriptionLeakage } from "@fintwin/shared";

@Controller("subscriptions")
export class SubscriptionsController {
  @Get("leakage")
  leakage() {
    return detectSubscriptionLeakage();
  }
}
