import { Controller, Get, Inject } from "@nestjs/common";
import { calculateSpendingDna } from "@fintwin/shared";
import { DataStoreService } from "../data/data-store.service.js";

@Controller("spending-dna")
export class SpendingDnaController {
  constructor(@Inject(DataStoreService) private readonly store: DataStoreService) {}

  @Get()
  get() {
    return calculateSpendingDna(this.store.transactions, this.store.budgets);
  }
}
