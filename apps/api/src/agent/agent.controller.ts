import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
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
  conversations(@CurrentUser() user: AuthUser) {
    return this.agent.listConversations(user.id);
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
