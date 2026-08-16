import { describe, expect, it } from "vitest";

import { dpAmount, priceForSlot, resolveDayType } from "./pricing";

describe("resolveDayType", () => {
  it("resolves a weekday to 'weekday'", () => {
    // 2026-08-17 is a Monday.
    expect(resolveDayType("2026-08-17", new Set())).toBe("weekday");
  });

  it("resolves a Saturday to 'weekend'", () => {
    expect(resolveDayType("2026-08-22", new Set())).toBe("weekend");
  });

  it("resolves a Sunday to 'weekend'", () => {
    expect(resolveDayType("2026-08-23", new Set())).toBe("weekend");
  });

  it("resolves a weekday that is in the holiday list to 'weekend'", () => {
    // 2026-08-17 is a Monday, but flagged as a public holiday.
    expect(resolveDayType("2026-08-17", new Set(["2026-08-17"]))).toBe("weekend");
  });

  it("does not let an unrelated holiday date affect a plain weekday", () => {
    expect(resolveDayType("2026-08-18", new Set(["2026-08-17"]))).toBe("weekday");
  });
});

describe("dpAmount", () => {
  it("rounds an even split exactly", () => {
    expect(dpAmount(200000, 50)).toBe(100000);
  });

  it("rounds half-up when the split does not land on a whole rupiah", () => {
    // 100001 * 50 / 100 = 50000.5 -> rounds up to 50001
    expect(dpAmount(100001, 50)).toBe(50001);
  });

  it("handles a non-50 dp_percent", () => {
    // 350000 * 30 / 100 = 105000 exactly
    expect(dpAmount(350000, 30)).toBe(105000);
  });
});

describe("priceForSlot", () => {
  const rateCard = [
    { time_slot: "16.00 - 17.00" as const, day_type: "weekday" as const, price_rupiah: 300000 },
    { time_slot: "16.00 - 17.00" as const, day_type: "weekend" as const, price_rupiah: 350000 },
  ];

  it("returns the weekday price on a weekday", () => {
    expect(priceForSlot(rateCard, "2026-08-17", "16.00 - 17.00", new Set())).toBe(300000);
  });

  it("returns the weekend price on a Saturday", () => {
    expect(priceForSlot(rateCard, "2026-08-22", "16.00 - 17.00", new Set())).toBe(350000);
  });

  it("returns null for a slot with no rate_card row rather than 0", () => {
    expect(priceForSlot(rateCard, "2026-08-17", "06.00 - 07.00", new Set())).toBeNull();
  });
});
