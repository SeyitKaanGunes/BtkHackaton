import { Body, Controller, Post } from "@nestjs/common";
import { buildWhatIfScenarios, type WhatIfRequest } from "@finshadow/shared";

@Controller("simulations")
export class SimulationsController {
  @Post("what-if")
  whatIf(@Body() body: WhatIfRequest) {
    return buildWhatIfScenarios(body);
  }
}
