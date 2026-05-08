import { Body, Controller, Inject, Post } from "@nestjs/common";
import { AgentService } from "./agent.service.js";

@Controller("agent")
export class AgentController {
  constructor(@Inject(AgentService) private readonly agent: AgentService) {}

  @Post("chat")
  chat(@Body() body: { message: string }) {
    return this.agent.chat(body.message);
  }
}
