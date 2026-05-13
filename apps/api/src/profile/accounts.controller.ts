import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import type { AccountCreateRequest, AccountUpdateRequest } from "@fintwin/shared";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("accounts")
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.store.getPersonalData(user.id).accounts;
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: AccountCreateRequest) {
    return this.store.createAccount(user.id, body);
  }

  @Patch(":id")
  async update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: AccountUpdateRequest) {
    const updated = await this.store.updateAccount(user.id, id, body);
    if (!updated) throw new NotFoundException("Account not found.");
    return updated;
  }

  @Delete(":id")
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const removed = await this.store.deleteAccount(user.id, id);
    if (!removed) throw new NotFoundException("Account not found.");
    return removed;
  }
}
