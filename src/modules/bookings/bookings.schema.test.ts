import { describe, expect, it } from "vitest";

import { parseBookingsFilter } from "./bookings.schema";
import { todayAtField } from "@/domain/dates";

describe("parseBookingsFilter", () => {
  it("returns default values on undefined input", () => {
    const filter = parseBookingsFilter(undefined);
    expect(filter.status).toEqual(["pending"]);
    expect(filter.from).toEqual(todayAtField());
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

  it("falls back to ['pending'] on invalid status", () => {
    const filter = parseBookingsFilter({ status: "invalid_status" });
    expect(filter.status).toEqual(["pending"]);
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
    expect(filter.from).toEqual(todayAtField());
    expect(filter.page).toBe(1);
    expect(filter.sort).toBe("when");
    expect(filter.dir).toBe("asc");
  });
});
