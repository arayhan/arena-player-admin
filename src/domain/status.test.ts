import { describe, expect, it } from "vitest";

import {
  ACTIVE_STATUSES,
  BOOKING_STATUSES,
  SLOT_STATUSES,
  isActiveStatus,
  toSlotStatus,
} from "./status";

describe("vocabularies", () => {
  it("has four row states and three API states", () => {
    expect(BOOKING_STATUSES).toEqual(["pending", "confirmed", "rejected", "expired"]);
    expect(SLOT_STATUSES).toEqual(["available", "pending", "booked"]);
  });

  it("has no `past` state — elapsed is derived client-side", () => {
    // architecture.md keeps GET /api/availability FIRM at three states. A
    // fourth here would contradict the contract the MSW mock implements.
    expect(SLOT_STATUSES).not.toContain("past");
  });
});

describe("ACTIVE_STATUSES", () => {
  it("matches uniq_active_slot's WHERE clause exactly", () => {
    // WHERE status IN ('pending', 'confirmed'). If this drifts from the index,
    // the only anti-double-booking guard in the system changes meaning with
    // nothing thrown.
    expect(ACTIVE_STATUSES).toEqual(["pending", "confirmed"]);
  });

  it("treats every non-active row state as inactive", () => {
    expect(isActiveStatus("pending")).toBe(true);
    expect(isActiveStatus("confirmed")).toBe(true);
    expect(isActiveStatus("rejected")).toBe(false);
    expect(isActiveStatus("expired")).toBe(false);
  });
});

describe("toSlotStatus", () => {
  it("maps rejected and expired to AVAILABLE — the half that gets guessed wrong", () => {
    // Guessing `booked` here renders a full day that is actually empty, and
    // nothing errors.
    expect(toSlotStatus("rejected")).toBe("available");
    expect(toSlotStatus("expired")).toBe("available");
  });

  it("maps confirmed to booked and pending to pending", () => {
    expect(toSlotStatus("confirmed")).toBe("booked");
    expect(toSlotStatus("pending")).toBe("pending");
  });

  it("agrees with ACTIVE_STATUSES on every row state", () => {
    // The mapping and the index must not be able to disagree: a row state is
    // free to rebook exactly when it is not active.
    for (const status of BOOKING_STATUSES) {
      expect(toSlotStatus(status) === "available").toBe(!isActiveStatus(status));
    }
  });
});
