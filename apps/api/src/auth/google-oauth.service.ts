import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";

export interface GoogleIdentityProfile {
  subject: string;
  email: string;
  name: string;
}

@Injectable()
export class GoogleOAuthService {
  private client?: OAuth2Client;

  isConfigured() {
    return Boolean(this.clientId());
  }

  async verifyIdToken(idToken: string, expectedNonce?: string): Promise<GoogleIdentityProfile> {
    const clientId = this.clientId();
    if (!clientId) throw new ServiceUnavailableException("GOOGLE_OAUTH_CLIENT_ID tanımlı değil.");

    const payload = await this.verifiedPayload(idToken, clientId);
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException("Google kimliği doğrulanamadı.");
    }
    if (payload.email_verified !== true) {
      throw new UnauthorizedException("Google e-posta adresi doğrulanmamış.");
    }
    if (expectedNonce && payload.nonce !== expectedNonce) {
      throw new UnauthorizedException("Google oturum nonce değeri geçersiz.");
    }

    return {
      subject: payload.sub,
      email: payload.email.trim().toLowerCase(),
      name: payload.name?.trim() || payload.email.split("@")[0] || "Google Kullanıcısı"
    };
  }

  private clientId() {
    return process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  }

  private async verifiedPayload(idToken: string, clientId: string) {
    try {
      const ticket = await this.getClient(clientId).verifyIdToken({
        idToken,
        audience: clientId
      });
      return ticket.getPayload();
    } catch {
      throw new UnauthorizedException("Google oturum token'ı geçersiz.");
    }
  }

  private getClient(clientId: string) {
    this.client ??= new OAuth2Client(clientId);
    return this.client;
  }
}
