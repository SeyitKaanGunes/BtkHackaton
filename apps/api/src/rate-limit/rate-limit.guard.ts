import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { RATE_LIMIT_METADATA, type RateLimitOptions } from "./rate-limit.decorator.js";

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_METADATA, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const key = this.keyFor(request, options);
    const existing = this.buckets.get(key);
    const bucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + options.windowMs };

    bucket.count += 1;
    this.buckets.set(key, bucket);
    this.deleteExpiredBuckets(now);

    if (bucket.count <= options.limit) return true;

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: "Çok fazla istek gönderildi. Biraz bekleyip tekrar deneyin.",
        retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000)
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  private keyFor(request: Request, options: RateLimitOptions) {
    const route = `${request.method}:${request.route?.path ?? request.originalUrl?.split("?")[0] ?? request.url}`;
    const scope = options.scope === "credential" ? credentialScope(request) : ipScope(request);
    return `${route}:${scope}`;
  }

  private deleteExpiredBuckets(now: number) {
    if (this.buckets.size < 1000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

function credentialScope(request: Request) {
  const authorization = Array.isArray(request.headers.authorization) ? request.headers.authorization[0] : request.headers.authorization;
  return authorization?.trim() || ipScope(request);
}

function ipScope(request: Request) {
  const forwarded = request.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return forwardedIp?.trim() || request.ip || request.socket.remoteAddress || "unknown";
}
