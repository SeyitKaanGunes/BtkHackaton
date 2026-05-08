import { Controller, Get } from "@nestjs/common";
import { calculateDashboardSummary } from "@finshadow/shared";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly store: DataStoreService) {}

  @Get("personal")
  personal() {
    return calculateDashboardSummary(this.store.accounts, this.store.transactions, this.store.goals, this.store.actions);
  }
}
