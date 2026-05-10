import { describe, expect, it } from "vitest";
import { validateApiEnvironment } from "../src/config/env.js";

describe("API environment validation", () => {
  it("requires Twelve Data in production", () => {
    expect(() => validateApiEnvironment(productionEnv({ TWELVE_DATA_API_KEY: undefined }))).toThrow("TWELVE_DATA_API_KEY is required.");
  });

  it("rejects placeholder Twelve Data keys in production", () => {
    expect(() => validateApiEnvironment(productionEnv({ TWELVE_DATA_API_KEY: "your-twelve-data-api-key" }))).toThrow(
      "TWELVE_DATA_API_KEY must be a real Twelve Data API key in production."
    );
  });

  it("allows development without Twelve Data", () => {
    expect(() =>
      validateApiEnvironment({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/fintwin",
        DIRECT_URL: "postgresql://user:pass@localhost:5432/fintwin"
      })
    ).not.toThrow();
  });
});

function productionEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "production",
    PORT: "4000",
    API_CORS_ORIGINS: "https://app.example.com",
    DATABASE_URL: "postgresql://user:pass@db.example.com:5432/fintwin",
    DIRECT_URL: "postgresql://user:pass@db.example.com:5432/fintwin",
    JWT_SECRET: "0123456789abcdef0123456789abcdef",
    QWEN_API_KEY: "qwen-prod-key",
    TWELVE_DATA_API_KEY: "twelve-data-prod-key",
    ...overrides
  };
}
