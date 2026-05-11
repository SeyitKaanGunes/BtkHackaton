import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { DataStoreService } from "../data/data-store.service.js";
import type { AuthUser } from "./auth-user.js";

@Injectable()
export class AuthService {
  constructor(
    @Inject(DataStoreService) private readonly store: DataStoreService,
    @Inject(JwtService) private readonly jwt: JwtService
  ) {}

  async register(input: { name: string; email: string; password: string }) {
    if (await this.store.findUserByEmail(input.email)) {
      throw new UnauthorizedException("Bu e-posta ile kullanıcı zaten var.");
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.store.createUser({
      id: `user-${randomUUID()}`,
      name: input.name,
      email: input.email,
      persona: "young_professional",
      monthlyIncome: 0,
      payday: 5,
      currency: "TRY",
      passwordHash
    });
    return this.toAuthResponse(user);
  }

  async login(input: { email: string; password: string }) {
    const user = await this.store.findUserByEmail(this.normalizeLoginIdentifier(input.email));
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException("E-posta veya şifre hatalı.");
    }
    return this.toAuthResponse(user);
  }

  async me(userId: string) {
    const user = await this.store.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException("Kullanıcı bulunamadı.");
    }
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  verifyToken(token?: string) {
    if (!token) throw new UnauthorizedException("Authorization token gerekli.");
    const cleaned = token.replace(/^Bearer\s+/i, "");
    try {
      const payload = this.jwt.verify<{ sub: string }>(cleaned);
      return payload.sub;
    } catch {
      throw new UnauthorizedException("Authorization token geçersiz.");
    }
  }

  async userFromAuthorization(authorization?: string): Promise<AuthUser> {
    const userId = this.verifyToken(authorization);
    const user = await this.store.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException("Kullanıcı bulunamadı.");
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name
    };
  }

  private toAuthResponse(user: { id: string; email: string; name: string; persona: string; monthlyIncome: number; payday: number; currency: string }) {
    const token = this.jwt.sign({ sub: user.id, email: user.email });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        persona: user.persona,
        monthlyIncome: user.monthlyIncome,
        payday: user.payday,
        currency: user.currency
      },
      oauth: {
        googleReady: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET)
      }
    };
  }

  private normalizeLoginIdentifier(identifier: string) {
    return identifier.trim().toLocaleLowerCase("tr-TR") === "admin" ? "admin@local.dev" : identifier;
  }
}
