/**
 * Asia/Jakarta date helpers and the booking window.
 *
 * BYTE-IDENTICAL WITH arena-player-admin at this same path. It is the ONLY
 * file under src/domain/ with dependencies, and that is a cost: the admin repo
 * is obliged to install date-fns and @date-fns/tz at a matching major, because
 * v3 and v4 differ in exactly the timezone API used below. Keep the other
 * three dependency-free so importing TIME_SLOTS never drags a date library.
 *
 * `toISOString()` IS BANNED anywhere near a booking date — it shifts to UTC and
 * can move the date across midnight. Nothing here constructs a TZDate either:
 * with the hoisted `{ in: JAKARTA }` context, plain Date objects flow through
 * and the method is simply never in reach. See docs/database.md.
 */
import { tz } from "@date-fns/tz";
import { addDays, format, isValid, parse } from "date-fns";

import { slotStartHour, type TimeSlot } from "./slots";

// Built once and reused, per the @date-fns/tz docs — not re-created per call.
const JAKARTA = tz("Asia/Jakarta");
const DATE_FORMAT = "yyyy-MM-dd";

/** Today plus the next 13 days. 14 dates inclusive. */
export const BOOKING_WINDOW_DAYS = 14;

export function todayInJakarta(now: Date = new Date()): string {
  return format(now, DATE_FORMAT, { in: JAKARTA });
}

/** Every bookable date, earliest first. */
export function bookingWindow(now: Date = new Date()): string[] {
  return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, offset) =>
    format(addDays(now, offset, { in: JAKARTA }), DATE_FORMAT, { in: JAKARTA }),
  );
}

/**
 * A real calendar date in `YYYY-MM-DD`. The regex alone would accept
 * 2026-02-31, so the parse has to round-trip.
 */
export function isBookingDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parse(value, DATE_FORMAT, new Date(0), { in: JAKARTA });
  return isValid(parsed) && format(parsed, DATE_FORMAT, { in: JAKARTA }) === value;
}

/**
 * Compared as strings on purpose: `YYYY-MM-DD` sorts lexicographically exactly
 * as it sorts chronologically, so this needs no second parse and cannot drift
 * a timezone between the two ends of the comparison.
 */
export function isWithinBookingWindow(date: string, now: Date = new Date()): boolean {
  if (!isBookingDateString(date)) return false;
  const window = bookingWindow(now);
  return date >= window[0] && date <= window[window.length - 1];
}

function currentHourInJakarta(now: Date): number {
  return Number(format(now, "H", { in: JAKARTA }));
}

/**
 * Elapsed, and therefore unbookable.
 *
 * THE DATE COMPARISON IS NOT OPTIONAL. A version that only checked the hour
 * shipped once and left yesterday bookable, because every one of yesterday's
 * slots looks unstarted the moment the clock rolls past midnight. Recorded in
 * docs/database.md as a regression not to repeat.
 */
export function isPastSlot(date: string, slot: TimeSlot, now: Date = new Date()): boolean {
  const today = todayInJakarta(now);
  if (date < today) return true;
  if (date > today) return false;
  return currentHourInJakarta(now) >= slotStartHour(slot);
}
