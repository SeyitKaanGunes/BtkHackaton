import { Controller, Get } from "@nestjs/common";
import { calculateCampaignReadiness } from "@finshadow/shared";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("campaigns")
export class CampaignsController {
  constructor(private readonly store: DataStoreService) {}

  @Get("readiness")
  readiness() {
    return calculateCampaignReadiness(this.store.transactions);
  }
}
