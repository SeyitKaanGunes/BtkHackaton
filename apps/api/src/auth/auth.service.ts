import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { DataStoreService } from "../data/data-store.service.js";

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
      id: `user-${Date.now()}`,
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
    const user = await this.store.findUserByEmail(input.email);
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException("E-posta veya şifre hatalı.");
    }
    return this.toAuthResponse(user);
  }

  async me(userId: string) {
    const user = (await this.store.findUserById(userId)) ?? this.store.getDemoUser();
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  verifyToken(token?: string) {
    if (!token) return this.store.getDemoUser().id;
    const cleaned = token.replace(/^Bearer\s+/i, "");
    const payload = this.jwt.verify<{ sub: string }>(cleaned);
    return payload.sub;
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
}
