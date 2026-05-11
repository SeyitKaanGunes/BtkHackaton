import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
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
    return (await this.store.approveAction(id, user.id)) ?? { error: "Action not found" };
  }

  @Post(":id/dismiss")
  async dismiss(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return (await this.store.dismissAction(id, user.id)) ?? { error: "Action not found" };
  }

  @Post("subscription-reminder")
  async createSubscriptionReminder(@CurrentUser() user: AuthUser, @Body() body: SubscriptionReminderRequest): Promise<SubscriptionReminderResult> {
    const remindAt = normalizeReminderDate(body.remindAt);
    const action: ActionItem = {
      id: `act-subscription-${Date.now()}`,
      userId: user.id,
      type: "calendar_bill",
      title: `${body.merchant} aboneliğini hatırlat`,
      description: `${body.merchant}${body.amount ? ` (${body.amount.toLocaleString("tr-TR")} TL)` : ""} aboneliği için hatırlatma oluşturuldu.${body.note ? ` Not: ${body.note}` : ""}`,
      dueAt: `${remindAt}T09:00:00.000Z`,
      status: "pending",
      source: "agent"
    };
    return { action: await this.store.addAction(action), scheduled: true };
  }
}

function normalizeReminderDate(value: string) {
  return value?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? new Date().toISOString().slice(0, 10);
}
