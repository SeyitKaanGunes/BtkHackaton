import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { calculateBusinessDashboard, calculateCollectionScore, simulateAiCfo } from "@fintwin/shared";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("business")
export class BusinessController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get(":id/dashboard")
  dashboard(@Param("id") id: string) {
    return calculateBusinessDashboard(id, this.store.business, this.store.businessCashEvents);
  }

  @Post(":id/ai-cfo/simulate")
  simulate(@Body() body: { amount: number; decision?: string }) {
    return simulateAiCfo(Number(body.amount ?? 0), body.decision ?? "Yeni karar", this.store.business, this.store.businessCashEvents);
  }

  @Get(":id/customers/:customerId/collection-score")
  collectionScore(@Param("customerId") customerId: string) {
    return calculateCollectionScore(customerId, this.store.businessCustomers);
  }
}
