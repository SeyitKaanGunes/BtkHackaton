import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ActionItem, SubscriptionReminderRequest, SubscriptionReminderResult } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("actions")
@UseGuards(JwtAuthGuard)
export class ActionsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.store.getPersonalData(user.id).actions;
  }

  @Post(":id/approve")
  async approve(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const action = await this.store.approveAction(id, user.id);
    if (!action) throw new NotFoundException("Action not found.");
    return action;
  }

  @Post(":id/dismiss")
  async dismiss(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const action = await this.store.dismissAction(id, user.id);
    if (!action) throw new NotFoundException("Action not found.");
    return action;
  }

  @Post("subscription-reminder")
  async createSubscriptionReminder(@CurrentUser() user: AuthUser, @Body() body: SubscriptionReminderRequest): Promise<SubscriptionReminderResult> {
    const remindAt = normalizeReminderDate(body.remindAt);
    const merchant = requiredText(body.merchant, "merchant");
    const amount = optionalPositiveNumber(body.amount, "amount");
    const action: ActionItem = {
      id: `act-subscription-${randomUUID()}`,
      userId: user.id,
      type: "calendar_bill",
      title: `${merchant} aboneliğini hatırlat`,
      description: `${merchant}${amount ? ` (${amount.toLocaleString("tr-TR")} TL)` : ""} aboneliği için hatırlatma oluşturuldu.${body.note ? ` Not: ${body.note}` : ""}`,
      dueAt: `${remindAt}T09:00:00.000Z`,
      status: "pending",
      source: "agent"
    };
    return { action: await this.store.addAction(action), scheduled: true };
  }
}

function normalizeReminderDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException("remindAt must be YYYY-MM-DD.");
  }
  const date = new Date(`${value}T09:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException("remindAt must be a valid date.");
  }
  return value;
}

function requiredText(value: unknown, field: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new BadRequestException(`${field} is required.`);
  return text;
}

function optionalPositiveNumber(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new BadRequestException(`${field} must be a positive number.`);
  return number;
}
