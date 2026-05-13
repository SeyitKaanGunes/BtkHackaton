import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(webDir, "../..");

loadEnvIfMissing(resolve(repoRoot, ".env"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: repoRoot
  },
  transpilePackages: ["@fintwin/shared"]
};

export default nextConfig;

function loadEnvIfMissing(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key]) continue;
    process.env[key] = unquote(trimmed.slice(separator + 1).trim());
  }
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
