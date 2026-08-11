# 1a · step 06 — Database client and `check:schema`

**Depends**: 05 (`check:schema` asserts against `TIME_SLOTS`)
**Blocks**: Phase 2 entirely — every screen reads Neon
**Agent**: `software-engineer`

## Goal

`src/server/db.ts` that cannot silently corrupt a date, `src/server/required-schema.ts` as the machine-readable expectation, `src/server/schema-guard.ts` for the runtime path, and `pnpm check:schema` — the check neither repo has today.

No query from [architecture.md](../architecture.md) is implemented here. This step builds the client and the guarantees; Phase 2 writes the statements.

## The trap that has already cost a day once

`neon()`'s default pg-types parsers return JS `Date` objects for `DATE` (oid `1082`) and `TIMESTAMPTZ` (oid `1184`). On an Asia/Jakarta machine that silently shifts `booking_date` back one day the moment it is serialized:

```
'2026-08-01'  →  Date object  →  JSON.stringify  →  '2026-07-31T17:00:00.000Z'
```

TypeScript cannot catch it — driver rows are cast, not validated. The fix is a `CustomTypesConfig` override passing both OIDs through as raw strings, and the verification is a one-line assertion that belongs in a test rather than a comment.

Every query in `architecture.md` **also** casts `::text` on both date columns. That is belt and braces on purpose: if the override is ever "simplified" away, the queries still return strings.

## What `check:schema` does that nothing else does

`check:domain` guards source against source. **Nothing in either repo guards source against the database.**

The nine canonical slot strings currently live in three places — `src/domain/slots.ts`, the `time_slot_canonical` CHECK constraint, and web's copy — becoming four once `slot_blocks` lands. Any one of them can drift from the others with no error anywhere, and the consequence is the same silent anti-double-booking failure as a source drift.

So `check:schema` reads `pg_get_constraintdef`, extracts the quoted literals, and asserts **set equality** with `TIME_SLOTS`.

**Deliberately not solved with a Postgres `DOMAIN`.** A domain would deduplicate the literals properly and requires `alter column type` on `bookings` — a hand-run destructive change to the one table the entire race guard sits on. Duplicate the literal; detect the drift. Write that reasoning into the file, because a domain is the obvious refactor and someone will propose it.

## Deliverables

- **`src/server/db.ts`** — Neon serverless client, pooled connection string, `CustomTypesConfig` overriding OIDs `1082` and `1184`, `import "server-only"` at the top. A colocated `db.test.ts` asserting `types.getTypeParser(1082)('2026-08-01')` returns a **string**, runnable with no credentials
- **`src/server/required-schema.ts`** — declarative: tables, columns and types, indexes with their uniqueness and partial predicates, named constraints. Phase 4's `slot_blocks` entry is added there, not in the check
- **`scripts/check-schema.test.ts`**, wired as `pnpm check:schema` → `vitest run scripts`, asserting against live Neon:
  1. `bookings` exists with the expected columns and types (`information_schema.columns`)
  2. `uniq_active_slot` exists, is **unique**, and carries the expected partial predicate (`pg_indexes`)
  3. `time_slot_canonical`'s literals, from `pg_get_constraintdef`, are **set-equal to `TIME_SLOTS`**
  4. `status_valid` allows exactly the four statuses this app knows about
- **`src/server/schema-guard.ts`** — `select to_regclass('public.<table>')` per feature table, memoised, **positive cache only**: cache `true` for the process lifetime, re-check on `false`. Applying a migration must not require a redeploy
- **`pnpm check:setup`** — the live preflight: Neon reachable on the pooled string, R2 credentials valid, a presigned GET round-trips. Same glob as `check:schema`, credentials required

## Two things the guard must not do

**It must never wrap the root layout.** Phase 2 needs zero new migrations. A missing Phase 4 table degrades this app to its core function; it does not brick it. Someone will otherwise put the guard in `src/app/layout.tsx` because it looks tidier, and the first missing migration will take the bookings console down with it.

**It must never `create table if not exists`.** The migration is wrapped in a transaction specifically so a half-failed paste cannot leave `bookings` created _without_ `uniq_active_slot`. Application-code DDL defeats that entirely: it produces a table with no constraints, no index, and no error.

## Acceptance

```bash
# the OID override exists and is asserted, not just present
grep -n "1082\|1184" src/server/db.ts           # expect: both
pnpm check:unit                                # the parser assertion runs with NO credentials

# secrets cannot reach the client bundle
grep -n 'server-only' src/server/db.ts src/server/storage.ts   # expect: both files

# --- against live Neon ---
pnpm check:schema ; echo "$?"
# Before web's Phase 4 migration is applied, expect NON-ZERO with a message naming
# the missing `bookings` table. That is the correct result today, not a failure of this step.

# --- once the migration is applied, prove each assertion can fail ---
# 3 is the one that matters: drift the source and watch the DB comparison catch it
sed -i "s/'22\.00 - 24\.00'/'22.00 - 23.59'/" src/domain/slots.ts
pnpm check:schema ; echo "expect non-zero, naming time_slot_canonical: $?"
cp ../arena-player-web/src/domain/slots.ts src/domain/slots.ts

# the guard is not global
grep -rn "schemaGuard\|schema-guard" src/app/layout.tsx   # expect: no match

# no DDL anywhere in application code
grep -rniE "create table|alter table|drop table" src/ scripts/
# expect: no match outside a comment explaining why not
```

**Not done until** `check:schema` has been seen failing in **two different ways**: once against a database with no `bookings` table, and once on a planted slot-string drift between `src/domain/slots.ts` and the CHECK constraint. The second is the entire reason this check exists — a schema check that only verifies "the table is there" is a check that would have passed on every version of the bug it was written to catch.

handoff: `software-engineer` for step 07
