import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AccountsController } from "../src/profile/accounts.controller.js";
import { BudgetsController } from "../src/profile/budgets.controller.js";
import { GoalsController } from "../src/profile/goals.controller.js";
import type { AuthUser } from "../src/auth/auth-user.js";

const user: AuthUser = { id: "user-1", email: "a@example.com", name: "Alperen" };

describe("financial profile controllers", () => {
  it("routes account CRUD through the authenticated user id", async () => {
    const store = {
      getPersonalData: vi.fn(() => ({ accounts: [{ id: "acc-1" }] })),
      createAccount: vi.fn(async () => ({ id: "acc-2" })),
      updateAccount: vi.fn(async () => ({ id: "acc-1", name: "Ana hesap" })),
      deleteAccount: vi.fn(async () => ({ id: "acc-1" }))
    };
    const controller = new AccountsController(store as never);

    expect(controller.list(user)).toEqual([{ id: "acc-1" }]);
    await expect(controller.create(user, { name: "Ana", type: "debit", balance: 100 })).resolves.toEqual({ id: "acc-2" });
    await expect(controller.update(user, "acc-1", { name: "Ana hesap" })).resolves.toEqual({ id: "acc-1", name: "Ana hesap" });
    await expect(controller.remove(user, "acc-1")).resolves.toEqual({ id: "acc-1" });
    expect(store.createAccount).toHaveBeenCalledWith("user-1", { name: "Ana", type: "debit", balance: 100 });
  });

  it("returns 404 when a profile record is not owned by the user", async () => {
    const accountController = new AccountsController({ updateAccount: vi.fn(async () => undefined) } as never);
    const budgetController = new BudgetsController({ deleteBudget: vi.fn(async () => undefined) } as never);
    const goalController = new GoalsController({ updateGoal: vi.fn(async () => undefined) } as never);

    await expect(accountController.update(user, "missing", { name: "X" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(budgetController.remove(user, "missing")).rejects.toBeInstanceOf(NotFoundException);
    await expect(goalController.update(user, "missing", { title: "X" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("routes budget and goal creation through the canonical DB store", async () => {
    const budgetStore = { getPersonalData: vi.fn(() => ({ budgets: [] })), createBudget: vi.fn(async () => ({ id: "budget-1" })) };
    const goalStore = { getPersonalData: vi.fn(() => ({ goals: [] })), createGoal: vi.fn(async () => ({ id: "goal-1" })) };
    const budgetController = new BudgetsController(budgetStore as never);
    const goalController = new GoalsController(goalStore as never);

    await expect(budgetController.create(user, { categoryId: "cat-food", monthlyLimit: 5000 })).resolves.toEqual({ id: "budget-1" });
    await expect(goalController.create(user, { title: "Acil Fon", targetAmount: 100000, deadline: "2026-12-31" })).resolves.toEqual({ id: "goal-1" });
    expect(budgetStore.createBudget).toHaveBeenCalledWith("user-1", { categoryId: "cat-food", monthlyLimit: 5000 });
    expect(goalStore.createGoal).toHaveBeenCalledWith("user-1", { title: "Acil Fon", targetAmount: 100000, deadline: "2026-12-31" });
  });
});
