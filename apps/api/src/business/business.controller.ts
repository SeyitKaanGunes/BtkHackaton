import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { calculateBusinessDashboard, calculateCollectionScore, simulateAiCfo } from "@finshadow/shared";

@Controller("business")
export class BusinessController {
  @Get(":id/dashboard")
  dashboard(@Param("id") id: string) {
    return calculateBusinessDashboard(id);
  }

  @Post(":id/ai-cfo/simulate")
  simulate(@Body() body: { amount: number; decision?: string }) {
    return simulateAiCfo(Number(body.amount ?? 0), body.decision ?? "Yeni karar");
  }

  @Get(":id/customers/:customerId/collection-score")
  collectionScore(@Param("customerId") customerId: string) {
    return calculateCollectionScore(customerId);
  }
}
