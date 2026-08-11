/**
 * Pure comparison logic for `pnpm check:schema`, split out of
 * `scripts/check-schema.test.ts` specifically so it can be proven correct
 * with NO database connection. `check:schema` itself needs live Neon
 * credentials to fetch the actual `pg_get_constraintdef` text; this file is
 * what happens to that text once fetched, and it is exactly the part that
 * decides whether a slot-string drift is caught. See db.test.ts for the
 * same "credential-free proof" pattern applied to the Neon OID override.
 *
 * No `import "server-only"` here on purpose — this module touches no
 * secret, opens no connection, and its whole reason to exist is to be
 * importable from a plain, credential-free test.
 */

/** Literals inside a Postgres-pretty-printed `= ANY (ARRAY['a'::text, ...])` CHECK clause. */
export function extractLiterals(constraintDefinition: string): string[] {
  return [...constraintDefinition.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((match) => match[1]);
}

/** The numeric bound in a `length(...) <= N` CHECK clause. */
export function extractMaxLength(constraintDefinition: string): number | null {
  const match = constraintDefinition.match(/<=\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

export interface SetDiff {
  /** In `expected` (the source, e.g. TIME_SLOTS) but not in `actual` (the database). */
  missing: string[];
  /** In `actual` but not in `expected` — the database has drifted or gained an extra value. */
  extra: string[];
  /** True iff neither array has to be shown to a human. */
  equal: boolean;
}

/**
 * Set-equality, not subset and not length comparison — either direction of
 * drift must be visible. This is the function `check:schema` calls to
 * decide whether `time_slot_canonical`'s live literals still match
 * `TIME_SLOTS` from `src/domain/slots.ts`.
 */
export function diffSets(actual: readonly string[], expected: readonly string[]): SetDiff {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((value) => !actualSet.has(value));
  const extra = actual.filter((value) => !expectedSet.has(value));
  return { missing, extra, equal: missing.length === 0 && extra.length === 0 };
}
