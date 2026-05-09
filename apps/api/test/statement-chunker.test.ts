import { describe, expect, it } from "vitest";
import { chunkLines } from "../src/documents/statement-chunker.js";

describe("chunkLines", () => {
  it("returns one chunk for 80 lines", () => {
    const lines = Array.from({ length: 80 }, (_, index) => `line-${index}`);
    expect(chunkLines(lines)).toHaveLength(1);
    expect(chunkLines(lines)[0]).toHaveLength(80);
  });

  it("splits 81 lines into 80 + 1", () => {
    const chunks = chunkLines(Array.from({ length: 81 }, (_, index) => `line-${index}`));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(80);
    expect(chunks[1]).toHaveLength(1);
  });

  it("returns no chunks for an empty list", () => {
    expect(chunkLines([])).toEqual([]);
  });

  it("supports a custom chunk size", () => {
    const chunks = chunkLines(Array.from({ length: 120 }, (_, index) => `line-${index}`), 50);
    expect(chunks.map((chunk) => chunk.length)).toEqual([50, 50, 20]);
  });
});
