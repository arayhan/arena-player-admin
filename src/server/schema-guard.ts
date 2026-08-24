/**
 * The runtime half of "this repo may not run DDL". `check:schema` proves at
 * dev/CI time that a migration landed correctly; this file is what a
 * request handler asks at request time to find out whether it landed AT
 * ALL, so a missing Phase 4 table degrades that one feature instead of
 * throwing an unhandled Postgres error into a 500.
 *
 * NEVER wrap the root layout in this. Phase 2 (the bookings console) needs
 * zero new migrations, and a missing `slot_blocks` table must not take it
 * down. Call this only from the specific feature that needs the table —
 * `/blocks` and its Server Actions — never from `src/app/layout.tsx`.
 * See docs/architecture.md, "The schema guard".
 */
import "server-only";

import { sql } from "./db";

/**
 * Positive cache only. Once a table is confirmed present, that answer is
 * cached for the process lifetime — a table does not disappear at runtime.
 * A `false` result is NEVER cached, so applying the migration in the Supabase
 * SQL editor takes effect on this app's very next request, with no redeploy.
 */
const knownPresent = new Set<string>();

/**
 * `select to_regclass('public.<table>')` returns the table's OID if it
 * exists, `null` otherwise — one round trip, no dependency on
 * `information_schema` privileges, and it never throws for a missing table
 * (unlike querying the table directly, which raises Postgres `42P01`).
 */
export async function tableExists(tableName: string): Promise<boolean> {
  if (knownPresent.has(tableName)) return true;

  try {
    const rows = (await sql`select to_regclass('public.' || ${tableName}) as reg`) as Array<{
      reg: string | null;
    }>;
    const present = rows[0]?.reg != null;

    if (present) knownPresent.add(tableName);
    return present;
  } catch (error) {
    console.error(`[schema-guard] tableExists("${tableName}") check failed:`, error);
    return false;
  }
}

export class MigrationMissingError extends Error {
  constructor(
    public readonly migration: string,
    public readonly table: string,
  ) {
    super(
      `Jalankan \`db/migrations/${migration}\` di Supabase SQL editor — tabel \`${table}\` tidak ditemukan.`,
    );
    this.name = "MigrationMissingError";
  }
}

/**
 * Throws `MigrationMissingError` if the given table is absent. Server
 * Components catch this to render the loud, file-naming error the page
 * needs; mutating routes catch it to return 503
 * `{"error":"migration_missing","migration":"<name>"}` — never a bare 500,
 * and never a caught-and-return-empty that would render "no blocks" for "no
 * table".
 */
export async function assertTableExists(tableName: string, migration: string): Promise<void> {
  const present = await tableExists(tableName);
  if (!present) {
    throw new MigrationMissingError(migration, tableName);
  }
}

/**
 * A Postgres `undefined_table` (42P01) escaping from anywhere becomes true
 * here — used by mutating routes as a last-resort net alongside the
 * up-front `assertTableExists` call, in case the table was dropped between
 * the check and the query in a race no single request can prevent.
 */
export function isUndefinedTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "42P01"
  );
}
