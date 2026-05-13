import { describe, expect, it } from "vitest";
import {
  InMemoryUserDecisionEventRepository,
  createUserDecisionEvent,
  generateScenarioId,
  validateUserDecisionEvent,
  type UserDecisionAction
} from "./feedback-events.js";

describe("user decision feedback events", () => {
  it("generates scenario ids", () => {
    const scenarioId = generateScenarioId("what-if");
    expect(scenarioId).toMatch(/^what-if-/);
  });

  it.each<UserDecisionAction>(["bought", "delayed", "cancelled", "planned"])("validates %s events", (userAction) => {
    const event = createUserDecisionEvent({
      scenarioId: "scenario-1",
      userAction,
      originalAmount: 1000,
      category: "technology",
      timestamp: new Date("2026-05-11T12:00:00.000Z")
    });

    expect(validateUserDecisionEvent(event)).toEqual({ valid: true, errors: [] });
  });

  it("requires finalAmount for reduced events", () => {
    const event = createUserDecisionEvent({
      scenarioId: "scenario-1",
      userAction: "reduced",
      originalAmount: 1000,
      category: "technology"
    });

    const validation = validateUserDecisionEvent(event);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("reduced için finalAmount gerekli.");
  });

  it("requires finalAmount to be lower than originalAmount for reduced events", () => {
    const event = createUserDecisionEvent({
      scenarioId: "scenario-1",
      userAction: "reduced",
      originalAmount: 1000,
      finalAmount: 1000,
      category: "technology"
    });

    const validation = validateUserDecisionEvent(event);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("reduced için finalAmount originalAmount'tan küçük olmalı.");
  });

  it("sets timestamp automatically", () => {
    const event = createUserDecisionEvent({
      scenarioId: "scenario-1",
      userAction: "delayed",
      originalAmount: 1000,
      category: "technology"
    });

    expect(event.timestamp).toBeInstanceOf(Date);
    expect(Number.isNaN(event.timestamp.getTime())).toBe(false);
  });

  it("stores and queries events in memory", async () => {
    const repository = new InMemoryUserDecisionEventRepository();
    const first = createUserDecisionEvent({
      scenarioId: "scenario-1",
      userAction: "delayed",
      originalAmount: 1000,
      category: "technology",
      timestamp: new Date("2026-05-11T12:00:00.000Z")
    });
    const second = createUserDecisionEvent({
      scenarioId: "scenario-2",
      userAction: "cancelled",
      originalAmount: 500,
      category: "food",
      timestamp: new Date("2026-05-11T13:00:00.000Z")
    });

    await repository.save(first);
    await repository.save(second);

    expect(await repository.list()).toEqual([first, second]);
    expect(await repository.findByScenarioId("scenario-1")).toEqual([first]);
  });
});
