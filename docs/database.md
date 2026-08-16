# Arena Player Admin — Database & Storage (inherited)

**This repo reads a schema it does not own.** The authoritative contract — the full `create table` statement, every constraint, the setup steps — is [`arena-player-web/docs/database.md`](../../arena-player-web/docs/database.md), and the migration files live in `arena-player-web/db/migrations/`. Read that document when you need the DDL.

This file exists for the half that is different here: what the admin is allowed to do to those rows, how it finds out whether the migration was ever applied, and which gotchas arrive with the connection whether or not this repo caused them.

**Do not paste the `create table` statement into this repo.** A second copy is a second authority, and the first thing that happens to a second authority is that it drifts. Reference it.

---

## What this repo may do

| Object                               | Admin's access                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `bookings` — rows                    | `select` freely; `update status` under a guard; `insert` a walk-in (see below); **never** `delete`                               |
| `bookings` — schema                  | none. No `create`, `alter`, or `drop`, ever                                                                                      |
| `slot_blocks` (Phase 4)              | `select`, `insert`, `delete`. Schema still owned by web                                                                          |
| `site_settings`                      | `select`, `insert`/`update` (upsert by key). Allow-listed to four known keys — a typo'd key writes a row nothing reads           |
| `bank_accounts`                      | full CRUD (`select`, `insert`, `update`, `delete`), plus `is_active` toggle. Schema still owned by web                           |
| `rate_card`                          | full CRUD. Phase 6, [003](schema-requests/003-site-settings.md). Schema still owned by web                                       |
| `public_holidays`                    | full CRUD. Phase 6, [003](schema-requests/003-site-settings.md). Schema still owned by web                                       |
| Storage bucket `arena-player-proofs` | **read only**, through an RLS `select` policy on `storage.objects` scoped to this bucket. No write, no delete, no listing needed |

For all four settings/pricing tables above, "schema still owned by web" means the same thing it means for `bookings` and `slot_blocks`: this repo's admin UI writes rows, never DDL. The migration that created them lives in `arena-player-web/db/migrations/`, per hard rule 1.

### The insert, and why `delete` stays banned

**Changed 2026-08-15.** The row-level rule was "never `insert`, never `delete`" for the whole of Phase 1a and 2's design. The admin now takes **walk-in bookings** — somebody who turns up at the field and pays cash — so this app inserts. Recorded as a decision rather than left to contradict the sentence above it.

Three things about that insert are not negotiable:

1. **It respects `uniq_active_slot` like any other writer.** The partial unique index is the only anti-double-booking guard in the system and it does not care who is inserting. A walk-in for a slot the public site already holds must fail on the constraint and surface as a real conflict, never as a silent overwrite.
2. **`proof_key` is null for these rows**, which requires [005](schema-requests/005-admin-writes-bookings.md) and means "no proof" becomes a legitimate state rather than a failed image load. Every proof surface must tell the two apart.
3. **`delete` is still banned, and soft delete is an `update`.** A `deleted` status value ([005](schema-requests/005-admin-writes-bookings.md)) leaves the row in place and drops it out of `ACTIVE_STATUSES`, which frees the slot automatically without touching the index predicate. A hard `delete` would destroy the only record that a payment was ever received — see the proof-key contract below.

`DATABASE_URL` here cannot be a read-only role — this app writes `bookings.status` and now inserts. The correct hardening is a separate Postgres role in the Supabase project scoped to `select, insert, update(status) on bookings`, which costs one hand-run `GRANT`. Recorded as a handover nice-to-have in [PRD.md](PRD.md), not built in v1.

## The columns this repo reads

Reference only — the source is web's `database.md`. Listed here because every query in [architecture.md](architecture.md) names these and an agent should not have to open the other repo to read a column list.

| Column         | Type          | What the admin does with it                                                                                                                                     |
| -------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | `uuid`        | The mutation key. Always paired with a status guard, never used alone                                                                                           |
| `booking_date` | `date`        | Displayed and sorted. **Always cast `::text` in the select** — see the OID trap below                                                                           |
| `time_slot`    | `text`        | One of **eighteen** canonical 1-hour strings. Sorts correctly as plain text; see [architecture.md](architecture.md)                                             |
| `team_name`    | `text`        | Displayed, and one half of the search                                                                                                                           |
| `phone`        | `text`        | Stored normalised as `628xxxxxxxxx`, never as typed. Rendered as a `wa.me` link; searched through `normalisePhone()`                                            |
| `notes`        | `text`        | ≤500 chars. Detail page only — it wrecks list row height                                                                                                        |
| `proof_key`    | `text`        | A Storage object **key**, not a URL. There is no URL to store; the bucket is private and has none. **Null on a walk-in** the admin created — absent, not broken |
| `status`       | `text`        | `pending` · `confirmed` · `rejected` · `expired` · `deleted`. The only column this app **updates**; a walk-in insert writes the rest once, at creation          |
| `created_at`   | `timestamptz` | Drives the 24h expiry clock and the "age" column. **Cast `::text`**                                                                                             |

