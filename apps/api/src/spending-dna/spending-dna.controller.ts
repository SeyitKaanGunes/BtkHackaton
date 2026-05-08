import { Controller, Get } from "@nestjs/common";
import { calculateSpendingDna } from "@finshadow/shared";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("spending-dna")
export class SpendingDnaController {
  constructor(private readonly store: DataStoreService) {}

  @Get()
  get() {
    return calculateSpendingDna(this.store.transactions, this.store.budgets);
  }
}
