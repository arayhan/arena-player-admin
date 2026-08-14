import { describe, expect, it } from "vitest";

import { customTypes } from "./db";

/**
 * Credential-free. Asserts the one thing about the database client that has
 * no runtime error to announce it when it breaks: postgres.js parses DATE
 * (1082) and TIMESTAMPTZ (1184) into JS `Date` by default, and on an
 * Asia/Jakarta (UTC+7) machine that shifts `booking_date` back a day the
 * moment it is serialized. See the comment in db.ts.
 */
describe("db — the DATE/TIMESTAMPTZ override", () => {
  it("passes a DATE through as the raw string, never a Date object", () => {
    const parsed = customTypes.date.parse("2026-08-01");

    expect(parsed).toBe("2026-08-01");
    expect(parsed).not.toBeInstanceOf(Date);
  });

  it("passes a TIMESTAMPTZ through as the raw string", () => {
    const parsed = customTypes.date.parse("2026-08-01 09:30:00+07");

    expect(parsed).toBe("2026-08-01 09:30:00+07");
    expect(parsed).not.toBeInstanceOf(Date);
  });

  it("covers exactly oid 1082 and 1184", () => {
    expect([...customTypes.date.from]).toEqual([1082, 1184]);
  });

  /**
   * The override is scoped, not global. Widening `from` is the realistic
   * mistake — adding int4 (23) would turn every count and id in the app into
   * a string, and nothing would throw. This asserts the boundary rather than
   * the happy path.
   */
  it("does not claim any other oid", () => {
    expect(customTypes.date.from).not.toContain(23);
    expect(Object.keys(customTypes)).toEqual(["date"]);
  });
});
