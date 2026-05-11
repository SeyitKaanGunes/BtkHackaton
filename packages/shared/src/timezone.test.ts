import { describe, expect, it } from "vitest";
import { getLocalDateParts, isLocalNight, isLocalWeekend, isLocalWeekendNight, resolveTimeZone } from "./timezone.js";

describe("timezone helpers", () => {
  it("defaults invalid or missing timezones to Europe/Istanbul", () => {
    expect(resolveTimeZone()).toBe("Europe/Istanbul");
    expect(resolveTimeZone("Not/AZone")).toBe("Europe/Istanbul");
  });

  it("converts UTC timestamps to Europe/Istanbul local time", () => {
    const parts = getLocalDateParts("2026-05-08T17:30:00.000Z", "Europe/Istanbul");
    expect(parts.hour).toBe(20);
    expect(parts.minute).toBe(30);
  });

  it("classifies local night and weekend combinations separately", () => {
    const weekdayNight = "2026-05-08T17:30:00.000Z";
    const weekendDay = "2026-05-09T10:00:00.000Z";
    const weekendNight = "2026-05-09T17:30:00.000Z";

    expect(isLocalNight(weekdayNight, "Europe/Istanbul")).toBe(true);
    expect(isLocalWeekend(weekdayNight, "Europe/Istanbul")).toBe(false);
    expect(isLocalWeekendNight(weekdayNight, "Europe/Istanbul")).toBe(false);

    expect(isLocalWeekend(weekendDay, "Europe/Istanbul")).toBe(true);
    expect(isLocalNight(weekendDay, "Europe/Istanbul")).toBe(false);
    expect(isLocalWeekendNight(weekendDay, "Europe/Istanbul")).toBe(false);

    expect(isLocalNight(weekendNight, "Europe/Istanbul")).toBe(true);
    expect(isLocalWeekend(weekendNight, "Europe/Istanbul")).toBe(true);
    expect(isLocalWeekendNight(weekendNight, "Europe/Istanbul")).toBe(true);
  });
});
