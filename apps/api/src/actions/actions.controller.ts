import { Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("actions")
export class ActionsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get()
  list() {
    return this.store.actions;
  }

  @Post(":id/approve")
  approve(@Param("id") id: string) {
    return this.store.approveAction(id) ?? { error: "Action not found" };
  }
}
