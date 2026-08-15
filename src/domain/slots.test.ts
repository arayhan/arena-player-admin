import { describe, expect, it } from "vitest";

import { TIME_SLOTS, canonicalSlot, isTimeSlot, slotStartHour } from "./slots";

describe("TIME_SLOTS", () => {
  it("has eighteen slots covering 06.00 to 24.00", () => {
    // Nine 2-hour slots became eighteen 1-hour slots on 2026-08-15.
    expect(TIME_SLOTS).toHaveLength(18);
    expect(TIME_SLOTS[0]).toBe("06.00 - 07.00");
    expect(TIME_SLOTS[17]).toBe("23.00 - 24.00");
  });

  it("uses space-hyphen-space, which is what Postgres compares", () => {
    // uniq_active_slot compares time_slot as TEXT. Asserting the separator
    // rather than eyeballing it is the difference between a working race
    // guard and a silently disabled one.
    for (const slot of TIME_SLOTS) {
      expect(slot).toMatch(/^\d{2}\.\d{2} - \d{2}\.\d{2}$/);
    }
  });

  it("is contiguous, one hour apart, with no gap or overlap", () => {
    TIME_SLOTS.forEach((slot, i) => {
      expect(slotStartHour(slot)).toBe(6 + i);
      if (i > 0) expect(slot.slice(0, 5)).toBe(TIME_SLOTS[i - 1].slice(8));
    });
  });
});

describe("canonicalSlot", () => {
  it("accepts the canonical form unchanged", () => {
    expect(canonicalSlot("18.00 - 19.00")).toBe("18.00 - 19.00");
  });

  it("repairs the near misses that would book a different slot", () => {
    // Each of these is a DIFFERENT row to Postgres if it reaches the database.
    expect(canonicalSlot("18.00-19.00")).toBe("18.00 - 19.00");
    expect(canonicalSlot("18.00 -19.00")).toBe("18.00 - 19.00");
    expect(canonicalSlot("  18.00   -   19.00  ")).toBe("18.00 - 19.00");
    expect(canonicalSlot("6.00 - 7.00")).toBe("06.00 - 07.00");
  });

  it("returns null for a well-formed slot nobody sells", () => {
    // The tolerant alternative — clean it up and pass it on — would let this
    // through as a real slot. '07.00 - 09.00' is a 2-hour span, which is the
    // OLD granularity: it must not silently resolve to a 1-hour neighbour.
    expect(canonicalSlot("07.00 - 09.00")).toBeNull();
    expect(canonicalSlot("00.00 - 01.00")).toBeNull();
  });

  it("returns null for a slot string from the retired 2-hour scheme", () => {
    // Every one of these booked a real slot before 2026-08-15. None of them
    // may resolve to a 1-hour neighbour that happens to start at the same hour.
    expect(canonicalSlot("06.00 - 08.00")).toBeNull();
    expect(canonicalSlot("22.00 - 24.00")).toBeNull();
  });

  it("returns null for anything that is not a slot", () => {
    expect(canonicalSlot("")).toBeNull();
    expect(canonicalSlot("18:00 - 19:00")).toBeNull();
    expect(canonicalSlot("sore")).toBeNull();
    expect(canonicalSlot("18.00 - 19.00 WITA")).toBeNull();
  });
});

describe("isTimeSlot", () => {
  it("rejects the near miss the canonicaliser exists to catch", () => {
    expect(isTimeSlot("18.00 - 19.00")).toBe(true);
    expect(isTimeSlot("18.00-19.00")).toBe(false);
  });

  it("rejects a retired 2-hour slot string", () => {
    expect(isTimeSlot("18.00 - 20.00")).toBe(false);
  });
});
