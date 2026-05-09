import { Controller, Get, Inject } from "@nestjs/common";
import { calculateDashboardSummary } from "@fintwin/shared";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get("personal")
  personal() {
    return calculateDashboardSummary(this.store.accounts, this.store.transactions, this.store.goals, this.store.actions);
  }
}
