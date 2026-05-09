import { createHash } from "node:crypto";

export function computeFileHash(base64: string): string {
  return createHash("sha256").update(Buffer.from(base64, "base64")).digest("hex");
}
