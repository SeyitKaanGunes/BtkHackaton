import { BadRequestException, Body, Controller, Delete, Get, Inject, NotFoundException, Param, Post, Query, UseGuards } from "@nestjs/common";
import { createInvestmentHolding, type InvestmentHoldingCreateRequest } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";
import { TwelveDataService } from "./twelve-data.service.js";

@Controller("investments")
@UseGuards(JwtAuthGuard)
export class InvestmentsController {
  constructor(
    @Inject(DataStoreService) private readonly store: DataStoreService,
    @Inject(TwelveDataService) private readonly marketData: TwelveDataService
  ) {}

  @Get("portfolio")
  portfolio(@CurrentUser() user: AuthUser) {
    return this.marketData.buildPortfolio(this.store.getPersonalData(user.id).investmentHoldings);
  }

  @Get("symbols")
  symbols(@Query("query") query = "") {
    return this.marketData.searchSymbols(query);
  }

  @Post("holdings")
  async addHolding(@CurrentUser() user: AuthUser, @Body() body: InvestmentHoldingCreateRequest) {
    if (body.assetType !== "cash" && !body.symbol?.trim()) throw new BadRequestException("symbol is required");
    if (Number(body.quantity) <= 0) throw new BadRequestException("quantity must be greater than zero");
    const holding = createInvestmentHolding(body, undefined, user.id);
    await this.store.addInvestmentHolding(holding);
    return this.marketData.buildPortfolio(this.store.getPersonalData(user.id).investmentHoldings);
  }

  @Delete("holdings/:id")
  async removeHolding(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const removed = await this.store.removeInvestmentHolding(id, user.id);
    if (!removed) throw new NotFoundException("Investment holding not found.");
    return this.marketData.buildPortfolio(this.store.getPersonalData(user.id).investmentHoldings);
  }
}
