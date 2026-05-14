import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionsController } from "../src/subscriptions/subscriptions.controller.js";
import type { AuthUser } from "../src/auth/auth-user.js";

const user: AuthUser = { id: "user-1", email: "a@example.com", name: "Alperen" };

describe("SubscriptionsController", () => {
  it("lists subscriptions and updates status for the authenticated user", async () => {
    const store = {
      getPersonalData: vi.fn(() => ({
        subscriptions: [
          {
            id: "sub-1",
            userId: "user-1",
            merchant: "Stream",
            categoryId: "cat-subscription",
            amount: 100,
            currency: "TRY",
            cadence: "monthly",
            status: "active",
            source: "statement"
          }
        ]
      })),
      createSubscription: vi.fn(async () => ({ id: "sub-2", source: "manual" })),
      updateSubscription: vi.fn(async () => ({ id: "sub-1", status: "cancelled" }))
    };
    const controller = new SubscriptionsController(store as never);

    expect(controller.list(user)).toHaveLength(1);
    await expect(controller.create(user, { merchant: "Cloud", categoryId: "cat-subscription", amount: 49 })).resolves.toEqual({ id: "sub-2", source: "manual" });
    expect(store.createSubscription).toHaveBeenCalledWith("user-1", { merchant: "Cloud", categoryId: "cat-subscription", amount: 49 });
    await expect(controller.update(user, "sub-1", { status: "cancelled" })).resolves.toEqual({ id: "sub-1", status: "cancelled" });
    expect(store.updateSubscription).toHaveBeenCalledWith("user-1", "sub-1", { status: "cancelled" });
  });

  it("returns 404 for missing subscriptions", async () => {
    const controller = new SubscriptionsController({ updateSubscription: vi.fn(async () => undefined) } as never);
    await expect(controller.update(user, "missing", { status: "ignored" })).rejects.toBeInstanceOf(NotFoundException);
  });
});
