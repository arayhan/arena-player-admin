/**
 * The eighteen bookable time slots, in canonical order and canonical string
 * form — ONE HOUR EACH, 06.00 through 24.00. Nine 2-hour slots became eighteen
 * 1-hour slots on 2026-08-15, so a visitor can book a single hour instead of
 * being forced into a 2-hour block; every slot string changed, and every row
 * already sold under the old strings does not match a new one (see
 * db/migrations/ for the constraint that replaced the 2-hour list).
 *
 * BYTE-IDENTICAL WITH arena-player-admin at this same path. `uniq_active_slot`
 * compares `time_slot` as TEXT, so '06.00 - 07.00' and '06.00-07.00' are two
 * different slots to Postgres. One character of drift between the repos means
 * the admin writes rows this site cannot match and anti-double-booking silently
 * stops working for both. `pnpm check:domain` guards the copy; the
 * `time_slot_canonical` constraint in db/migrations/ guards the format.
 *
 * No dependencies here, deliberately — importing TIME_SLOTS must not cost a
 * date library. See the shared-code contract in docs/architecture.md.
 */
export const TIME_SLOTS = [
  "06.00 - 07.00",
  "07.00 - 08.00",
  "08.00 - 09.00",
  "09.00 - 10.00",
  "10.00 - 11.00",
  "11.00 - 12.00",
  "12.00 - 13.00",
  "13.00 - 14.00",
  "14.00 - 15.00",
  "15.00 - 16.00",
  "16.00 - 17.00",
  "17.00 - 18.00",
  "18.00 - 19.00",
  "19.00 - 20.00",
  "20.00 - 21.00",
  "21.00 - 22.00",
  "22.00 - 23.00",
  "23.00 - 24.00",
] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number];

const SLOTS: ReadonlySet<string> = new Set(TIME_SLOTS);

export function isTimeSlot(value: string): value is TimeSlot {
  return SLOTS.has(value);
}

/**
 * Normalises a near-miss slot string, or returns null.
 *
 * Returning null rather than the input is the whole point: an unrecognised
 * slot must never reach the database. A tolerant "clean it up and pass it on"
 * version would let '07.00 - 09.00' through as a real slot nobody sells.
 */
export function canonicalSlot(input: string): TimeSlot | null {
  const parts = input.trim().match(/^(\d{1,2})\.(\d{2})\s*-\s*(\d{1,2})\.(\d{2})$/);
  if (!parts) return null;

  const [, startHour, startMinute, endHour, endMinute] = parts;
  const candidate =
    `${startHour.padStart(2, "0")}.${startMinute}` +
    ` - ` +
    `${endHour.padStart(2, "0")}.${endMinute}`;

  return isTimeSlot(candidate) ? candidate : null;
}

/** 6 for '06.00 - 07.00'. Used to derive elapsed slots. */
export function slotStartHour(slot: TimeSlot): number {
  return Number(slot.slice(0, 2));
}
