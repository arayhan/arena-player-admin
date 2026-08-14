# SQL & data access

Where SQL is allowed to live, how a new query gets written, and how this repo finds out whether the schema it reads actually exists.

**Load when:** writing or changing a query, adding a screen that reads Supabase, or touching `src/server/required-schema.ts`, `src/server/schema-guard.ts`, or `src/server/schema-diff.ts`.

**Authority elsewhere:**

- The text of every statement this app issues — [architecture.md](../architecture.md): the bookings list, the detail read, status mutations, the expiry job
- One file for all SQL — [dev-rules.md § Every SQL statement lives in `src/server/queries.ts`](../dev-rules.md#every-sql-statement-lives-in-srcserverqueriests)
- Migration ownership — [CLAUDE.md](../../CLAUDE.md) hard rule 1, [architecture.md § 2. Web owns `db/migrations/`](../architecture.md#2-web-owns-dbmigrations)
- Guard scope and `create table if not exists` — [CLAUDE.md](../../CLAUDE.md) hard rule 6, [architecture.md § The schema guard](../architecture.md#the-schema-guard)
- What this app may do to which object — [database.md § What this repo may do](../database.md#what-this-repo-may-do)
- `src/domain/` byte-identity — [CLAUDE.md](../../CLAUDE.md) hard rule 4

## Where SQL lives

1. `src/server/queries.ts`, no exceptions — see the dev-rules link above.
2. Statements are **copied verbatim** from architecture.md, including the `::text` casts, the guard clauses, and the parameter comments. Not paraphrased, not reformatted, not "tidied".
3. **When a screen needs a query that does not exist yet, the order is fixed:** write it into architecture.md first — parameters, and a note on anything load-bearing — then copy it into `queries.ts`. Never invent it in `queries.ts` and back-fill the doc. The doc is the contract; a statement that exists only in code has no contract to be reviewed against.
4. The one carve-out is **catalog SQL**: `to_regclass` in `schema-guard.ts`, and `information_schema` / `pg_indexes` / `pg_constraint` in `scripts/check-schema.test.ts`. It reads metadata, never application rows, and the carve-out does not extend to anything touching `bookings`.

## Reading and writing a database this repo does not own

- Read freely; the **only** column this app writes is `bookings.status`. No `insert`, no `delete`, no DDL, ever. Object-by-object access is in database.md's table.
- Every status mutation carries its own `where status in (…)` and returns 409 on zero rows — hard rule 5.
- **Never assume a migration is applied.** `pnpm check:schema` is how you find out. It needs live credentials and sits outside `pnpm check` on purpose.
- Date and timestamp columns come back as strings twice over: the OID 1082/1184 override in `src/server/db.ts` and a `::text` cast in every query. Both halves stay.

## Migrations and schema requests

- This repo never owns a migration — hard rule 1.
- The flow: author `docs/schema-requests/NNN-<slug>.md`; a human transcribes the DDL verbatim into `arena-player-web/db/migrations/` and applies it by hand in the Supabase SQL editor. Protocol, file format, and the DDL rules are in [schema-requests/README.md](../schema-requests/README.md).
- Never `create table if not exists` in application code — hard rule 6. Application code fails loudly instead.

## The schema guard

- Scoped to the one feature that needs the table. **Never the root layout** — hard rule 6; the reasoning is in architecture.md.
- Positive cache only: `true` is cached for the process lifetime, `false` is always re-checked, so applying a migration takes effect on the next request with no redeploy.
- A Postgres `42P01` escaping anywhere becomes a 503 naming the migration file, never a caught-and-return-empty that renders "no blocks" for "no table".

## Adding a required-schema entry

`src/server/required-schema.ts` is the only place the expectation is written, and `scripts/check-schema.test.ts` iterates `REQUIRED_TABLES` generically. **A new table costs one entry, not a new assertion block in the check.**

1. Add a `RequiredTable` const and append it to `REQUIRED_TABLES`. Columns use `information_schema` vocabulary verbatim — `"timestamp with time zone"`, not `timestamptz` — and `nullable` mirrors `is_nullable`.
2. **Name every constraint in the DDL.** The check finds constraints by `conname`; an anonymous constraint is one it cannot assert on at all.
3. Pick the constraint `kind` deliberately. `enum-set-equal` and `enum-subset` compare literals parsed out of `pg_get_constraintdef` for set equality **in both directions** — `diffSets` in `schema-diff.ts` reports `missing` and `extra`, so a silently added fifth value fails as loudly as a removed one. `max-length` reads the bound out of `length(…) <= N`.
4. **Slot literals are imported from `TIME_SLOTS` in `src/domain/slots.ts`, never retyped.** That import is what makes this file and the domain copy incapable of drifting from each other, leaving the live database as the only surface left to check.
5. `wherePredicateContains` is a loose substring list, not a byte-exact clause — Postgres re-prints predicates with its own parentheses and `::text` casts. Omit the field entirely to assert an index is _not_ partial; the check then requires `indexdef` to carry no `where`.
6. **Adding a table before its migration lands makes `check:schema` fail until it is applied.** That is intended, and it is why the entry is written at the same time as the schema request — the failing check is the reminder that the DDL is still sitting in a markdown file.
7. New parsing or comparison logic goes in `src/server/schema-diff.ts`, which is credential-free and unit-tested, not inline in the check. Then prove the new assertion fails before trusting it — hard rule 9.

## Data shapes

- `src/domain/` is byte-identical with the web repo and read-only here — hard rule 4. Fix drift by fixing web and re-copying, never by editing the copy.
