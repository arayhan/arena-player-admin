import { describe, expect, it } from "vitest";

import {
  BOOKING_WINDOW_DAYS,
  bookingWindow,
  isBookingDateString,
  isPastSlot,
  isWithinBookingWindow,
  todayAtField,
} from "./dates";

// Fixed instants, never the wall clock. vitest.config.ts pins TZ=UTC so these
// assertions fail on a machine whose helpers forgot the field context —
// without the pin they pass on any UTC+8 machine regardless.
const NOON_FIELD = new Date("2026-08-09T04:00:00Z"); // 12:00 WITA on the 9th
// 16:30Z is the decisive instant three ways: UTC says the 9th, Jakarta
// (UTC+7, the wrong pin this file used to carry) says 23:30 STILL the 9th,
// and only Makassar (UTC+8) says 00:30 on the 10th. A helper that quietly
// reverted to Asia/Jakarta fails here, not just one missing the context.
const LATE_EVENING = new Date("2026-08-09T16:30:00Z");

describe("todayAtField", () => {
  it("returns the field date (WITA), not the UTC or Jakarta one", () => {
    expect(todayAtField(LATE_EVENING)).toBe("2026-08-10");
    expect(todayAtField(NOON_FIELD)).toBe("2026-08-09");
  });

  it("does not go through toISOString, which would shift the date back", () => {
    expect(LATE_EVENING.toISOString().slice(0, 10)).toBe("2026-08-09");
    expect(todayAtField(LATE_EVENING)).not.toBe("2026-08-09");
  });
});

describe("bookingWindow", () => {
  it("is today plus the next 91 days, earliest first", () => {
    // ~3 months — see the reasoning on BOOKING_WINDOW_DAYS in dates.ts.
    const window = bookingWindow(NOON_FIELD);
    expect(window).toHaveLength(BOOKING_WINDOW_DAYS);
    expect(BOOKING_WINDOW_DAYS).toBe(92);
    expect(window[0]).toBe("2026-08-09");
    expect(window[91]).toBe("2026-11-08");
  });

  it("crosses several month boundaries without repeating or skipping a date", () => {
    const window = bookingWindow(new Date("2026-08-25T04:00:00Z"));
    expect(window[0]).toBe("2026-08-25");
    // Aug (6 days left) + Sep (30) + Oct (31) + 24 days into Nov = 91 days out.
    expect(window[91]).toBe("2026-11-24");
    expect(new Set(window).size).toBe(BOOKING_WINDOW_DAYS);
  });
});

describe("isBookingDateString", () => {
  it("rejects a well-formed string that is not a real date", () => {
    expect(isBookingDateString("2026-02-31")).toBe(false);
    expect(isBookingDateString("2026-13-01")).toBe(false);
  });

  it("rejects anything that is not YYYY-MM-DD", () => {
    expect(isBookingDateString("9-8-2026")).toBe(false);
    expect(isBookingDateString("2026-8-9")).toBe(false);
    expect(isBookingDateString("")).toBe(false);
  });

  it("accepts a leap day that exists", () => {
    expect(isBookingDateString("2028-02-29")).toBe(true);
    expect(isBookingDateString("2027-02-29")).toBe(false);
  });
});

describe("isWithinBookingWindow", () => {
  it("includes both ends and excludes the days either side", () => {
    expect(isWithinBookingWindow("2026-08-08", NOON_FIELD)).toBe(false);
    expect(isWithinBookingWindow("2026-08-09", NOON_FIELD)).toBe(true);
    expect(isWithinBookingWindow("2026-11-08", NOON_FIELD)).toBe(true);
    expect(isWithinBookingWindow("2026-11-09", NOON_FIELD)).toBe(false);
  });

  it("rejects a malformed date rather than throwing", () => {
    expect(isWithinBookingWindow("2026-02-31", NOON_FIELD)).toBe(false);
  });
});

describe("isPastSlot", () => {
  it("treats EVERY slot of a past date as past", () => {
    // The regression this project already shipped once. An hour-only check
    // leaves yesterday bookable, because at 12:00 today none of yesterday's
    // start hours look elapsed.
    expect(isPastSlot("2026-08-08", "06.00 - 07.00", NOON_FIELD)).toBe(true);
    expect(isPastSlot("2026-08-08", "23.00 - 24.00", NOON_FIELD)).toBe(true);
    expect(isPastSlot("2020-01-01", "23.00 - 24.00", NOON_FIELD)).toBe(true);
  });

  it("treats no slot of a future date as past", () => {
    expect(isPastSlot("2026-08-10", "06.00 - 07.00", NOON_FIELD)).toBe(false);
  });

  it("splits today at the current hour, counting a slot in progress as past", () => {
    // 12:30 WITA: 11.00-12.00 is over, 12.00-13.00 is underway.
    const halfPastNoon = new Date("2026-08-09T04:30:00Z");
    expect(isPastSlot("2026-08-09", "08.00 - 09.00", halfPastNoon)).toBe(true);
    expect(isPastSlot("2026-08-09", "11.00 - 12.00", halfPastNoon)).toBe(true);
    expect(isPastSlot("2026-08-09", "12.00 - 13.00", halfPastNoon)).toBe(true);
    expect(isPastSlot("2026-08-09", "13.00 - 14.00", halfPastNoon)).toBe(false);
  });

  it("closes a slot the moment its start hour arrives, not after it ends", () => {
    // Found by this test failing on a wrong first assumption. At exactly 12:00
    // the 12.00 slot is starting NOW — offering it would sell a session the
    // team cannot arrive for. The boundary is deliberately inclusive.
    expect(isPastSlot("2026-08-09", "12.00 - 13.00", NOON_FIELD)).toBe(true);
    expect(isPastSlot("2026-08-09", "13.00 - 14.00", NOON_FIELD)).toBe(false);
  });

  it("rolls over at field midnight (WITA), not UTC or Jakarta midnight", () => {
    // 16:30Z: still the 9th in UTC AND in Jakarta, but 00:30 on the 10th in
    // WITA — so the 9th is fully past and the 10th is today, nothing elapsed.
    expect(isPastSlot("2026-08-09", "23.00 - 24.00", LATE_EVENING)).toBe(true);
    expect(isPastSlot("2026-08-10", "06.00 - 07.00", LATE_EVENING)).toBe(false);
  });
});
