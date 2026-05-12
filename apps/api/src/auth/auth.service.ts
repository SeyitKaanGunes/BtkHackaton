import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { DataStoreService } from "../data/data-store.service.js";
import type { Currency } from "@fintwin/shared";
import type { AuthUser } from "./auth-user.js";
import { GoogleOAuthService } from "./google-oauth.service.js";

const CURRENCIES = new Set<Currency>(["TRY", "USD", "EUR"]);

@Injectable()
export class AuthService {
  constructor(
    @Inject(DataStoreService) private readonly store: DataStoreService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(GoogleOAuthService) private readonly google: GoogleOAuthService
  ) {}

  async register(input: { name: string; email: string; password: string }) {
    const email = normalizeEmail(input.email);
    if (await this.store.findUserByEmail(email)) {
      throw new UnauthorizedException("Bu e-posta ile kullanıcı zaten var.");
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.store.createUser({
      id: `user-${randomUUID()}`,
      name: input.name.trim(),
      email,
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

  async loginWithGoogle(input: { idToken: string; nonce?: string }) {
    const profile = await this.google.verifyIdToken(input.idToken, input.nonce);
    const linkedUser = await this.store.findUserByGoogleSubject(profile.subject);
    if (linkedUser) return this.toAuthResponse(linkedUser);

    const existingEmailUser = await this.store.findUserByEmail(profile.email);
    if (existingEmailUser) {
      const linked = await this.store.linkGoogleSubject(existingEmailUser.id, profile.subject);
      return this.toAuthResponse(linked);
    }

    const passwordHash = await bcrypt.hash(`google-oauth-${randomUUID()}`, 10);
    const user = await this.store.createUser({
      id: `user-${randomUUID()}`,
      name: profile.name,
      email: profile.email,
      googleSubject: profile.subject,
      persona: "young_professional",
      monthlyIncome: 0,
      payday: 5,
      currency: "TRY",
      passwordHash
    });
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

  async updateFinanceProfile(userId: string, input: { monthlyIncome?: unknown; payday?: unknown; currency?: unknown }) {
    const update = {
      monthlyIncome: optionalNonNegativeMoney(input.monthlyIncome, "monthlyIncome"),
      payday: optionalPayday(input.payday),
      currency: optionalCurrency(input.currency)
    };
    const hasUpdate = Object.values(update).some((value) => value !== undefined);
    if (!hasUpdate) {
      throw new BadRequestException("Güncellenecek maaş veya ödeme günü bilgisi gerekli.");
    }
    const user = await this.store.updateUserFinanceProfile(userId, update);
    await this.store.ensureMonthlySalaryTransactions(userId);
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
        googleReady: this.google.isConfigured()
      }
    };
  }

  private normalizeLoginIdentifier(identifier: string) {
    const normalized = identifier.trim();
    return normalized.toLowerCase() === "admin" ? "admin@local.dev" : normalizeEmail(normalized);
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function optionalNonNegativeMoney(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new BadRequestException(`${field} sıfır veya pozitif sayı olmalı.`);
  }
  return Number(parsed.toFixed(2));
}

function optionalPayday(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
    throw new BadRequestException("payday 1-31 arasında tam sayı olmalı.");
  }
  return parsed;
}

function optionalCurrency(value: unknown): Currency | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new BadRequestException("currency TRY, USD veya EUR olmalı.");
  const currency = value.trim().toUpperCase();
  if (!CURRENCIES.has(currency as Currency)) {
    throw new BadRequestException("currency TRY, USD veya EUR olmalı.");
  }
  return currency as Currency;
}
