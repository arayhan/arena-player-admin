import { describe, expect, it } from "vitest";

import { isValidIndonesianMobile, normalisePhone } from "./phone";

describe("normalisePhone", () => {
  it("normalises every spelling of one number to the same string", () => {
    // The whole reason this is shared: the site stores it, the admin searches
    // for it. Any two of these landing on different strings means one person
    // becomes two rows.
    const spellings = [
      "081234567890",
      "0812-3456-7890",
      "0812 3456 7890",
      "+6281234567890",
      "6281234567890",
      "+62 812-3456-7890",
      "(0)81234567890",
    ];
    for (const spelling of spellings) {
      expect(normalisePhone(spelling)).toBe("6281234567890");
    }
  });

  it("accepts both ends of the 9-12 digit national range and nothing outside it", () => {
    // The national significant number is 8 followed by 8-11 more digits.
    // Boundary corrected after this test failed on a wrong first assumption:
    // 08123456789012 is a 13-digit national number and is NOT a real one.
    expect(normalisePhone("0812345678")).toBe("62812345678"); // 9, shortest
    expect(normalisePhone("0812345678901")).toBe("62812345678901"); // 12, longest
    expect(normalisePhone("081234567")).toBeNull(); // 8, one short
    expect(normalisePhone("08123456789012")).toBeNull(); // 13, one long
  });

  it("rejects what is not an Indonesian mobile", () => {
    expect(normalisePhone("0211234567")).toBeNull(); // Jakarta landline, area code 21
    expect(normalisePhone("0812345")).toBeNull(); // too short
    expect(normalisePhone("+14155552671")).toBeNull(); // not +62
    expect(normalisePhone("81234567890")).toBeNull(); // no 0 and no 62 prefix
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone("tidak ada")).toBeNull();
    expect(normalisePhone("0812-3456-78ab")).toBeNull();
  });

  it("does not mistake a 62-prefixed landline for a mobile", () => {
    expect(normalisePhone("+62211234567")).toBeNull();
  });
});

describe("isValidIndonesianMobile", () => {
  it("agrees with normalisePhone on every input", () => {
    for (const input of ["081234567890", "0211234567", "", "+6281234567890"]) {
      expect(isValidIndonesianMobile(input)).toBe(normalisePhone(input) !== null);
    }
  });
});
