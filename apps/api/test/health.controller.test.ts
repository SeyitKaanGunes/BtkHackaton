import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { HealthController } from "../src/health/health.controller.js";

describe("HealthController", () => {
  it("returns liveness without checking dependencies", () => {
    const controller = new HealthController({ isConnected: () => false } as never, { isReady: () => false } as never);
    expect(controller.health().status).toBe("ok");
  });

  it("returns readiness when database and datastore are ready", () => {
    const controller = new HealthController({ isConnected: () => true } as never, { isReady: () => true } as never);
    expect(controller.ready()).toMatchObject({ status: "ready", database: true, datastore: true });
  });

  it("fails readiness when a dependency is not ready", () => {
    const controller = new HealthController({ isConnected: () => true } as never, { isReady: () => false } as never);
    expect(() => controller.ready()).toThrow(ServiceUnavailableException);
  });
});
