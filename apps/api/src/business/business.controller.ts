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

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.store.getBusinessesForUser(user.id);
  }

  @Get(":id/dashboard")
  dashboard(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const business = this.businessFor(user.id, id);
    return calculateBusinessDashboard(id, business, this.store.getBusinessCashEvents(business.id));
  }

  @Get(":id/customers")
  customers(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const business = this.businessFor(user.id, id);
    return this.store.getBusinessCustomers(business.id);
  }

  @Post(":id/ai-cfo/simulate")
  simulate(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: { amount: number; decision?: string }) {
    const business = this.businessFor(user.id, id);
    return simulateAiCfo(Number(body.amount ?? 0), body.decision ?? "Yeni karar", business, this.store.getBusinessCashEvents(business.id));
  }

  @Get(":id/customers/:customerId/collection-score")
  collectionScore(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("customerId") customerId: string) {
    const business = this.businessFor(user.id, id);
    const customers = this.store.getBusinessCustomers(business.id);
    if (!customers.some((customer) => customer.id === customerId)) {
      throw new NotFoundException("Customer not found.");
    }
    return calculateCollectionScore(customerId, customers);
  }

  private businessFor(userId: string, businessId: string): Business {
    const business = this.store.getBusinessForUser(userId, businessId);
    if (!business) throw new NotFoundException("Business not found.");
    return business;
  }
}
