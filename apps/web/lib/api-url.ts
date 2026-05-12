export function resolveApiUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const isProduction = process.env.NODE_ENV === "production";
  if (!configured) {
    if (isProduction) throw new Error("NEXT_PUBLIC_API_URL is required when NODE_ENV=production.");
    return "http://localhost:4000";
  }

  const normalized = configured.replace(/\/$/, "");
  if (isProduction && (normalized === "http://localhost:4000" || normalized.includes("your-api-domain.com"))) {
    throw new Error("NEXT_PUBLIC_API_URL must point to the production API when NODE_ENV=production.");
  }
  return normalized;
}
