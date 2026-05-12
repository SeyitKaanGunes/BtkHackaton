import { NextRequest, NextResponse } from "next/server";
import { resolveApiUrl } from "../../../../lib/api-url";

type BackendRouteContext = {
  params: Promise<{ path: string[] }> | { path: string[] };
};

export function GET(request: NextRequest, context: BackendRouteContext) {
  return proxyToBackend(request, context);
}

export function POST(request: NextRequest, context: BackendRouteContext) {
  return proxyToBackend(request, context);
}

export function PATCH(request: NextRequest, context: BackendRouteContext) {
  return proxyToBackend(request, context);
}

export function DELETE(request: NextRequest, context: BackendRouteContext) {
  return proxyToBackend(request, context);
}

async function proxyToBackend(request: NextRequest, context: BackendRouteContext) {
  const { path } = await context.params;
  const token = request.cookies.get("fintwin_token")?.value;
  const targetUrl = `${resolveApiUrl()}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const backendResponse = await fetch(targetUrl, {
    method: request.method,
    headers: forwardedHeaders(request, token),
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store"
  });

  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders(backendResponse)
  });
}

function forwardedHeaders(request: NextRequest, token?: string) {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");
  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return headers;
}

function responseHeaders(response: Response) {
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  return headers;
}
