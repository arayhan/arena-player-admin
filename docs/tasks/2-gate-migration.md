# Phase 2 entry — `bookings` exists in the database this app connects to

**Decided by:** the user, applying web's migration by hand in the Supabase SQL editor. The developer verifies.
**Blocks:** all of Phase 2, and therefore Phases 3–5. No step file below this one can be verified until it clears
**Status:** not yet held — verified 2026-08-13, `pnpm check:schema` connects successfully and **10/10 assertions fail** with "table was not found in the public schema". That observation predates the move to Supabase: re-run it against the new `DATABASE_URL` before quoting it, since "connects successfully" now proves a different connection
**Format:** a sequence, verified at each row. Not a meeting
**Date completed:** \_\_\_\_\_

## Where things actually stand

**Two migrations exist in web and neither has ever been applied.** `DATABASE_URL` here reaches Supabase — the connection is fine, the credentials are fine, the database is empty of this table.

1. `../arena-player-web/db/migrations/20260809_create_bookings.sql` — the table. Request record: [../schema-requests/004-bookings-on-supabase.md](../schema-requests/004-bookings-on-supabase.md).
2. `../arena-player-web/db/migrations/20260815_alter_time_slot_1h.sql` — replaces `time_slot_canonical` with the eighteen 1-hour literals, after `TIME_SLOTS` split on 2026-08-15. Request record: [../schema-requests/006-time-slot-1h.md](../schema-requests/006-time-slot-1h.md).

**Order is not optional and it is not a preference:** 2 drops the constraint 1 creates. Applied alone, or first, it errors. Applied in order, `check:schema` goes green; applied as 1 only, `check:schema` stays red on the literals assertion — correctly, because the constraint would then hold nine strings the app can no longer produce.

[PRD.md](../PRD.md) names `check:schema` going green as the Phase 2 entry gate in as many words: _"Blocked on web Phase 4. Not on its UI — on the migration being applied. `check:schema` is how that is confirmed, not a conversation."_

## Why this is a gate and not a checklist line inside step 01

Two reasons, and the second is the one that matters.

**One:** no agent can do it. This repo never owns a migration (hard rule 1) and has no path to the Supabase SQL editor. The actor is a human with a browser.

**Two — the silent half.** The migration is wrapped in `begin;` / `commit;` **on purpose**, and its own comments say why: a paste that fails halfway must not leave `bookings` created _without_ `uniq_active_slot`. That index is the only anti-double-booking guard in the entire system. A table created without it works perfectly, throws nothing, passes every screen in this app, and lets the public site sell one slot twice — forever, silently. Pasting statement-by-statement, or dropping the transaction wrapper because the editor complained about it, produces exactly that.

`pnpm check:schema` catches it (it asserts `uniq_active_slot` is present _and_ unique). A checklist inside a step file can be ticked by someone who ran the app and saw rows. A signature against a named row cannot.

## The sequence — each row must be true before the next is attempted

| #   | Step                                                                                                        | Who       | Verified by                                                    |
| --- | ----------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------- |
| 1   | Confirm which Supabase **project** `DATABASE_URL` here points at, and that web's `DATABASE_URL` matches     | user      | project ref + port compared between the two `.env.local` files |
| 2   | The **entire file** pasted into the Supabase SQL editor in one go, `begin;` through `commit;`, and executed | user      | the editor reports success, not a partial run                  |
| 3   | `pnpm check:schema` green here — all 10 assertions                                                          | admin     | the command, output read                                       |
| 4   | At least one real `bookings` row exists to work against                                                     | see below | `select count(*) from bookings` > 0                            |

**Row 1 is the one nobody checks.** Two Supabase **projects** — one spun up for web, one spun up while wiring this repo's `.env.local` — produce an admin app that confirms bookings the public site will never see, and a public site whose bookings never reach the queue. Both apps work. Nothing errors. The whole product is a no-op. A second project is a two-click mistake and it is free, which is exactly why it happens: there is no cost signal and no error to notice.

Compare the two connection strings before anything else. Two things must match, and the first is the one that matters:

- **The project ref** — the subdomain-shaped identifier inside the host. Different ref = different database, full stop.
- **The transaction pooler, port `6543`**, in both. The direct connection exhausts connections under concurrent serverless invocations, and the pooler is also why `prepare: false` is mandatory in `src/server/db.ts` rather than a tuning choice — pgbouncer in transaction mode hands a different backend connection to each statement, so a prepared statement created on one is not there for the next. See [database.md](../database.md).

A matching ref on the **wrong port** is a performance and prepared-statement problem. A mismatched **ref** is the silent no-op above. Check the ref first.

**Row 4 is not optional and has a trap in it.** This repo could **never** `insert` when this gate was written. That changed on 2026-08-15: walk-in creation ([005](../schema-requests/005-admin-writes-bookings.md)) gives it an insert, and [database.md](../database.md) "What this repo may do" now says so.

**It does not rescue this gate**, for two reasons worth stating rather than leaving someone to rediscover. 005 has not landed, so the insert does not exist yet; and when it does, a walk-in row carries a **null `proof_key`** by design — so it can never be the test data that unblocks [2-step-05-proof](2-step-05-proof.md)'s live half, which is the whole point of row 4. Three ways to get a row, in descending order of usefulness:

