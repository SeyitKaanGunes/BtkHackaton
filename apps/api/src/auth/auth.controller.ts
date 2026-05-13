import { Body, Controller, Get, Inject, Patch, Post, UseGuards } from "@nestjs/common";
import { IsEmail, IsIn, IsJWT, IsNumber, IsOptional, IsString, Max, Min, MinLength } from "class-validator";
import type { AuthUser } from "./auth-user.js";
import { AuthService } from "./auth.service.js";
import { CurrentUser } from "./current-user.decorator.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { RateLimit } from "../rate-limit/rate-limit.decorator.js";

class RegisterDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsIn(["personal", "business"])
  accountType?: "personal" | "business";
}

class LoginDto {
  @IsString()
  email!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsIn(["personal", "business"])
  accountType?: "personal" | "business";
}

class GoogleLoginDto {
  @IsJWT()
  idToken!: string;

  @IsOptional()
  @IsString()
  nonce?: string;

  @IsOptional()
  @IsIn(["personal", "business"])
  accountType?: "personal" | "business";
}

class UpdateFinanceProfileDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyIncome?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  payday?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("register")
  @RateLimit({ limit: 5, windowMs: 60_000 })
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Post("login")
  @RateLimit({ limit: 8, windowMs: 60_000 })
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  @Post("google")
  @RateLimit({ limit: 12, windowMs: 60_000 })
  google(@Body() body: GoogleLoginDto) {
    return this.auth.loginWithGoogle(body);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  async updateMe(@CurrentUser() user: AuthUser, @Body() body: UpdateFinanceProfileDto) {
    return this.auth.updateFinanceProfile(user.id, body);
  }
}
