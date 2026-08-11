import { describe, expect, it } from "vitest";

import {
  BOOKING_WINDOW_DAYS,
  bookingWindow,
  isBookingDateString,
  isPastSlot,
  isWithinBookingWindow,
  todayInJakarta,
} from "./dates";

// Fixed instants, never the wall clock. vitest.config.ts pins TZ=UTC so these
// assertions fail on a machine whose helpers forgot the Jakarta context —
// without the pin they pass on any UTC+7 machine regardless.
const NOON_JAKARTA = new Date("2026-08-09T05:00:00Z"); // 12:00 on the 9th
const LATE_EVENING = new Date("2026-08-09T18:30:00Z"); // 01:30 on the 10th

describe("todayInJakarta", () => {
  it("returns the Jakarta date, not the UTC one", () => {
    // The decisive case: UTC says the 9th, Jakarta says the 10th. A helper
    // missing { in: JAKARTA } returns 2026-08-09 here.
    expect(todayInJakarta(LATE_EVENING)).toBe("2026-08-10");
    expect(todayInJakarta(NOON_JAKARTA)).toBe("2026-08-09");
  });

  it("does not go through toISOString, which would shift the date back", () => {
    expect(LATE_EVENING.toISOString().slice(0, 10)).toBe("2026-08-09");
    expect(todayInJakarta(LATE_EVENING)).not.toBe("2026-08-09");
  });
});

describe("bookingWindow", () => {
  it("is today plus the next 13 days, earliest first", () => {
    const window = bookingWindow(NOON_JAKARTA);
    expect(window).toHaveLength(BOOKING_WINDOW_DAYS);
    expect(window[0]).toBe("2026-08-09");
    expect(window[13]).toBe("2026-08-22");
  });

  it("crosses a month boundary without repeating or skipping a date", () => {
    const window = bookingWindow(new Date("2026-08-25T05:00:00Z"));
    expect(window[0]).toBe("2026-08-25");
    expect(window[13]).toBe("2026-09-07");
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
    expect(isWithinBookingWindow("2026-08-08", NOON_JAKARTA)).toBe(false);
    expect(isWithinBookingWindow("2026-08-09", NOON_JAKARTA)).toBe(true);
    expect(isWithinBookingWindow("2026-08-22", NOON_JAKARTA)).toBe(true);
    expect(isWithinBookingWindow("2026-08-23", NOON_JAKARTA)).toBe(false);
  });

  it("rejects a malformed date rather than throwing", () => {
    expect(isWithinBookingWindow("2026-02-31", NOON_JAKARTA)).toBe(false);
  });
});

describe("isPastSlot", () => {
  it("treats EVERY slot of a past date as past", () => {
    // The regression this project already shipped once. An hour-only check
    // leaves yesterday bookable, because at 12:00 today none of yesterday's
    // start hours look elapsed.
    expect(isPastSlot("2026-08-08", "06.00 - 08.00", NOON_JAKARTA)).toBe(true);
    expect(isPastSlot("2026-08-08", "22.00 - 24.00", NOON_JAKARTA)).toBe(true);
    expect(isPastSlot("2020-01-01", "22.00 - 24.00", NOON_JAKARTA)).toBe(true);
  });

  it("treats no slot of a future date as past", () => {
    expect(isPastSlot("2026-08-10", "06.00 - 08.00", NOON_JAKARTA)).toBe(false);
  });

  it("splits today at the current hour, counting a slot in progress as past", () => {
    // 12:30 in Jakarta: 10.00-12.00 is over, 12.00-14.00 is underway.
    const halfPastNoon = new Date("2026-08-09T05:30:00Z");
    expect(isPastSlot("2026-08-09", "08.00 - 10.00", halfPastNoon)).toBe(true);
    expect(isPastSlot("2026-08-09", "10.00 - 12.00", halfPastNoon)).toBe(true);
    expect(isPastSlot("2026-08-09", "12.00 - 14.00", halfPastNoon)).toBe(true);
    expect(isPastSlot("2026-08-09", "14.00 - 16.00", halfPastNoon)).toBe(false);
  });

  it("closes a slot the moment its start hour arrives, not after it ends", () => {
    // Found by this test failing on a wrong first assumption. At exactly 12:00
    // the 12.00 slot is starting NOW — offering it would sell a session the
    // team cannot arrive for. The boundary is deliberately inclusive.
    expect(isPastSlot("2026-08-09", "12.00 - 14.00", NOON_JAKARTA)).toBe(true);
    expect(isPastSlot("2026-08-09", "14.00 - 16.00", NOON_JAKARTA)).toBe(false);
  });

  it("rolls over at Jakarta midnight, not UTC midnight", () => {
    // 18:30Z is still the 9th in UTC but 01:30 on the 10th in Jakarta, so the
    // 9th is now fully past and the 10th is today with one slot elapsed.
    expect(isPastSlot("2026-08-09", "22.00 - 24.00", LATE_EVENING)).toBe(true);
    expect(isPastSlot("2026-08-10", "06.00 - 08.00", LATE_EVENING)).toBe(false);
  });
});
