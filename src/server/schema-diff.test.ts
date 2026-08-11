import { describe, expect, it } from "vitest";

import { TIME_SLOTS } from "@/domain/slots";
import { BOOKING_STATUSES } from "@/domain/status";

import { diffSets, extractLiterals, extractMaxLength } from "./schema-diff";

/**
 * Real `pg_get_constraintdef` pretty-prints `x in (...)` as
 * `x = ANY (ARRAY['a'::text, 'b'::text, ...])`. Built from TIME_SLOTS
 * itself, so this fixture stays honest about what the literals actually are
 * — the test is about the FORMAT and the comparison logic, not a second
 * hand-typed copy of the nine strings.
 */
function timeSlotConstraintDef(slots: readonly string[]): string {
  const arrayLiterals = slots.map((slot) => `'${slot}'::text`).join(", ");
  return `CHECK ((time_slot = ANY (ARRAY[${arrayLiterals}])))`;
}

describe("extractLiterals", () => {
  it("reads the nine slot literals out of a realistic constraint definition", () => {
    const definition = timeSlotConstraintDef(TIME_SLOTS);
    expect(extractLiterals(definition)).toEqual([...TIME_SLOTS]);
  });

  it("reads the four status literals out of a status_valid-shaped definition", () => {
    const definition = `CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text, 'expired'::text])))`;
    expect(extractLiterals(definition)).toEqual([...BOOKING_STATUSES]);
  });
});

describe("extractMaxLength", () => {
  it("reads the bound out of a notes_length-shaped definition", () => {
    const definition = "CHECK (((notes IS NULL) OR (length(notes) <= 500)))";
    expect(extractMaxLength(definition)).toBe(500);
  });

  it("returns null when there is no bound to read", () => {
    expect(extractMaxLength("CHECK ((status IS NOT NULL))")).toBeNull();
  });
});

describe("diffSets — this is the assertion check:schema exists for", () => {
  it("reports equal when the live literals match the source exactly", () => {
    const definition = timeSlotConstraintDef(TIME_SLOTS);
    const diff = diffSets(extractLiterals(definition), TIME_SLOTS);
    expect(diff).toEqual({ missing: [], extra: [], equal: true });
  });

  /**
   * PLANTED VIOLATION, run in-process rather than against a live database
   * (none is reachable in this environment — see PROGRESS.md). Mirrors the
   * exact drift the step file's own acceptance script plants with `sed`:
   * '22.00 - 24.00' -> '22.00 - 23.59'. This proves the comparison itself
   * — the part `check:schema` delegates to `diffSets` — actually catches a
   * one-character slot drift, which is the entire reason this check exists.
   */
  it("catches a one-character slot-string drift, in both directions", () => {
    const driftedSlots = TIME_SLOTS.map((slot) =>
      slot === "22.00 - 24.00" ? "22.00 - 23.59" : slot,
    );
    const definition = timeSlotConstraintDef(driftedSlots);

    const diff = diffSets(extractLiterals(definition), TIME_SLOTS);

    expect(diff.equal).toBe(false);
    expect(diff.missing).toEqual(["22.00 - 24.00"]);
    expect(diff.extra).toEqual(["22.00 - 23.59"]);
  });

  it("catches a missing status value (subset drift)", () => {
    const definition = `CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text])))`;
    const diff = diffSets(extractLiterals(definition), BOOKING_STATUSES);

    expect(diff.equal).toBe(false);
    expect(diff.missing).toEqual(["expired"]);
    expect(diff.extra).toEqual([]);
  });
});
