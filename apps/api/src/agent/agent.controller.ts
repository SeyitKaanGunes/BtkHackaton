import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { AgentService } from "./agent.service.js";

@Controller("agent")
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(@Inject(AgentService) private readonly agent: AgentService) {}

  @Post("chat")
  chat(@CurrentUser() user: AuthUser, @Body() body: { message: string }) {
    return this.agent.chat(user.id, body.message);
  }
}
