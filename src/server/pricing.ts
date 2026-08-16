import "server-only";

import { tz } from "@date-fns/tz";
import { getDay, parse } from "date-fns";

import type { TimeSlot } from "@/domain/slots";
import type { RateCardRow } from "@/server/queries";

/**
 * ADMIN-ONLY, DELIBERATELY OUTSIDE src/domain/. `docs/schema-requests/003-site-settings.md`
 * originally asked for this to live in `src/domain/pricing.ts`, authored in
 * `arena-player-web`. `check:domain` diffs `src/domain/` in BOTH directions
 * (scripts/check-domain.mjs) — a file that exists here and not there fails
 * the check outright, and web has no consumer for a price today
 * (`rateCard()` still returns `[]`). A byte-identical shared module with
 * nothing on the other side to use it is the overhead 003 itself already
 * argued against paying early for the rate card table. Promote this file's
 * two functions into `src/domain/pricing.ts`, authored in web first, the day
 * web actually quotes a rupiah figure — not before.
 *
 * A second, standalone `Asia/Makassar` instance rather than importing
 * `src/domain/dates.ts`'s `FIELD_TZ`: that constant is not exported, and
 * exporting it would itself be a `src/domain/` edit subject to the same
 * byte-identical contract this file is deliberately outside of.
 */
const FIELD_TZ = tz("Asia/Makassar");

export type DayType = "weekday" | "weekend";

/**
 * Saturday/Sunday, or any date in `holidayDates`. The client's pricelist
 * prices Sabtu–Minggu and public holidays identically — one tier, not a
 * three-value enum — so a holiday just widens which dates get the weekend
 * price rather than needing its own price column.
 */
export function resolveDayType(date: string, holidayDates: ReadonlySet<string>): DayType {
  if (holidayDates.has(date)) return "weekend";
  // Parsed rather than passed as a raw string, matching src/domain/dates.ts's
  // own pattern for the same reason: a plain `new Date(date)` parses as UTC
  // midnight, which can land on the wrong calendar day once shifted into
  // Asia/Makassar (UTC+8).
  const parsed = parse(date, "yyyy-MM-dd", new Date(0), { in: FIELD_TZ });
  const day = getDay(parsed, { in: FIELD_TZ }); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6 ? "weekend" : "weekday";
}

/**
 * `price × percent ÷ 100`, round-half-up to the nearest rupiah.
 *
 * Every price in the client's pricelist divides evenly at the current
 * `dp_percent` (50), so this rounding rule has no visible effect today — it
 * only bites if `dp_percent` changes or a future price isn't round, which is
 * exactly why the rule needed to be decided now (docs/schema-requests/003-
 * site-settings.md, "RESOLVED 2026-08-17 — rounding") rather than discovered
 * later by a customer doing the math themselves.
 */
export function dpAmount(priceRupiah: number, dpPercent: number): number {
  return Math.round((priceRupiah * dpPercent) / 100);
}

/**
 * `null` means unpriced, not free — mirrors arena-player-web's
 * `booking-form.money.ts` treating a missing rate as "cannot quote yet",
 * never as a zero-rupiah offer.
 */
export function priceForSlot(
  rateCard: readonly RateCardRow[],
  date: string,
  slot: TimeSlot,
  holidayDates: ReadonlySet<string>,
): number | null {
  const dayType = resolveDayType(date, holidayDates);
  const row = rateCard.find((r) => r.time_slot === slot && r.day_type === dayType);
  return row ? row.price_rupiah : null;
}
