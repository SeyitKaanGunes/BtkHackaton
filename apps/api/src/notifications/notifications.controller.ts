import { BadRequestException, Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

const PLATFORMS = new Set(["ios", "android", "web"]);

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Post("fcm-token")
  async saveToken(@CurrentUser() user: AuthUser, @Body() body: { token: string; platform: "ios" | "android" | "web" }) {
    const token = requiredText(body.token, "token");
    const platform = requirePlatform(body.platform);
    await this.store.saveFcmToken({ userId: user.id, token, platform });
    return { saved: true, platform };
  }
}

function requiredText(value: unknown, field: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new BadRequestException(`${field} is required.`);
  return text;
}

function requirePlatform(value: unknown): "ios" | "android" | "web" {
  if (typeof value !== "string" || !PLATFORMS.has(value)) {
    throw new BadRequestException("platform must be ios, android or web.");
  }
  return value as "ios" | "android" | "web";
}