1. **Make a booking on the public site running locally.** Best by a distance: it exercises web's real insert path, produces a `phone` already normalised to `628…`, and — critically — uploads a real object to the Supabase proofs bucket, so `proof_key` points at something that actually exists. That is the only source of test data that also unblocks [2-step-05-proof](2-step-05-proof.md)'s live half. It presumes web has already moved to Supabase — see [2-gate-web-supabase](2-gate-web-supabase.md).
2. Hand-written `insert` in the Supabase SQL editor by the user. Fast, but `proof_key` is `not null` and whatever string is put there points at no object, so the proof view fails for the whole of Phase 2.
3. Nothing — build against an empty table. Legitimate for step 01 and the empty states, useless for everything after.

## Questions that must not be left unasked

### 1. Same Supabase project as web? — **BLOCKS everything**

- Project ref in admin's `DATABASE_URL` (no credentials, just the ref + port): \_\_\_\_\_
- Project ref in web's `DATABASE_URL`: \_\_\_\_\_
- Identical? \_\_\_\_\_ · Both on the transaction pooler, port `6543`? \_\_\_\_\_
- How many Supabase projects exist in this client's org? \_\_\_\_\_ _(more than one is not wrong, but it is where the split-brain comes from — name which is which)_

### 2. Was the file pasted whole, transaction wrapper included? — **BLOCKS row 3**

- Pasted `begin;` … `commit;` in one execution? \_\_\_\_\_
- If not, what was run and in what order: \_\_\_\_\_
- `uniq_active_slot` present **and unique**? \_\_\_\_\_ _(`check:schema` asserts this; read its output, do not infer it from the table existing)_
- `bookings_pending_expiry_idx` present? \_\_\_\_\_ _(Phase 3's expiry UPDATE relies on it)_

### 3. Was the second migration applied, and were the slot literals edited? — **BLOCKS row 3**

The `time_slot_canonical` CHECK duplicates the canonical strings deliberately rather than factoring them into a Postgres `DOMAIN`; the reasoning is in the migration's own comments and in [architecture.md](../architecture.md). A "tidied" paste that reformats or reorders them breaks nothing visibly and breaks `uniq_active_slot`'s text comparison against `src/domain/slots.ts` permanently.

The set that must end up in the database is the **eighteen** 1-hour strings. `20260809` writes the old nine; `20260815_alter_time_slot_1h.sql` replaces them. Do not resolve this by editing `20260809` — it is applied as written, and the second file is what corrects it, so the migration history stays a history.

- `20260809_create_bookings.sql` transcribed without edits, comments included? \_\_\_\_\_
- `20260815_alter_time_slot_1h.sql` then applied, whole, `begin;`…`commit;` in one execution? \_\_\_\_\_
- Its `not valid` left in place? \_\_\_\_\_ _(it skips validating pre-existing rows; removing it can fail the migration on data that predates it)_
- `check:schema`'s CHECK-literals-vs-`TIME_SLOTS` set equality assertion passes, showing eighteen? \_\_\_\_\_

### 4. Where does test data come from? — **BLOCKS row 4, and step 05's live half**

- Chosen source (1 / 2 / 3 above): \_\_\_\_\_
- If 2 or 3: acknowledged that the proof view cannot be verified against a real object until [2-gate-storage-credential](2-gate-storage-credential.md) clears **and** a booking with a real `proof_key` exists? \_\_\_\_\_

### 5. Is this database shared with anything the client cares about yet?

Phase 2 development will confirm, reject, and (from Phase 3) expire real rows. If web is already collecting real customer bookings against this database, the queue is production data on day one.

- Live customer data present? \_\_\_\_\_
- If yes, agreed working practice: \_\_\_\_\_

## Verification for row 3 — run it, read it, do not infer it

```bash
pnpm check:schema
# expect: exit 0, all assertions passing, including uniq_active_slot's uniqueness
# and the CHECK-literals set-equality against TIME_SLOTS.

pnpm check:setup
# The database half must pass. The storage half is 2-gate-storage-credential's
# problem, not this one — note which half failed rather than reading a red exit
# as this gate failing.
```

## Outcome — fill in during or immediately after

| Row                                          | Done | Evidence   |
| -------------------------------------------- | ---- | ---------- |
| 1 — same project ref, both on 6543           | ☐    | \_\_\_\_\_ |
| 2 — both migrations applied whole, in order  | ☐    | \_\_\_\_\_ |
| 3 — `check:schema` green, 10/10              | ☐    | \_\_\_\_\_ |
| 4 — at least one row, and where it came from | ☐    | \_\_\_\_\_ |

### Sign-off

- ☐ Complete, in order, verified at each row
- ☐ Complete with deviations — recorded above
- ☐ Blocked — reason recorded, Phase 2 stays unstarted

**Signed off by:** \_\_\_\_\_
**Date:** \_\_\_\_\_

## After this gate

Append the outcome to `docs/PROGRESS.md` here **and** in `arena-player-web` — its own docs still describe these migrations as unapplied, and its next session will read that. Annotate both [../schema-requests/004-bookings-on-supabase.md](../schema-requests/004-bookings-on-supabase.md) and [../schema-requests/006-time-slot-1h.md](../schema-requests/006-time-slot-1h.md) as applied. Then [2-step-01-queries](2-step-01-queries.md) starts.
