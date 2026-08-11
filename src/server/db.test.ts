import { describe, expect, it } from "vitest";

import { customTypes } from "./db";

/**
 * The trap this repo has already been bitten by once: Neon's default
 * DATE/TIMESTAMPTZ parsers return JS `Date` objects, which silently shift
 * `booking_date` back a day on an Asia/Jakarta machine. This test asserts the
 * override directly, with NO database connection and NO credentials — it
 * must keep passing even with `.env.local` moved away, per `check:unit`'s
 * own contract (docs/architecture.md).
 */
describe("customTypes OID override", () => {
  it("passes DATE (oid 1082) through as a string, not a Date", () => {
    const parse = customTypes.getTypeParser(1082);
    const result = parse("2026-08-01");

    expect(result).toBe("2026-08-01");
    expect(typeof result).toBe("string");
    expect(result).not.toBeInstanceOf(Date);
  });

  it("passes TIMESTAMPTZ (oid 1184) through as a string, not a Date", () => {
    const parse = customTypes.getTypeParser(1184);
    const result = parse("2026-08-01 10:00:00+00");

    expect(result).toBe("2026-08-01 10:00:00+00");
    expect(typeof result).toBe("string");
    expect(result).not.toBeInstanceOf(Date);
  });

  it("still delegates every other OID to the default pg-types parser", () => {
    // oid 23 is int4 — must NOT be overridden, or every integer column breaks.
    const parse = customTypes.getTypeParser(23);
    expect(parse("42")).toBe(42);
  });
});
