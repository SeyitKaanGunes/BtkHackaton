import { SetMetadata } from "@nestjs/common";

export const RATE_LIMIT_METADATA = "fintwin:rate-limit";

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  scope?: "ip" | "credential";
}

export function RateLimit(options: RateLimitOptions) {
  return SetMetadata(RATE_LIMIT_METADATA, options);
}
