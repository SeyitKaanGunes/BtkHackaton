import { describe, expect, it } from "vitest";
import { computeFileHash } from "../src/documents/file-hash.js";

describe("computeFileHash", () => {
  it("returns the same hash for the same base64 input", () => {
    const input = Buffer.from("same-file").toString("base64");
    expect(computeFileHash(input)).toBe(computeFileHash(input));
  });

  it("returns different hashes for different inputs", () => {
    expect(computeFileHash(Buffer.from("file-a").toString("base64"))).not.toBe(computeFileHash(Buffer.from("file-b").toString("base64")));
  });

  it("returns a 64-character hex sha256 hash", () => {
    expect(computeFileHash(Buffer.from("file").toString("base64"))).toMatch(/^[a-f0-9]{64}$/);
  });
});
