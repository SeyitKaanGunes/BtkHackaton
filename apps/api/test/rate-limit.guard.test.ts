import type { ExecutionContext } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { RateLimitGuard } from "../src/rate-limit/rate-limit.guard.js";

describe("RateLimitGuard", () => {
  it("allows requests without rate limit metadata", () => {
    const guard = new RateLimitGuard({ getAllAndOverride: vi.fn(() => undefined) } as never);
    expect(guard.canActivate(contextFor("127.0.0.1"))).toBe(true);
  });

  it("returns HTTP 429 after the route limit is exceeded", () => {
    const guard = new RateLimitGuard({
      getAllAndOverride: vi.fn(() => ({ limit: 1, windowMs: 60_000 }))
    } as never);

    expect(guard.canActivate(contextFor("127.0.0.1"))).toBe(true);
    expect(() => guard.canActivate(contextFor("127.0.0.1"))).toThrow(HttpException);
  });

  it("uses credential scope when requested", () => {
    const guard = new RateLimitGuard({
      getAllAndOverride: vi.fn(() => ({ limit: 1, windowMs: 60_000, scope: "credential" }))
    } as never);

    expect(guard.canActivate(contextFor("127.0.0.1", "Bearer token-a"))).toBe(true);
    expect(guard.canActivate(contextFor("127.0.0.1", "Bearer token-b"))).toBe(true);
  });
});

function contextFor(ip: string, authorization?: string): ExecutionContext {
  const request = {
    method: "POST",
    route: { path: "/auth/login" },
    originalUrl: "/auth/login",
    url: "/auth/login",
    ip,
    socket: { remoteAddress: ip },
    headers: {
      ...(authorization ? { authorization } : {})
    }
  };

  return {
    getHandler: () => contextFor,
    getClass: () => Object,
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}
