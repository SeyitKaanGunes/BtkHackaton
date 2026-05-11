import { BadRequestException, Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { AgentService } from "./agent.service.js";

@Controller("agent")
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(@Inject(AgentService) private readonly agent: AgentService) {}

  @Post("chat")
  chat(@CurrentUser() user: AuthUser, @Body() body: { message?: unknown }) {
    return this.agent.chat(user.id, requiredText(body?.message, "message"));
  }
}

function requiredText(value: unknown, field: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new BadRequestException(`${field} is required.`);
  return text;
}
