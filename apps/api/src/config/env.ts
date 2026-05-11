import type { ConfigService } from "@nestjs/config";

const localCorsOrigins = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];
const localJwtSecret = "fintwin-local-dev-secret";
const jwtPlaceholderValues = new Set(["replace-with-a-local-development-secret", "replace-with-a-production-secret"]);
const qwenPlaceholderValues = new Set(["your-qwen-api-key", "replace-with-qwen-api-key", "replace-with-production-qwen-api-key"]);
const twelveDataPlaceholderValues = new Set(["your-twelve-data-api-key", "replace-with-a-twelve-data-api-key", "replace-with-production-twelve-data-api-key"]);

type EnvRecord = Record<string, unknown>;

export function validateApiEnvironment(config: EnvRecord) {
  const env = config as Record<string, string | undefined>;
  requireEnv(env, "DATABASE_URL");
  requireEnv(env, "DIRECT_URL");

  if (env.PORT) parsePort(env.PORT);
  if (env.API_CORS_ORIGINS) parseCorsOrigins(env.API_CORS_ORIGINS);

  if (isProduction(env)) {
    requireEnv(env, "API_CORS_ORIGINS");
    requireEnv(env, "JWT_SECRET");
    requireEnv(env, "QWEN_API_KEY");
    requireEnv(env, "TWELVE_DATA_API_KEY");
    validateProductionJwtSecret(env.JWT_SECRET);
    validateProductionQwenKey(env.QWEN_API_KEY);
    validateProductionTwelveDataKey(env.TWELVE_DATA_API_KEY);
  }

  return config;
}

export function getApiPort(config: ConfigService) {
  return parsePort(readConfig(config, "PORT") ?? "4000");
}

export function getCorsOrigins(config: ConfigService) {
  const configured = readConfig(config, "API_CORS_ORIGINS");
  if (configured) return parseCorsOrigins(configured);
  if (isProductionConfig(config)) {
    throw new Error("API_CORS_ORIGINS is required when NODE_ENV=production.");
  }
  return localCorsOrigins;
}

export function getJwtSecret(config: ConfigService) {
  const secret = readConfig(config, "JWT_SECRET");
  if (!secret) {
    if (isProductionConfig(config)) {
      throw new Error("JWT_SECRET is required when NODE_ENV=production.");
    }
    return localJwtSecret;
  }

  if (isProductionConfig(config)) validateProductionJwtSecret(secret);
  return secret;
}

function isProductionConfig(config: ConfigService) {
  return (readConfig(config, "NODE_ENV") ?? "development") === "production";
}

function isProduction(env: Record<string, string | undefined>) {
  return (env.NODE_ENV ?? "development") === "production";
}

function readConfig(config: ConfigService, key: string) {
  const value = config.get<string>(key) ?? process.env[key];
  return value?.trim() ? value.trim() : undefined;
}

function requireEnv(env: Record<string, string | undefined>, key: string) {
  if (!env[key]?.trim()) throw new Error(`${key} is required.`);
}

function parsePort(value: string) {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT must be a valid TCP port. Received: ${value}`);
  }
  return port;
}

function parseCorsOrigins(value: string) {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) throw new Error("API_CORS_ORIGINS must include at least one origin.");
  if (origins.includes("*")) throw new Error("API_CORS_ORIGINS cannot be '*'. Set explicit web app origins.");

  for (const origin of origins) {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`API_CORS_ORIGINS only supports http/https origins. Received: ${origin}`);
    }
  }

  return origins;
}

function validateProductionJwtSecret(secret: string | undefined) {
  if (!secret?.trim()) throw new Error("JWT_SECRET is required when NODE_ENV=production.");
  if (jwtPlaceholderValues.has(secret) || secret === localJwtSecret || secret.length < 32) {
    throw new Error("JWT_SECRET must be a non-placeholder value with at least 32 characters in production.");
  }
}

function validateProductionQwenKey(key: string | undefined) {
  const value = key?.trim().toLowerCase();
  if (!value) throw new Error("QWEN_API_KEY is required when NODE_ENV=production.");
  if (qwenPlaceholderValues.has(value)) {
    throw new Error("QWEN_API_KEY must be a real Qwen API key in production.");
  }
}

function validateProductionTwelveDataKey(key: string | undefined) {
  const value = key?.trim().toLowerCase();
  if (!value) throw new Error("TWELVE_DATA_API_KEY is required when NODE_ENV=production.");
  if (twelveDataPlaceholderValues.has(value)) {
    throw new Error("TWELVE_DATA_API_KEY must be a real Twelve Data API key in production.");
  }
}