**Five statuses, and this app is the only thing that can reach four of them.** Without it, every row stays `pending` forever. `rejected` doubles as the cancellation mechanism, since no customer-facing cancel route exists anywhere in the system.

`deleted` is the newest and the one most easily misread: it is **soft delete, not rejection**. Reject means the admin looked at a payment and refused it — a customer-facing outcome with a reason. Deleted means the row should not have existed at all, typically a mistyped walk-in. Both leave `ACTIVE_STATUSES` and so both free the slot, but collapsing them loses the distinction the moment anyone reads the history.

---

## Gotchas inherited with the connection

These are not this repo's bugs. They arrive with the driver, with Supabase's connection topology, and with the Asia/Jakarta timezone, and they will bite here exactly as they bit in the web repo.

### 1. The DATE/TIMESTAMPTZ parser — BLOCKER class

`postgres.js` parses `DATE` (oid `1082`) and `TIMESTAMPTZ` (oid `1184`) into JS `Date` objects, not strings. On an Asia/Jakarta (UTC+7) machine this silently shifts `booking_date` back one day when serialized:

```
'2026-08-01'  →  Date object  →  JSON.stringify  →  '2026-07-31T17:00:00.000Z'
```

The driver changed; the trap did not. Every Postgres client for Node makes the same well-meant choice, so porting to a new one is never the fix — overriding it is.

**Fix:** register a custom type in the `types` option when constructing the client, claiming both oids and passing the raw string through untouched:

```ts
const sql = postgres(process.env.DATABASE_URL!, {
  prepare: false, // see gotcha 2
  types: {
    // 1082 DATE, 1184 TIMESTAMPTZ — hand the wire string through as-is
    date: {
      to: 1184,
      from: [1082, 1184],
      serialize: (value: string) => value,
      parse: (value: string) => value,
    },
  },
});
```

**Verify:** export the options object from `src/server/db.ts` and assert on it directly — `from` contains **both** `1082` and `1184`, and `parse('2026-08-01')` returns the **string** `'2026-08-01'`, not a `Date` instance. postgres.js resolves parsers per connection, so there is no static registry to interrogate; asserting the options is what keeps this check credential-free. It belongs in `src/server/db.test.ts` and runs under `check:unit`.

Every query in [architecture.md](architecture.md) _also_ casts `::text` on both date columns. That is belt and braces on purpose: if the override is ever "simplified" away, the queries still return strings, and the cast documents why at the point of use. Neither half substitutes for the other — a query added later without the cast is covered by the override, and an override lost in a driver upgrade is covered by the casts.

### 2. `prepare: false` on the transaction pooler — mandatory, not tuning

`DATABASE_URL` points at Supabase's **transaction pooler** (port `6543`), not the direct database host (`5432`). The direct string exhausts connections fast under concurrent serverless invocations; one admin makes that less acute than on the public site, but the expiry cron and a page load overlap by construction, and there is no upside to the direct string.

The pooler is pgbouncer in **transaction** mode, which hands a different backend connection to each transaction and therefore cannot carry a named prepared statement across them. `postgres.js` prepares statements by default. Left on, the failure is not at startup — it is an intermittent `prepared statement "..." already exists` / `does not exist` under exactly the overlap the pooler was chosen for. Pass `prepare: false` at construction, once, in `src/server/db.ts`.

### 3. `isPastSlot` covers dates before today

Not just "has today's slot start hour passed". This was a real bug in the web repo — without the date check, yesterday's slots were bookable. It arrives here inside the byte-identical `src/domain/dates.ts`, so it is already fixed; do not "simplify" it out while porting.

---

## Never `create table if not exists`

Application code must fail loudly when a table is missing, never quietly conjure one. The reasoning from the web repo applies with more force here, because this repo cannot even legitimately create it:

- The migration is wrapped in `begin;/commit;` so a paste that fails halfway cannot leave `bookings` created **without** `uniq_active_slot` — which would turn off anti-double-booking with no runtime error anywhere.
- A silent `create table if not exists` in application code defeats that entirely: it produces a table with no constraints and no index, and everything appears to work.

### How this repo finds out instead

**`pnpm check:schema`** — a Vitest file under `scripts/`, credentials required, driven by a declarative list in `src/server/required-schema.ts`. It asserts:

1. `bookings` exists, with the expected columns and types (`information_schema.columns`).
2. `uniq_active_slot` exists and is a **unique** index with the expected partial predicate (`pg_indexes`).
3. `time_slot_canonical` exists, and — the assertion neither repo has today — its quoted literals, read out of `pg_get_constraintdef`, are **set-equal to `TIME_SLOTS`** from `src/domain/slots.ts`.
4. From Phase 4: the same three checks for `slot_blocks` / `uniq_slot_block` / `slot_blocks_time_slot_canonical`.

