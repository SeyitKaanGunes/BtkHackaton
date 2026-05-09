import { Body, Controller, Get, Inject, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { calculateBusinessDashboard, calculateCollectionScore, simulateAiCfo, type Business } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("business")
@UseGuards(JwtAuthGuard)
export class BusinessController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get(":id/dashboard")
  dashboard(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const business = this.businessFor(user.id, id);
    return calculateBusinessDashboard(id, business, this.store.businessCashEvents.filter((event) => event.businessId === business.id));
  }

  @Post(":id/ai-cfo/simulate")
  simulate(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: { amount: number; decision?: string }) {
    const business = this.businessFor(user.id, id);
    return simulateAiCfo(Number(body.amount ?? 0), body.decision ?? "Yeni karar", business, this.store.businessCashEvents.filter((event) => event.businessId === business.id));
  }

  @Get(":id/customers/:customerId/collection-score")
  collectionScore(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("customerId") customerId: string) {
    const business = this.businessFor(user.id, id);
    const customers = this.store.businessCustomers.filter((customer) => customer.businessId === business.id);
    if (!customers.some((customer) => customer.id === customerId)) {
      throw new NotFoundException("Müşteri bulunamadı.");
    }
    return calculateCollectionScore(customerId, customers);
  }

  private businessFor(userId: string, businessId: string): Business {
    if (this.store.business.id !== businessId || this.store.business.ownerUserId !== userId) {
      throw new NotFoundException("İşletme bulunamadı.");
    }
    return this.store.business;
  }
}
