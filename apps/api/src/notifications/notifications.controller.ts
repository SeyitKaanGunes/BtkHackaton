import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Post("fcm-token")
  async saveToken(@CurrentUser() user: AuthUser, @Body() body: { token: string; platform: "ios" | "android" | "web" }) {
    await this.store.saveFcmToken({ userId: user.id, token: body.token, platform: body.platform });
    return { saved: true, platform: body.platform };
  }
}
