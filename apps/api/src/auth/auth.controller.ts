import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { IsEmail, IsString, MinLength } from "class-validator";
import { AuthService } from "./auth.service.js";

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
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Post("login")
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  @Get("me")
  me(@Headers("authorization") authorization?: string) {
    return this.auth.me(this.auth.verifyToken(authorization));
  }

  @Get("google")
  googleOAuthPlaceholder() {
    return {
      ready: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET),
      message: "Google OAuth callback hazırlığı mevcut; client bilgileri eklendiğinde etkinleşir."
    };
  }
}
