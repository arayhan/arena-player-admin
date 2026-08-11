import "server-only";

import {
  neon,
  types,
  type CustomTypesConfig,
  type NeonQueryFunction,
} from "@neondatabase/serverless";

/**
 * Neon's default pg-types parsers return JS `Date` objects for DATE (oid 1082)
 * and TIMESTAMPTZ (oid 1184). On an Asia/Jakarta (UTC+7) machine that silently
 * shifts `booking_date` back one day the moment it is serialized:
 *
 *   '2026-08-01'  ->  Date object  ->  JSON.stringify  ->  '2026-07-31T17:00:00.000Z'
 *
 * TypeScript cannot catch this — driver rows are cast, not validated. Both
 * OIDs are overridden here to pass the raw string straight through.
 *
 * Belt and braces: every query in docs/architecture.md ALSO casts `::text` on
 * both date columns, so if this override is ever "simplified" away, the
 * queries still return strings. Do not remove either half.
 *
 * Verified with no credentials in db.test.ts:
 *   types.getTypeParser(1082)('2026-08-01') === '2026-08-01' (a string, not a Date)
 */
const DATE_OID = 1082;
const TIMESTAMPTZ_OID = 1184;

export const customTypes: CustomTypesConfig = {
  getTypeParser: (id, format) => {
    if (id === DATE_OID || id === TIMESTAMPTZ_OID) {
      return (value: string) => value;
    }
    return types.getTypeParser(id, format);
  },
};

/**
 * `DATABASE_URL` must be the POOLED connection string — the host contains
 * `-pooler`. The direct string exhausts connections fast under concurrent
 * serverless invocations, and the expiry cron and a page load can overlap.
 * See docs/database.md.
 */
function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.local.example to .env.local and fill in the pooled Neon connection string (docs/database.md).",
    );
  }
  return url;
}

let client: NeonQueryFunction<false, false> | undefined;

/**
 * Lazily constructs the Neon client on first real use. Deliberately NOT built
 * eagerly at module scope: this file (and `customTypes` specifically) must
 * import cleanly with no credentials at all, so `check:unit` — which asserts
 * the OID override with no `.env.local` present — never fails for a reason
 * unrelated to the parser it is testing. The DATABASE_URL check therefore
 * happens at first query, not at import time.
 */
function getClient(): NeonQueryFunction<false, false> {
  if (!client) {
    client = neon(requireDatabaseUrl(), { types: customTypes });
  }
  return client;
}

/**
 * The Neon serverless SQL client, usable as a tagged template exactly like
 * the value `neon()` returns directly: `` sql`select 1` ``. This app writes
 * `bookings.status` under a guard; it never runs DDL (CLAUDE.md hard rule 1)
 * and never inserts or deletes `bookings` rows (docs/database.md).
 */
export const sql = new Proxy(function sql() {} as unknown as NeonQueryFunction<false, false>, {
  apply(_target, _thisArg, args) {
    return Reflect.apply(getClient() as unknown as (...a: unknown[]) => unknown, undefined, args);
  },
  get(_target, prop, receiver) {
    return Reflect.get(getClient() as object, prop, receiver);
  },
}) as NeonQueryFunction<false, false>;
