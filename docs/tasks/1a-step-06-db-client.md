# 1a · step 06 — Database client and `check:schema`

**Depends**: 05 (`check:schema` asserts against `TIME_SLOTS`)
**Blocks**: Phase 2 entirely — every screen reads Supabase Postgres
**Agent**: `software-engineer`

## Goal

`src/server/db.ts` that cannot silently corrupt a date, `src/server/required-schema.ts` as the machine-readable expectation, `src/server/schema-guard.ts` for the runtime path, and `pnpm check:schema` — the check neither repo has today.

No query from [architecture.md](../architecture.md) is implemented here. This step builds the client and the guarantees; Phase 2 writes the statements.

## The trap that has already cost a day once

**This trap survived the move to Supabase intact.** It is the driver's, not the provider's: `postgres.js` parses `DATE` (oid `1082`) and `TIMESTAMPTZ` (oid `1184`) into JS `Date` objects by default, exactly as the previous client did. On an Asia/Jakarta machine that silently shifts `booking_date` back one day the moment it is serialized:

```
'2026-08-01'  →  Date object  →  JSON.stringify  →  '2026-07-31T17:00:00.000Z'
```

TypeScript cannot catch it — driver rows are cast, not validated. Only the idiom for the fix changed: instead of a `CustomTypesConfig`, `postgres.js` takes a `types` option whose custom type declares `from: [1082, 1184]` and a `parse` that returns the raw string untouched. The verification is a one-line assertion that belongs in a test rather than a comment.

**The failure mode to watch for is a widened `from` list.** It takes OIDs, not names, so adding `23` "for completeness" turns every count and id in the app into a string with nothing throwing. Two OIDs, listed explicitly, and a test that says so.

Every query in `architecture.md` **also** casts `::text` on both date columns. That is belt and braces on purpose: if the override is ever "simplified" away, the queries still return strings.

## What `check:schema` does that nothing else does

`check:domain` guards source against source. **Nothing in either repo guards source against the database.**

The eighteen canonical slot strings currently live in three places — `src/domain/slots.ts`, the `time_slot_canonical` CHECK constraint, and web's copy — becoming four once `slot_blocks` lands. Any one of them can drift from the others with no error anywhere, and the consequence is the same silent anti-double-booking failure as a source drift.

So `check:schema` reads `pg_get_constraintdef`, extracts the quoted literals, and asserts **set equality** with `TIME_SLOTS`.

**Deliberately not solved with a Postgres `DOMAIN`.** A domain would deduplicate the literals properly and requires `alter column type` on `bookings` — a hand-run destructive change to the one table the entire race guard sits on. Duplicate the literal; detect the drift. Write that reasoning into the file, because a domain is the obvious refactor and someone will propose it.

## Deliverables

- **`src/server/db.ts`** — `postgres.js` client against Supabase's **transaction pooler** (port `6543`), with **`prepare: false`** and a `types` override covering OIDs `1082` and `1184`, `import "server-only"` at the top. Constructed **lazily**, so importing the module with no `.env.local` never throws. A colocated `db.test.ts` asserting the custom type's `parse('2026-08-01')` returns a **string** and that its `from` list is exactly `[1082, 1184]`, runnable with no credentials

  **`prepare: false` is mandatory, not tuning.** pgbouncer in transaction mode hands a different backend connection to each statement, so a prepared statement created on one is not there for the next. Leaving it at the default surfaces as intermittent "prepared statement does not exist" errors under exactly the concurrency the pooler was chosen for — which is why it is asserted, not commented

- **`src/server/required-schema.ts`** — declarative: tables, columns and types, indexes with their uniqueness and partial predicates, named constraints. Phase 4's `slot_blocks` entry is added there, not in the check
- **`scripts/check-schema.test.ts`**, wired as `pnpm check:schema` → `vitest run scripts`, asserting against the live Supabase database. **This is why the driver is `postgres.js` and not `supabase-js`/PostgREST**: these four assertions read `information_schema.columns`, `pg_indexes` and `pg_get_constraintdef`, none of which PostgREST exposes. The check would have to be deleted to adopt the REST client, and it is the only thing in either repo that guards source against the database:
  1. `bookings` exists with the expected columns and types (`information_schema.columns`)
  2. `uniq_active_slot` exists, is **unique**, and carries the expected partial predicate (`pg_indexes`)
  3. `time_slot_canonical`'s literals, from `pg_get_constraintdef`, are **set-equal to `TIME_SLOTS`**
  4. `status_valid` allows exactly the four statuses this app knows about
- **`src/server/schema-guard.ts`** — `select to_regclass('public.<table>')` per feature table, memoised, **positive cache only**: cache `true` for the process lifetime, re-check on `false`. Applying a migration must not require a redeploy
- **`src/server/storage.ts`** — `@supabase/supabase-js` client built from `SUPABASE_URL` + `SUPABASE_ANON_KEY`, exposing `PROOF_URL_TTL_SECONDS = 120` and one function that calls `createSignedUrl(key, PROOF_URL_TTL_SECONDS)` on `SUPABASE_PROOFS_BUCKET`. Lazily constructed for the same reason as `db.ts`, `import "server-only"` at the top. **No `@aws-sdk` packages and no checksum configuration** — the R2 flexible-checksum workaround belonged to the S3 client and is deleted, not ported

  Unlike AWS presigning, this call is a **server round-trip**, so it can fail before a URL exists. That failure must be distinguishable from an expired one, because the recovery UI at step 05 is written for the second and would otherwise silently absorb the first

- **`pnpm check:setup`** — the live preflight, in two named halves so a red exit says which: the database reachable on the pooler string, and the storage credential signing a URL for a real object. Same glob as `check:schema`, credentials required

## Two things the guard must not do

**It must never wrap the root layout.** Phase 2 needs zero new migrations. A missing Phase 4 table degrades this app to its core function; it does not brick it. Someone will otherwise put the guard in `src/app/layout.tsx` because it looks tidier, and the first missing migration will take the bookings console down with it.

**It must never `create table if not exists`.** The migration is wrapped in a transaction specifically so a half-failed paste cannot leave `bookings` created _without_ `uniq_active_slot`. Application-code DDL defeats that entirely: it produces a table with no constraints, no index, and no error.

## Acceptance

```bash
# the OID override exists and is asserted, not just present
grep -n "1082\|1184" src/server/db.ts           # expect: both, and NO other OID
grep -n "prepare" src/server/db.ts              # expect: prepare: false — the pooler requires it
pnpm check:unit                                # the parser assertion runs with NO credentials

# the R2 client is gone, not merely unused
grep -rn "aws-sdk\|S3Client\|getSignedUrl\|r2.cloudflarestorage\|R2_" src/ scripts/ package.json
# expect: no match anywhere

# secrets cannot reach the client bundle
grep -n 'server-only' src/server/db.ts src/server/storage.ts   # expect: both files

# --- against the live Supabase database ---
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
