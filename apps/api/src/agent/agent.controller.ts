import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RateLimit } from "../rate-limit/rate-limit.decorator.js";
import { AgentService } from "./agent.service.js";

@Controller("agent")
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(@Inject(AgentService) private readonly agent: AgentService) {}

  @Post("chat")
  @RateLimit({ limit: 30, windowMs: 60_000, scope: "credential" })
  chat(@CurrentUser() user: AuthUser, @Body() body: { message?: unknown }) {
    return this.agent.chat(user.id, requiredText(body?.message, "message"));
  }

  @Get("conversations")
  conversations(@CurrentUser() user: AuthUser, @Query("limit") limit?: string) {
    return this.agent.listConversations(user.id, optionalLimit(limit));
  }

  @Get("conversations/:id")
  async conversation(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const conversation = await this.agent.getConversation(user.id, id);
    if (!conversation) throw new NotFoundException("Conversation not found.");
    return conversation;
  }
}

function requiredText(value: unknown, field: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new BadRequestException(`${field} is required.`);
  return text;
}

function optionalLimit(value: string | undefined) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) {
    throw new BadRequestException("limit must be an integer between 1 and 30.");
  }
  return parsed;
}
