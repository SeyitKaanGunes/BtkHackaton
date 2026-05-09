import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { DEMO_USER_ID, type ActionItem, type SubscriptionReminderRequest, type SubscriptionReminderResult } from "@fintwin/shared";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("actions")
export class ActionsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get()
  list() {
    return this.store.actions;
  }

  @Post(":id/approve")
  async approve(@Param("id") id: string) {
    return (await this.store.approveAction(id)) ?? { error: "Action not found" };
  }

  @Post("subscription-reminder")
  async createSubscriptionReminder(@Body() body: SubscriptionReminderRequest): Promise<SubscriptionReminderResult> {
    const remindAt = normalizeReminderDate(body.remindAt);
    const action: ActionItem = {
      id: `act-subscription-${Date.now()}`,
      userId: DEMO_USER_ID,
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
