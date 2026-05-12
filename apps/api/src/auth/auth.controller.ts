import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { IsEmail, IsJWT, IsOptional, IsString, MinLength } from "class-validator";
import type { AuthUser } from "./auth-user.js";
import { AuthService } from "./auth.service.js";
import { CurrentUser } from "./current-user.decorator.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

class RegisterDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

class LoginDto {
  @IsString()
  email!: string;

  @IsString()
  password!: string;
}

class GoogleLoginDto {
  @IsJWT()
  idToken!: string;

  @IsOptional()
  @IsString()
  nonce?: string;
}

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Post("login")
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  @Post("google")
  google(@Body() body: GoogleLoginDto) {
    return this.auth.loginWithGoogle(body);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
