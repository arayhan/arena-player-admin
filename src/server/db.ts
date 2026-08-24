import "server-only";

import postgres from "postgres";

/**
 * postgres.js parses DATE (oid 1082) and TIMESTAMPTZ (oid 1184) into JS `Date`
 * objects by default. On an Asia/Jakarta (UTC+7) machine that silently shifts
 * `booking_date` back one day the moment it is serialized:
 *
 *   '2026-08-01'  ->  Date object  ->  JSON.stringify  ->  '2026-07-31T17:00:00.000Z'
 *
 * TypeScript cannot catch this — driver rows are cast, not validated. Both
 * OIDs are overridden here to pass the raw string straight through. The trap
 * is the driver's, not the provider's: it behaved identically under the
 * previous driver and survives the move to Supabase unchanged.
 *
 * `from` lists exactly the two OIDs and no others. Widening it is the failure
 * mode to watch for — adding int4 (23) here would turn every count and id in
 * the app into a string with nothing throwing.
 *
 * Belt and braces: every query in docs/architecture.md ALSO casts `::text` on
 * both date columns, so if this override is ever "simplified" away, the
 * queries still return strings. Do not remove either half.
 *
 * Verified with no credentials in db.test.ts.
 */
const DATE_OID = 1082;
const TIMESTAMPTZ_OID = 1184;

export const customTypes = {
  date: {
    to: TIMESTAMPTZ_OID,
    from: [DATE_OID, TIMESTAMPTZ_OID],
    serialize: (value: string) => value,
    parse: (value: string) => value,
  },
};

/**
 * Detects transient connection drop errors from Supabase transaction pooler
 * (Supavisor/PgBouncer at port 6543) or network socket resets.
 */
export function isTransientConnectionError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  return (
    message.includes("CONNECTION_CLOSED") ||
    message.includes("Connection closed") ||
    message.includes("ECONNRESET") ||
    message.includes("socket hang up") ||
    message.includes("write EPIPE") ||
    message.includes("broken pipe") ||
    message.includes("Connection terminated unexpectedly") ||
    code === "CONNECTION_CLOSED" ||
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "57P01" ||
    code === "08006" ||
    code === "08003" ||
    code === "08001"
  );
}

/**
 * `DATABASE_URL` must be Supabase's TRANSACTION POOLER string — port 6543,
 * host `…pooler.supabase.com`. The direct connection exhausts connections fast
 * under concurrent serverless invocations, and the expiry cron and a page load
 * can overlap.
 *
 * The pooler is also why `prepare: false` below is mandatory rather than a
 * tuning choice: pgbouncer in transaction mode hands a different backend
 * connection to each statement, so a prepared statement created on one is not
 * there for the next. See docs/database.md.
 */
function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.local.example to .env.local and fill in Supabase's transaction pooler connection string (docs/database.md).",
    );
  }
  return url;
}

let client: postgres.Sql | undefined;

export function resetClient(): void {
  if (client) {
    try {
      client.end({ timeout: 0 }).catch(() => {});
    } catch {
      // ignore
    }
    client = undefined;
  }
}

/**
 * Lazily constructs the client on first real use. Deliberately NOT built
 * eagerly at module scope: this file (and `customTypes` specifically) must
 * import cleanly with no credentials at all, so `check:unit` — which asserts
 * the OID override with no `.env.local` present — never fails for a reason
 * unrelated to the parser it is testing. The DATABASE_URL check therefore
 * happens at first query, not at import time.
 */
function getClient(): postgres.Sql {
  if (!client) {
    client = postgres(requireDatabaseUrl(), {
      prepare: false,
      types: customTypes,
      max: 10,
      idle_timeout: 20, // Closes idle connections in 20s before Supabase pooler drops them (30s)
      connect_timeout: 10,
      max_lifetime: 60 * 30, // Recycles connections after 30 minutes
      ssl: "require",
      fetch_types: false, // Prevents unsupported type queries on transaction pooler
    });
  }
  return client;
}

async function executeWithRetry<T>(fn: (c: postgres.Sql) => unknown): Promise<T> {
  try {
    const c = getClient();
    return (await fn(c)) as T;
  } catch (error: unknown) {
    if (isTransientConnectionError(error)) {
      console.warn(
        `[db] Transient connection error (${error instanceof Error ? error.message : String(error)}). Resetting pooler client and retrying query...`,
      );
      resetClient();
      const freshClient = getClient();
      return (await fn(freshClient)) as T;
    }
    throw error;
  }
}

/**
 * The Supabase Postgres client, usable as a tagged template exactly like the
 * value `postgres()` returns directly: `` sql`select 1` ``. This app writes
 * `bookings.status` under a guard; it never runs DDL (CLAUDE.md hard rule 1)
 * and never inserts or deletes `bookings` rows (docs/database.md).
 */
export const sql = new Proxy(function sql() {} as unknown as postgres.Sql, {
  apply(_target, _thisArg, args) {
    return executeWithRetry((c) =>
      Reflect.apply(c as unknown as (...a: unknown[]) => unknown, undefined, args),
    );
  },
  get(_target, prop, receiver) {
    if (prop === "unsafe") {
      return (...args: unknown[]) =>
        executeWithRetry((c) =>
          Reflect.apply(c.unsafe as unknown as (...a: unknown[]) => unknown, undefined, args),
        );
    }
    return Reflect.get(getClient() as object, prop, receiver);
  },
}) as postgres.Sql;

export default sql;
