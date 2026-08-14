/**
 * `pnpm check:schema` — the check neither repo had before this file: nothing
 * guards source against the DATABASE. Runs against LIVE Supabase Postgres, credentials
 * required (`DATABASE_URL` in `.env.local`).
 *
 * Reads `REQUIRED_TABLES` from `src/server/required-schema.ts` and asserts,
 * per table: the columns exist with the right types
 * (`information_schema.columns`), each index exists with the right
 * uniqueness and partial predicate (`pg_indexes`), and each CHECK
 * constraint's literals — read out of `pg_get_constraintdef`, the live
 * database, not a source file — are set-equal to the expected list. That
 * last assertion is the one this file exists for: `check:domain` guards
 * source against source; this guards source against the database, which is
 * the only thing that proves a migration was actually run and run unedited.
 * See docs/architecture.md, "Web owns db/migrations/".
 */
import { beforeAll, describe, expect, it } from "vitest";

import { sql } from "@/server/db";
import { REQUIRED_TABLES, type RequiredTable } from "@/server/required-schema";
import { diffSets, extractLiterals, extractMaxLength } from "@/server/schema-diff";

interface ColumnRow {
  column_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
}

interface IndexRow {
  indexname: string;
  indexdef: string;
}

interface ConstraintRow {
  conname: string;
  definition: string;
}

const columnsByTable = new Map<string, ColumnRow[]>();
const indexesByTable = new Map<string, IndexRow[]>();
const constraintsByTable = new Map<string, ConstraintRow[]>();

beforeAll(async () => {
  for (const table of REQUIRED_TABLES) {
    // information_schema.columns and pg_indexes return an EMPTY result set
    // for a table that does not exist — no Postgres error. That matters:
    // it lets the "table is missing" case surface as a clear, named
    // assertion failure below instead of an unrelated thrown error aborting
    // every other table's checks in the same run.
    const columns = (await sql`
      select column_name, data_type, is_nullable
        from information_schema.columns
       where table_schema = 'public' and table_name = ${table.name}
    `) as ColumnRow[];
    columnsByTable.set(table.name, columns);

    const indexes = (await sql`
      select indexname, indexdef
        from pg_indexes
       where schemaname = 'public' and tablename = ${table.name}
    `) as IndexRow[];
    indexesByTable.set(table.name, indexes);

    // Joined through pg_class/pg_namespace rather than a `<name>::regclass`
    // cast — the cast throws for a missing relation, which would abort the
    // whole beforeAll. A join just returns no rows.
    const constraints = (await sql`
      select con.conname as conname, pg_get_constraintdef(con.oid) as definition
        from pg_constraint con
        join pg_class cls on cls.oid = con.conrelid
        join pg_namespace ns on ns.oid = cls.relnamespace
       where ns.nspname = 'public' and cls.relname = ${table.name}
    `) as ConstraintRow[];
    constraintsByTable.set(table.name, constraints);
  }
}, 30_000);

function expectSetEqual(actual: readonly string[], expected: readonly string[], label: string) {
  const diff = diffSets(actual, expected);
  expect(diff.missing, `${label}: database is missing ${JSON.stringify(diff.missing)}`).toEqual([]);
  expect(
    diff.extra,
    `${label}: database has extra/drifted values ${JSON.stringify(diff.extra)}`,
  ).toEqual([]);
}

describe.each(REQUIRED_TABLES)("check:schema — $name", (table: RequiredTable) => {
  it(`table "${table.name}" exists with the expected columns`, () => {
    const columns = columnsByTable.get(table.name) ?? [];
    expect(
      columns.length > 0,
      `table "${table.name}" was not found in the public schema. ` +
        `Has the migration for it been applied by hand in the Supabase SQL editor? See docs/database.md.`,
    ).toBe(true);

    for (const expectedColumn of table.columns) {
      const actual = columns.find((c) => c.column_name === expectedColumn.name);
      expect(actual, `column "${table.name}.${expectedColumn.name}" is missing`).toBeDefined();
      if (!actual) continue;

      expect(
        actual.data_type,
        `column "${table.name}.${expectedColumn.name}" has the wrong type`,
      ).toBe(expectedColumn.dataType);
      expect(
        actual.is_nullable === "YES",
        `column "${table.name}.${expectedColumn.name}" nullability drifted from the required schema`,
      ).toBe(expectedColumn.nullable);
    }
  });

  for (const expectedIndex of table.indexes) {
    it(`index "${expectedIndex.name}" exists, uniqueness and predicate match`, () => {
      const indexes = indexesByTable.get(table.name) ?? [];
      const actual = indexes.find((i) => i.indexname === expectedIndex.name);
      expect(actual, `index "${expectedIndex.name}" on "${table.name}" is missing`).toBeDefined();
      if (!actual) return;

      const isUnique = /create unique index/i.test(actual.indexdef);
      expect(
        isUnique,
        `index "${expectedIndex.name}" uniqueness drifted (expected unique=${expectedIndex.unique})`,
      ).toBe(expectedIndex.unique);

      for (const column of expectedIndex.columns) {
        expect(
          actual.indexdef.includes(column),
          `index "${expectedIndex.name}" does not reference column "${column}": ${actual.indexdef}`,
        ).toBe(true);
      }

      if (expectedIndex.wherePredicateContains) {
        expect(
          /where/i.test(actual.indexdef),
          `index "${expectedIndex.name}" is expected to be partial but carries no WHERE clause: ${actual.indexdef}`,
        ).toBe(true);
        for (const fragment of expectedIndex.wherePredicateContains) {
          expect(
            actual.indexdef.includes(fragment),
            `index "${expectedIndex.name}"'s predicate is missing "${fragment}": ${actual.indexdef}`,
          ).toBe(true);
        }
      } else {
        expect(
          /where/i.test(actual.indexdef),
          `index "${expectedIndex.name}" is expected to be non-partial but carries a WHERE clause: ${actual.indexdef}`,
        ).toBe(false);
      }
    });
  }

  for (const expectedConstraint of table.checkConstraints) {
    it(`constraint "${expectedConstraint.name}" matches the source of truth`, () => {
      const constraints = constraintsByTable.get(table.name) ?? [];
      const actual = constraints.find((c) => c.conname === expectedConstraint.name);
      expect(
        actual,
        `constraint "${expectedConstraint.name}" on "${table.name}" is missing`,
      ).toBeDefined();
      if (!actual) return;

      if (
        expectedConstraint.kind === "enum-set-equal" ||
        expectedConstraint.kind === "enum-subset"
      ) {
        const literals = extractLiterals(actual.definition);
        expectSetEqual(
          literals,
          expectedConstraint.expectedLiterals,
          `constraint "${expectedConstraint.name}"`,
        );
      } else {
        const maxLength = extractMaxLength(actual.definition);
        expect(
          maxLength,
          `constraint "${expectedConstraint.name}" has no readable "<= N" bound: ${actual.definition}`,
        ).toBe(expectedConstraint.maxLength);
      }
    });
  }
});
