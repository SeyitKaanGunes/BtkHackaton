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

  it("rejects placeholder Gemini keys in production", () => {
    expect(() => validateApiEnvironment(productionEnv({ GEMINI_API_KEY: "your-gemini-api-key" }))).toThrow(
      "GEMINI_API_KEY must be a real Gemini API key in production."
    );
  });

  it("requires Google OAuth and Gemini keys in production", () => {
    expect(() => validateApiEnvironment(productionEnv({ GOOGLE_OAUTH_CLIENT_ID: undefined }))).toThrow("GOOGLE_OAUTH_CLIENT_ID is required.");
    expect(() => validateApiEnvironment(productionEnv({ GEMINI_API_KEY: undefined }))).toThrow("GEMINI_API_KEY is required.");
  });

  it("rejects placeholder Google OAuth and Gemini keys in production", () => {
    expect(() => validateApiEnvironment(productionEnv({ GOOGLE_OAUTH_CLIENT_ID: "optional-google-oauth-client-id" }))).toThrow(
      "GOOGLE_OAUTH_CLIENT_ID must be a real Google OAuth web client ID in production."
    );
    expect(() => validateApiEnvironment(productionEnv({ GEMINI_API_KEY: "your-gemini-api-key" }))).toThrow(
      "GEMINI_API_KEY must be a real Gemini API key in production."
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
    TWELVE_DATA_API_KEY: "twelve-data-prod-key",
    GOOGLE_OAUTH_CLIENT_ID: "google-web-client-id.apps.googleusercontent.com",
    GEMINI_API_KEY: "gemini-prod-key",
    ...overrides
  };
}
