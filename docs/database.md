# Arena Player Admin — Database & Storage (inherited)

**This repo reads a schema it does not own.** The authoritative contract — the full `create table` statement, every constraint, the setup steps — is [`arena-player-web/docs/database.md`](../../arena-player-web/docs/database.md), and the migration files live in `arena-player-web/db/migrations/`. Read that document when you need the DDL.

This file exists for the half that is different here: what the admin is allowed to do to those rows, how it finds out whether the migration was ever applied, and which gotchas arrive with the connection whether or not this repo caused them.

**Do not paste the `create table` statement into this repo.** A second copy is a second authority, and the first thing that happens to a second authority is that it drifts. Reference it.

---

## What this repo may do

| Object | Admin's access |
|---|---|
| `bookings` — rows | `select` freely; `update status` under a guard; **never** `insert`, **never** `delete` |
| `bookings` — schema | none. No `create`, `alter`, or `drop`, ever |
| `slot_blocks` (Phase 4) | `select`, `insert`, `delete`. Schema still owned by web |
| R2 `arena-player-proofs` | `GetObject` only, via a read-only token. No write, no delete, no listing needed |

`DATABASE_URL` here cannot be a read-only role — this app writes `bookings.status`. The correct hardening is a separate Neon role scoped to `select, update(status) on bookings`, which costs one hand-run `GRANT`. Recorded as a handover nice-to-have in [PRD.md](PRD.md), not built in v1.

## The columns this repo reads

Reference only — the source is web's `database.md`. Listed here because every query in [architecture.md](architecture.md) names these and an agent should not have to open the other repo to read a column list.

| Column | Type | What the admin does with it |
|---|---|---|
| `id` | `uuid` | The mutation key. Always paired with a status guard, never used alone |
| `booking_date` | `date` | Displayed and sorted. **Always cast `::text` in the select** — see the OID trap below |
| `time_slot` | `text` | One of nine canonical strings. Sorts correctly as plain text; see [architecture.md](architecture.md) |
| `team_name` | `text` | Displayed, and one half of the search |
| `phone` | `text` | Stored normalised as `628xxxxxxxxx`, never as typed. Rendered as a `wa.me` link; searched through `normalisePhone()` |
| `notes` | `text` | ≤500 chars. Detail page only — it wrecks list row height |
| `proof_key` | `text` | An R2 object **key**, not a URL. There is no URL to store; the bucket has none |
| `status` | `text` | `pending` · `confirmed` · `rejected` · `expired`. The only column this app writes |
| `created_at` | `timestamptz` | Drives the 24h expiry clock and the "age" column. **Cast `::text`** |

**Four statuses, and this app is the only thing that can reach three of them.** Without it, every row stays `pending` forever. `rejected` doubles as the cancellation mechanism, since no customer-facing cancel route exists anywhere in the system.

---

## Gotchas inherited with the connection

These are not this repo's bugs. They arrive with Neon, with R2, and with the Asia/Jakarta timezone, and they will bite here exactly as they bit in the web repo.

### 1. The Neon DATE/TIMESTAMPTZ parser — BLOCKER class

`neon()`'s default pg-types parsers return JS `Date` objects for `DATE` (oid `1082`) and `TIMESTAMPTZ` (oid `1184`), not strings. On an Asia/Jakarta (UTC+7) machine this silently shifts `booking_date` back one day when serialized:

```
'2026-08-01'  →  Date object  →  JSON.stringify  →  '2026-07-31T17:00:00.000Z'
```

**Fix:** override both OID parsers via `CustomTypesConfig` when constructing the client, so they pass the raw string through:

```ts
const customTypes: CustomTypesConfig = {
  getTypeParser: (id, format) => {
    if (id === 1082 || id === 1184) return (value: string) => value;
    return types.getTypeParser(id, format);
  },
};
```

**Verify:** `types.getTypeParser(1082)('2026-08-01')` must return the **string**, not a `Date` instance. That assertion belongs in `src/server/db.test.ts` and runs under `check:unit` with no credentials.

Every query in [architecture.md](architecture.md) *also* casts `::text` on both date columns. That is belt and braces on purpose: if the override is ever "simplified" away, the queries still return strings, and the cast documents why at the point of use.

### 2. R2 checksums — applies even though this app only reads

```ts
requestChecksumCalculation: "WHEN_REQUIRED",
responseChecksumValidation: "WHEN_REQUIRED",
```

`responseChecksumValidation` is the read-side half. Leaving it at the SDK default makes GETs from R2 fail validation on some paths, in a way that looks like a credentials or network problem and is not. Set **both** flags identically to web's, so the two clients never diverge for a reason nobody can reconstruct later.

### 3. Pooled connection string, not direct

The host must contain `-pooler`. The direct string exhausts connections fast under concurrent invocations. One admin makes this less acute than on the public site, but the expiry cron and a page load can overlap, and there is no upside to the direct string.

### 4. `isPastSlot` covers dates before today

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

Assertion 3 is the point. `check:domain` guards source against source. Nothing in either repo guards source against the **database**, and the nine canonical strings live in three places already — `src/domain/slots.ts`, the CHECK constraint, and web's copy — becoming four once `slot_blocks` lands. A `DOMAIN` would deduplicate them and is the wrong answer: it needs `alter column type` on `bookings`, a hand-run destructive change to the one table the entire race guard sits on. Duplicate the literal; detect the drift.

**`src/server/schema-guard.ts`** is the runtime half — per-feature, positive-cache-only, 503 on a mutating route, and never wrapped around the root layout. Full behaviour in [architecture.md](architecture.md).

---

## The error contract

```
UNIQUE_VIOLATION = "23505"
SLOT_CONSTRAINT  = "uniq_active_slot"
```

`isSlotConflict()` checks **both** the code and the constraint name. A bare code check would misreport an unrelated unique violation as "this slot is taken."

**This repo has no consumer for it in v1** — it never inserts into `bookings`, and its two status updates cannot collide with the partial index. It is documented here because the one feature that would need it, **un-expiring a booking**, is deliberately parked ([PRD.md](PRD.md)), and whoever un-parks it must reuse this contract rather than reinvent a bare `23505` check.

## R2 key and privacy contract

- Bucket `arena-player-proofs` is **private**. No public URL, ever, from either repo.
- `proof_key` stores the object **key** — `proofs/${bookingDate}/${uuid}.${ext}`. It was renamed from `proof_url` precisely because the old name invited someone to render it as an `<img src>`.
- The admin mints a **presigned GET, 120s TTL**, per page render. Never `next/image` on it — the optimizer caches the decoded image at a stable path that outlives the presign, which copies a private payment document out of a private bucket. Hard rule 2 in [CLAUDE.md](../CLAUDE.md).

## Orphaned R2 objects — visible to nobody, including this app

Web uploads the proof before the insert, so a process that dies in between leaves a file no row points at. **This app cannot detect it**: it queries the database, and the database has no record of the file. The intended fix is an R2 lifecycle rule on the `proofs/` prefix, configured in the Cloudflare dashboard — outside both repos, which makes it exactly the kind of thing that gets lost at handover. Noted here so the admin-side handover checklist can confirm it.

## Env vars

Seven, documented with their reasoning in [`.env.local.example`](../.env.local.example). No values live in this document. The one worth repeating: **the R2 key here is a different, read-only token from web's.**

## No MCP for the database

`.mcp.json` in this repo wires up no Neon server, matching the web repo's deliberate removal. An MCP that can execute SQL and apply migrations is exactly the capability the manual-migration rule forbids, and the failure it enables is silent. If it is ever added, it comes back read-only, with a written rule, in both repos at once.
