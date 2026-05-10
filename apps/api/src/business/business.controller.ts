import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import {
  calculateBusinessDashboard,
  calculateCollectionScore,
  simulateAiCfo,
  type Business,
  type BusinessCashEventCreateRequest,
  type BusinessCreateRequest,
  type BusinessCustomerCreateRequest
} from "@fintwin/shared";
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

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: BusinessCreateRequest) {
    return this.store.createBusiness(user.id, {
      name: requiredText(body.name, "name"),
      sector: requiredText(body.sector, "sector"),
      cashBalance: nonNegativeNumber(body.cashBalance ?? 0, "cashBalance")
    });
  }

  @Get("primary/overview")
  primaryOverview(@CurrentUser() user: AuthUser) {
    const business = this.primaryBusinessFor(user.id);
    const customers = this.store.getBusinessCustomers(business.id);
    const scores = customers.map((customer) => calculateCollectionScore(customer.id, customers));
    const collectionScores = scores.map((score) => {
      const customer = customers.find((item) => item.id === score.customerId);
      return {
        ...score,
        customerName: customer?.name ?? score.customerId,
        outstandingAmount: customer?.outstandingAmount ?? 0
      };
    });
    return {
      business,
      dashboard: calculateBusinessDashboard(business.id, business, this.store.getBusinessCashEvents(business.id)),
      customers,
      scores,
      collectionScores
    };
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

  @Post(":id/customers")
  createCustomer(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: BusinessCustomerCreateRequest) {
    const business = this.businessFor(user.id, id);
    return this.store.addBusinessCustomer(business.id, {
      name: requiredText(body.name, "name"),
      averageDelayDays: nonNegativeInteger(body.averageDelayDays ?? 0, "averageDelayDays"),
      invoicesPaid: nonNegativeInteger(body.invoicesPaid ?? 0, "invoicesPaid"),
      invoicesLate: nonNegativeInteger(body.invoicesLate ?? 0, "invoicesLate"),
      outstandingAmount: nonNegativeNumber(body.outstandingAmount ?? 0, "outstandingAmount")
    });
  }

  @Post(":id/cash-events")
  createCashEvent(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: BusinessCashEventCreateRequest) {
    const business = this.businessFor(user.id, id);
    const type = body.type === "inflow" || body.type === "outflow" ? body.type : undefined;
    if (!type) throw new BadRequestException("type must be inflow or outflow.");
    return this.store.addBusinessCashEvent(business.id, {
      title: requiredText(body.title, "title"),
      amount: positiveNumber(body.amount, "amount"),
      type,
      dueAt: dateOnly(body.dueAt, "dueAt")
    });
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

  private primaryBusinessFor(userId: string): Business {
    const business = this.store.getBusinessesForUser(userId)[0];
    if (!business) throw new NotFoundException("Business not found.");
    return business;
  }
}

function requiredText(value: unknown, field: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new BadRequestException(`${field} is required.`);
  return text;
}

function positiveNumber(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new BadRequestException(`${field} must be a positive number.`);
  return number;
}

function nonNegativeNumber(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new BadRequestException(`${field} must be zero or greater.`);
  return number;
}

function nonNegativeInteger(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new BadRequestException(`${field} must be a non-negative integer.`);
  return number;
}

function dateOnly(value: unknown, field: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${field} must be YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} must be a valid date.`);
  return value;
}
