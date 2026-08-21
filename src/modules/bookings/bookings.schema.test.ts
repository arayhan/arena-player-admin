import { describe, expect, it } from "vitest";

import { parseBookingsFilter } from "./bookings.schema";

describe("parseBookingsFilter", () => {
  it("returns default values on undefined input", () => {
    const filter = parseBookingsFilter(undefined);
    expect(filter.status).toEqual(["pending", "confirmed", "rejected", "expired"]);
    expect(filter.from).toBeNull();
    expect(filter.to).toBeNull();
    expect(filter.q).toBeNull();
    expect(filter.sort).toBe("when");
    expect(filter.dir).toBe("asc");
    expect(filter.page).toBe(1);
  });

  it("handles valid status arrays and strings", () => {
    const filter1 = parseBookingsFilter({ status: "confirmed" });
    expect(filter1.status).toEqual(["confirmed"]);

    const filter2 = parseBookingsFilter({ status: ["pending", "confirmed"] });
    expect(filter2.status).toEqual(["pending", "confirmed"]);
  });

  it("handles 'all' status by setting status to all statuses", () => {
    const filter = parseBookingsFilter({ status: "all" });
    expect(filter.status).toEqual(["pending", "confirmed", "rejected", "expired"]);
  });

  it("falls back to all statuses on invalid status", () => {
    const filter = parseBookingsFilter({ status: "invalid_status" });
    expect(filter.status).toEqual(["pending", "confirmed", "rejected", "expired"]);
  });

  it("handles 'all' dates by setting from to null", () => {
    const filter = parseBookingsFilter({ from: "all" });
    expect(filter.from).toBeNull();
  });

  it("falls back on invalid dates and page numbers without throwing", () => {
    const filter = parseBookingsFilter({
      from: "2026-02-31", // invalid date
      page: "-5",
      sort: "malicious_column; drop table users;",
      dir: "invalid_dir",
    });
    expect(filter.from).toBeNull();
    expect(filter.page).toBe(1);
    expect(filter.sort).toBe("when");
    expect(filter.dir).toBe("asc");
  });
});

describe("createBookingInputSchema", () => {
  it("accepts valid walk-in booking inputs with single slot", async () => {
    const { createBookingInputSchema } = await import("./bookings.schema");
    const result = createBookingInputSchema.safeParse({
      booking_date: "2026-08-20",
      time_slots: "19.00 - 20.00",
      team_name: "Garuda FC",
      phone: "08123456789",
      notes: "Bayar tunai di lapangan",
      status: "confirmed",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.time_slots).toEqual(["19.00 - 20.00"]);
    }
  });

  it("accepts valid walk-in booking inputs with multiple slots array", async () => {
    const { createBookingInputSchema } = await import("./bookings.schema");
    const result = createBookingInputSchema.safeParse({
      booking_date: "2026-08-20",
      time_slots: ["18.00 - 19.00", "19.00 - 20.00"],
      team_name: "Garuda FC",
      phone: "08123456789",
      status: "confirmed",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.time_slots).toEqual(["18.00 - 19.00", "19.00 - 20.00"]);
    }
  });

  it("rejects invalid date format", async () => {
    const { createBookingInputSchema } = await import("./bookings.schema");
    const result = createBookingInputSchema.safeParse({
      booking_date: "20-08-2026",
      time_slots: ["19.00 - 20.00"],
      team_name: "Garuda FC",
      phone: "08123456789",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateBookingInputSchema", () => {
  it("accepts valid update inputs with valid UUID", async () => {
    const { updateBookingInputSchema } = await import("./bookings.schema");
    const result = updateBookingInputSchema.safeParse({
      id: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
      team_name: "Garuda FC Baru",
      phone: "08123456789",
      notes: "Perubahan nama tim",
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed UUID", async () => {
    const { updateBookingInputSchema } = await import("./bookings.schema");
    const result = updateBookingInputSchema.safeParse({
      id: "not-a-uuid",
      team_name: "Garuda FC",
      phone: "08123456789",
    });
    expect(result.success).toBe(false);
  });
});
