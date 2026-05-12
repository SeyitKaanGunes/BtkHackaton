import { NextRequest, NextResponse } from "next/server";
import { resolveApiUrl } from "../../../../lib/api-url";

const authActions = new Set(["login", "register", "google"]);
const sessionCookie = "fintwin_token";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

type AuthRouteContext = {
  params: Promise<{ action: string }> | { action: string };
};

export async function POST(request: NextRequest, context: AuthRouteContext) {
  const { action } = await context.params;
  if (action === "logout") return clearSession();
  if (!authActions.has(action)) {
    return NextResponse.json({ message: "Auth action not found." }, { status: 404 });
  }

  const backendResponse = await fetch(`${resolveApiUrl()}/auth/${action}`, {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json"
    },
    body: await request.text(),
    cache: "no-store"
  });
  const payload = await readJsonBody(backendResponse);

  if (!backendResponse.ok) {
    return NextResponse.json(payload ?? { message: backendResponse.statusText }, { status: backendResponse.status });
  }

  const token = typeof payload?.token === "string" ? payload.token : undefined;
  if (!token) {
    return NextResponse.json({ message: "Auth response did not include a token." }, { status: 502 });
  }

  const { token: _token, ...publicPayload } = payload as Record<string, unknown>;
  const response = NextResponse.json(publicPayload, { status: backendResponse.status });
  response.cookies.set(sessionCookie, token, {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}

function clearSession() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}

async function readJsonBody(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
