import { Body, Controller, Inject, Post } from "@nestjs/common";
import { DEMO_USER_ID } from "@fintwin/shared";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("notifications")
export class NotificationsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Post("fcm-token")
  async saveToken(@Body() body: { token: string; platform: "ios" | "android" | "web" }) {
    await this.store.saveFcmToken({ userId: DEMO_USER_ID, token: body.token, platform: body.platform });
    return { saved: true, platform: body.platform };
  }
}
