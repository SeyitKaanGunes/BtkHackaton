import { UnauthorizedException, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "./auth-user.js";

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
  if (!request.user) throw new UnauthorizedException("Authorization token gerekli.");
  return request.user;
});
