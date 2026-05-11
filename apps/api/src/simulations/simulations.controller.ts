import { BadRequestException, Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { buildWhatIfScenarios, type WhatIfRequest } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("simulations")
@UseGuards(JwtAuthGuard)
export class SimulationsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Post("what-if")
  whatIf(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = normalizeWhatIfRequest(body);
    const data = this.store.getPersonalData(user.id);
    return buildWhatIfScenarios(input, {
      accounts: data.accounts,
      actions: data.actions,
      budgets: data.budgets,
      goals: data.goals,
      transactions: data.transactions
    });
  }
}

function normalizeWhatIfRequest(value: unknown): WhatIfRequest {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) throw new BadRequestException("Body must be an object.");
  return {
    amount: optionalPositiveNumber(value.amount, "amount"),
    categoryId: optionalText(value.categoryId, "categoryId"),
    decisionDate: optionalDateOnly(value.decisionDate, "decisionDate"),
    description: optionalText(value.description, "description")
  };
}

function optionalPositiveNumber(value: unknown, field: string) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new BadRequestException(`${field} must be a positive number.`);
  }
  return value;
}

function optionalText(value: unknown, field: string) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new BadRequestException(`${field} must be a string.`);
  const text = value.trim();
  return text || undefined;
}

function optionalDateOnly(value: unknown, field: string) {
  const text = optionalText(value, field);
  if (!text) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new BadRequestException(`${field} must be YYYY-MM-DD.`);
  const date = new Date(`${text}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new BadRequestException(`${field} must be a valid date.`);
  }
  return text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
