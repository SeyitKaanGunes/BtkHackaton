import { describe, expect, it } from "vitest";
import { normalizeMarketSymbolQuery, shouldSearchMarketSymbols } from "./portfolio-form";

describe("portfolio form helpers", () => {
  it("keeps portfolio overview from triggering market symbol search", () => {
    expect(shouldSearchMarketSymbols({ mode: "overview", isCash: false, query: "THYAO" })).toBe(false);
  });

  it("skips market symbol search for cash holdings", () => {
    expect(shouldSearchMarketSymbols({ mode: "add", isCash: true, query: "vadeli" })).toBe(false);
  });

  it("waits for at least two non-space characters before searching", () => {
    expect(shouldSearchMarketSymbols({ mode: "add", isCash: false, query: "" })).toBe(false);
    expect(shouldSearchMarketSymbols({ mode: "add", isCash: false, query: " T " })).toBe(false);
    expect(shouldSearchMarketSymbols({ mode: "add", isCash: false, query: " TH " })).toBe(true);
  });

  it("normalizes user-entered symbol queries before sending them to the API", () => {
    expect(normalizeMarketSymbolQuery("  AAPL  ")).toBe("AAPL");
  });
});
