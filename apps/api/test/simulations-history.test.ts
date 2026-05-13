import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { categories } from "@fintwin/shared";
import { SimulationsController } from "../src/simulations/simulations.controller.js";
import type { AuthUser } from "../src/auth/auth-user.js";

const user: AuthUser = { id: "user-1", email: "a@example.com", name: "Alperen" };

describe("simulation history API", () => {
  it("does not persist the empty initial what-if scenario", async () => {
    const store = fakeStore();
    const controller = new SimulationsController(store as never);
    const response = await controller.whatIf(user, {});

    expect(response.simulationId).toBeUndefined();
    expect(store.saveSimulation).not.toHaveBeenCalled();
  });

  it("persists explicit what-if scenarios and exposes history", async () => {
    const store = fakeStore();
    const controller = new SimulationsController(store as never);
    const response = await controller.whatIf(user, { amount: 3500, categoryId: "cat-food", decisionDate: "2026-05-13" });

    expect(response.simulationId).toBe("sim-1");
    expect(store.saveSimulation).toHaveBeenCalledOnce();
    await expect(controller.history(user)).resolves.toEqual([{ id: "sim-1" }]);
  });

  it("records decision feedback only for owned simulations", async () => {
    const store = fakeStore();
    const controller = new SimulationsController(store as never);

    await expect(controller.decision(user, "sim-1", { userAction: "delayed" })).resolves.toEqual({ id: "decision-1" });
    store.recordDecisionEvent.mockResolvedValueOnce(undefined as never);
    await expect(controller.decision(user, "missing", { userAction: "delayed" })).rejects.toBeInstanceOf(NotFoundException);
  });
});

function fakeStore() {
  return {
    ensureMonthlySalaryTransactions: vi.fn(async () => []),
    getPersonalData: vi.fn(() => ({
      user: { id: "user-1", payday: 5 },
      accounts: [{ id: "acc-1", userId: "user-1", name: "Ana", type: "debit", balance: 50000, currency: "TRY" }],
      actions: [],
      budgets: [{ id: "budget-food", userId: "user-1", categoryId: "cat-food", monthlyLimit: 8000 }],
      categories,
      goals: [{ id: "goal-1", userId: "user-1", title: "Acil Fon", targetAmount: 100000, currentAmount: 10000, deadline: "2026-12-31" }],
      subscriptions: [],
      transactions: [{ id: "tx-1", userId: "user-1", accountId: "acc-1", categoryId: "cat-food", merchant: "Cafe", amount: 500, currency: "TRY", type: "expense", occurredAt: "2026-05-10T12:00:00.000Z", paymentMethod: "debit_card" }],
      investmentHoldings: []
    })),
    saveSimulation: vi.fn(async () => ({ id: "sim-1" })),
    listSimulationHistory: vi.fn(async () => [{ id: "sim-1" }]),
    recordDecisionEvent: vi.fn(async () => ({ id: "decision-1" }))
  };
}
