import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { createInvestmentHolding, type InvestmentHoldingCreateRequest } from "@fintwin/shared";
import { DataStoreService } from "../data/data-store.service.js";
import { TwelveDataService } from "./twelve-data.service.js";

@Controller("investments")
export class InvestmentsController {
  constructor(
    @Inject(DataStoreService) private readonly store: DataStoreService,
    @Inject(TwelveDataService) private readonly marketData: TwelveDataService
  ) {}

  @Get("portfolio")
  portfolio() {
    return this.marketData.buildPortfolio(this.store.investmentHoldings);
  }

  @Get("symbols")
  symbols(@Query("query") query = "") {
    return this.marketData.searchSymbols(query);
  }

  @Post("holdings")
  async addHolding(@Body() body: InvestmentHoldingCreateRequest) {
    if (body.assetType !== "cash" && !body.symbol?.trim()) throw new BadRequestException("symbol is required");
    if (Number(body.quantity) <= 0) throw new BadRequestException("quantity must be greater than zero");
    const holding = createInvestmentHolding(body);
    await this.store.addInvestmentHolding(holding);
    return this.marketData.buildPortfolio(this.store.investmentHoldings);
  }

  @Delete("holdings/:id")
  async removeHolding(@Param("id") id: string) {
    await this.store.removeInvestmentHolding(id);
    return this.marketData.buildPortfolio(this.store.investmentHoldings);
  }
}
