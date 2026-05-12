import { describe, expect, it } from "vitest";
import { localDateInputValue, parseMoneyInput } from "./input-format";

describe("input formatting helpers", () => {
  it("parses comma and dot decimal money inputs without changing scale", () => {
    expect(parseMoneyInput("345,67")).toBe(345.67);
    expect(parseMoneyInput("345.67")).toBe(345.67);
    expect(parseMoneyInput("1.234,56")).toBe(1234.56);
    expect(parseMoneyInput("1,234.56")).toBe(1234.56);
  });

  it("keeps thousands-only money inputs and rejects ambiguous precision", () => {
    expect(parseMoneyInput("1.234")).toBe(1234);
    expect(parseMoneyInput("1,234")).toBe(1234);
    expect(parseMoneyInput("1234.567")).toBeUndefined();
    expect(parseMoneyInput("abc")).toBeUndefined();
  });

  it("formats date inputs from local calendar fields", () => {
    expect(localDateInputValue(new Date(2026, 4, 12, 1, 30))).toBe("2026-05-12");
  });
});
