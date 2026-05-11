import { BadRequestException, Body, Controller, Delete, Get, Inject, NotFoundException, Param, Post, Query, UseGuards } from "@nestjs/common";
import { createInvestmentHolding, type Currency, type InvestmentAssetType, type InvestmentHoldingCreateRequest } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";
import { TwelveDataService } from "./twelve-data.service.js";

const ASSET_TYPES = new Set<InvestmentAssetType>(["stock", "forex", "gold", "commodity", "crypto", "fund", "cash", "other"]);
const CURRENCIES = new Set<Currency>(["TRY", "USD", "EUR"]);

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
    const assetType = optionalAssetType(body.assetType);
    const isCash = assetType === "cash" || isCashSymbol(body.symbol);
    const symbol = isCash ? body.symbol : requiredText(body.symbol, "symbol");
    const quantity = positiveNumber(body.quantity, "quantity");
    const averageCost = isCash ? optionalPositiveNumber(body.averageCost, "averageCost") ?? 1 : positiveNumber(body.averageCost, "averageCost");
    const costCurrency = optionalCurrency(body.costCurrency, "costCurrency") ?? "TRY";
    const marketCurrency = optionalCurrency(body.marketCurrency, "marketCurrency");
    const annualInterestRate = optionalPositiveNumber(body.annualInterestRate, "annualInterestRate");
    const holding = createInvestmentHolding({ ...body, symbol, assetType, quantity, averageCost, costCurrency, marketCurrency, annualInterestRate }, undefined, user.id);
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

function requiredText(value: unknown, field: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new BadRequestException(`${field} is required`);
  return text;
}

function positiveNumber(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new BadRequestException(`${field} must be greater than zero`);
  return number;
}

function optionalPositiveNumber(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  return positiveNumber(value, field);
}

function optionalAssetType(value: unknown): InvestmentAssetType | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string" && ASSET_TYPES.has(value as InvestmentAssetType)) return value as InvestmentAssetType;
  throw new BadRequestException("assetType is invalid");
}

function optionalCurrency(value: unknown, field: string): Currency | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string" && CURRENCIES.has(value as Currency)) return value as Currency;
  throw new BadRequestException(`${field} must be TRY, USD or EUR`);
}

function isCashSymbol(value: unknown) {
  return typeof value === "string" && value.trim().toUpperCase().startsWith("CASH_");
}