**This is why the database client is `postgres.js` and not `supabase-js`.** Every assertion above reads the Postgres catalog — `information_schema.columns`, `pg_indexes`, `pg_get_constraintdef(pg_constraint.oid)`. PostgREST exposes tables, views and functions in the exposed schemas; it does not expose the catalog, so a PostgREST client cannot answer "was this migration applied, and applied unedited?" at all. [PRODUCT.md](PRODUCT.md) principle 4 names _a migration that was never applied_ as one of three silent failures that each get a check, and this is that check. `supabase-js` is carried for Storage only ([architecture.md](architecture.md)); the SQL path is a real Postgres driver on a real connection.

Assertion 3 is the point. `check:domain` guards source against source. Nothing in either repo guards source against the **database**, and the eighteen canonical strings live in three places already — `src/domain/slots.ts`, the CHECK constraint, and web's copy — becoming four once `slot_blocks` lands. **The 2026-08-15 slot change is what this assertion is for, and it needed no code change here to catch it:** `required-schema.ts` imports `TIME_SLOTS` and hands it straight to `expectedLiterals`, so the moment the constant became eighteen strings the check began demanding eighteen literals out of `pg_get_constraintdef` — and fails until web's `20260815_alter_time_slot_1h.sql` is applied ([schema-requests/README.md](schema-requests/README.md)). A `DOMAIN` would deduplicate them and is the wrong answer: it needs `alter column type` on `bookings`, a hand-run destructive change to the one table the entire race guard sits on. Duplicate the literal; detect the drift.

**`src/server/schema-guard.ts`** is the runtime half — per-feature, positive-cache-only, 503 on a mutating route, and never wrapped around the root layout. Full behaviour in [architecture.md](architecture.md).

---

## The error contract

```
UNIQUE_VIOLATION = "23505"
SLOT_CONSTRAINT  = "uniq_active_slot"
```

`isSlotConflict()` checks **both** the code and the constraint name. A bare code check would misreport an unrelated unique violation as "this slot is taken."

**This repo has no consumer for it in v1** — it never inserts into `bookings`, and its two status updates cannot collide with the partial index. It is documented here because the one feature that would need it, **un-expiring a booking**, is deliberately parked ([PRD.md](PRD.md)), and whoever un-parks it must reuse this contract rather than reinvent a bare `23505` check.

## The proof key and privacy contract

- Bucket `arena-player-proofs` is **private** — Supabase Storage's "public bucket" toggle stays off, and no public URL is ever created, from either repo.
- `proof_key` stores the object **key** — `proofs/${bookingDate}/${uuid}.${ext}`. It was renamed from `proof_url` precisely because the old name invited someone to render it as an `<img src>`.
- The admin mints a **signed URL, 120s TTL**, per page render, via `createSignedUrl(key, 120)`. Never `next/image` on it — the optimizer caches the decoded image at a stable path that outlives the signature, which copies a private payment document out of a private bucket. Hard rule 2 in [CLAUDE.md](../CLAUDE.md).
- Read access is granted by an **RLS `select` policy on `storage.objects`** scoped to this bucket, and the admin signs with the **anon** key. Never `service_role`: it bypasses RLS entirely, which would hand this app write and delete on every bucket in the project without a single visible change in behaviour. Full reasoning in [architecture.md](architecture.md).

## Orphaned storage objects — visible to nobody, including this app

Web uploads the proof before the insert, so a process that dies in between leaves a file no row points at. **This app cannot detect it**: it queries the database, and the database has no record of the file. The intended fix has always been a bucket-level expiry rule on the `proofs/` prefix, configured in the provider's dashboard rather than in code.

**Open item — the Supabase equivalent is unverified.** Whether Supabase Storage offers a prefix/age expiry rule at all has not been confirmed here, and inventing one in this document would be worse than leaving the gap named. Someone must check it against the actual project before handover and write the answer down; if there is no built-in mechanism, the fallback is a periodic reconciliation the expiry job could carry (list the prefix, drop keys no `bookings` row references) — which is a Phase 3+ decision, not a hidden assumption. Either way the fix lives outside both repos, which is exactly the kind of thing that gets lost at handover. Noted here so the admin-side handover checklist can confirm it.

## Env vars

Documented with their reasoning in [`.env.local.example`](../.env.local.example). No values live in this document. Shared with `arena-player-web`, because both apps must land on the **same Supabase project**: `DATABASE_URL` (the transaction-pooler string), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PROOFS_BUCKET`. This repo's own: `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `CRON_SECRET`.

The one worth repeating: **what makes this app's storage access read-only is the RLS policy, not the key.** There is no separate credential to be careful with any more, so the care moves to the policy — see [architecture.md](architecture.md).

## No MCP for the database

`.mcp.json` in this repo wires up no Supabase server, matching the web repo's deliberate removal of its own. The Supabase MCP ships `execute_sql` and `apply_migration` — precisely the capability the manual-migration rule forbids, now one tool call away rather than one dashboard login away, and the failure it enables is silent. If it is ever added, it comes back read-only, with a written rule, in both repos at once.
