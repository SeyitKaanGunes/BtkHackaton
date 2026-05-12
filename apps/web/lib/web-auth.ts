import type { AuthResponse } from "./api";

export type WebAuthResponse = Omit<AuthResponse, "token">;

type AccountType = "personal" | "business";

export function register(input: { name: string; email: string; password: string; accountType?: AccountType }) {
  return authRequest("register", input);
}

export function login(input: { email: string; password: string; accountType?: AccountType }) {
  return authRequest("login", input);
}

export function loginWithGoogle(input: { idToken: string; nonce?: string; accountType?: AccountType }) {
  return authRequest("google", input);
}

export async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    cache: "no-store"
  });
}

async function authRequest(action: "register" | "login" | "google", body: unknown): Promise<WebAuthResponse> {
  const response = await fetch(`/api/auth/${action}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(await readAuthError(response));
  }
  return (await response.json()) as WebAuthResponse;
}

async function readAuthError(response: Response) {
  try {
    const body = (await response.json()) as Record<string, unknown>;
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string") return body.message;
    if (typeof body.error === "string") return body.error;
  } catch {
    // Response was not JSON; fall through to status text.
  }
  return response.statusText || "Oturum açılamadı.";
}
