/**
 * Indonesian mobile number normalisation.
 *
 * BYTE-IDENTICAL WITH arena-player-admin at this same path, and no
 * dependencies. This site stores the number; the admin searches for it. Two
 * implementations means one person looks like two rows — 081234567890 saved
 * here and 6281234567890 typed there find nothing.
 *
 * `bookings.phone` is always the normalised 628xxxxxxxxx form, never as-typed.
 */

/** 62 + 8 + 8-11 more digits, covering every current Indonesian mobile range. */
const NATIONAL = /^8\d{8,11}$/;

/**
 * `08xx`, `62xx`, `+62xx` or `(0)8xx` as typed, with spaces, dots and hyphens
 * anywhere, to `628xxxxxxxxx`. Returns null on anything that is not an
 * Indonesian mobile number — a landline, a truncated number, another country.
 */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[\s.\-()]/g, "");
  if (!/^\+?\d+$/.test(digits)) return null;

  const bare = digits.startsWith("+") ? digits.slice(1) : digits;

  let national: string;
  if (bare.startsWith("62")) national = bare.slice(2);
  else if (bare.startsWith("0")) national = bare.slice(1);
  else return null;

  return NATIONAL.test(national) ? `62${national}` : null;
}

export function isValidIndonesianMobile(input: string): boolean {
  return normalisePhone(input) !== null;
}
