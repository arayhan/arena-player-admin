# Phase 2 entry — `bookings` exists in the database this app connects to

**Decided by:** the user, applying web's migration by hand in the Neon SQL editor. The developer verifies.
**Blocks:** all of Phase 2, and therefore Phases 3–5. No step file below this one can be verified until it clears
**Status:** not yet held — verified 2026-08-13, `pnpm check:schema` connects successfully and **10/10 assertions fail** with "table was not found in the public schema"
**Format:** a sequence, verified at each row. Not a meeting
**Date completed:** \_\_\_\_\_

## Where things actually stand

`../arena-player-web/db/migrations/20260809_create_bookings.sql` **exists and has never been applied.** `DATABASE_URL` here reaches Neon — the connection is fine, the credentials are fine, the database is empty of this table.

[PRD.md](../PRD.md) names `check:schema` going green as the Phase 2 entry gate in as many words: _"Blocked on web Phase 4. Not on its UI — on the migration being applied. `check:schema` is how that is confirmed, not a conversation."_

## Why this is a gate and not a checklist line inside step 01

Two reasons, and the second is the one that matters.

**One:** no agent can do it. This repo never owns a migration (hard rule 1) and has no path to the Neon SQL editor. The actor is a human with a browser.

**Two — the silent half.** The migration is wrapped in `begin;` / `commit;` **on purpose**, and its own comments say why: a paste that fails halfway must not leave `bookings` created _without_ `uniq_active_slot`. That index is the only anti-double-booking guard in the entire system. A table created without it works perfectly, throws nothing, passes every screen in this app, and lets the public site sell one slot twice — forever, silently. Pasting statement-by-statement, or dropping the transaction wrapper because the editor complained about it, produces exactly that.

`pnpm check:schema` catches it (it asserts `uniq_active_slot` is present _and_ unique). A checklist inside a step file can be ticked by someone who ran the app and saw rows. A signature against a named row cannot.

## The sequence — each row must be true before the next is attempted

| #   | Step                                                                                                    | Who       | Verified by                                                      |
| --- | ------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| 1   | Confirm which Neon database/branch `DATABASE_URL` here points at, and that web's `DATABASE_URL` matches | user      | host + database name compared between the two `.env.local` files |
| 2   | The **entire file** pasted into the Neon SQL editor in one go, `begin;` through `commit;`, and executed | user      | the editor reports success, not a partial run                    |
| 3   | `pnpm check:schema` green here — all 10 assertions                                                      | admin     | the command, output read                                         |
| 4   | At least one real `bookings` row exists to work against                                                 | see below | `select count(*) from bookings` > 0                              |

**Row 1 is the one nobody checks.** Two Neon branches — one for web's dev, one pasted into this repo's `.env.local` — produce an admin app that confirms bookings the public site will never see, and a public site whose bookings never reach the queue. Both apps work. Nothing errors. The whole product is a no-op. Compare the two connection strings before anything else; the host must contain `-pooler` in both (see [database.md](../database.md) gotcha 3).

**Row 4 is not optional and has a trap in it.** This repo may **never** `insert` (see [database.md](../database.md), "What this repo may do"), so it cannot create its own test data. Three ways to get a row, in descending order of usefulness:

1. **Make a booking on the public site running locally.** Best by a distance: it exercises web's real insert path, produces a `phone` already normalised to `628…`, and — critically — uploads a real object to R2, so `proof_key` points at something that actually exists. That is the only source of test data that also unblocks [2-step-05-proof](2-step-05-proof.md)'s live half.
2. Hand-written `insert` in the Neon SQL editor by the user. Fast, but `proof_key` is `not null` and whatever string is put there will 404 in the proof view.
3. Nothing — build against an empty table. Legitimate for step 01 and the empty states, useless for everything after.

## Questions that must not be left unasked

### 1. Same database as web? — **BLOCKS everything**

- Host of admin's `DATABASE_URL` (no credentials, just host + db name): \_\_\_\_\_
- Host of web's `DATABASE_URL`: \_\_\_\_\_
- Identical? \_\_\_\_\_ · Both contain `-pooler`? \_\_\_\_\_

### 2. Was the file pasted whole, transaction wrapper included? — **BLOCKS row 3**

- Pasted `begin;` … `commit;` in one execution? \_\_\_\_\_
- If not, what was run and in what order: \_\_\_\_\_
- `uniq_active_slot` present **and unique**? \_\_\_\_\_ _(`check:schema` asserts this; read its output, do not infer it from the table existing)_
- `bookings_pending_expiry_idx` present? \_\_\_\_\_ _(Phase 3's expiry UPDATE relies on it)_

### 3. Were the nine slot literals edited? — **BLOCKS row 3**

The `time_slot_canonical` CHECK duplicates the nine canonical strings deliberately rather than factoring them into a Postgres `DOMAIN`; the reasoning is in the migration's own comments and in [architecture.md](../architecture.md). A "tidied" paste that reformats or reorders them breaks nothing visibly and breaks `uniq_active_slot`'s text comparison against `src/domain/slots.ts` permanently.

- Transcribed without edits, comments included? \_\_\_\_\_
- `check:schema`'s CHECK-literals-vs-`TIME_SLOTS` set equality assertion passes? \_\_\_\_\_

### 4. Where does test data come from? — **BLOCKS row 4, and step 05's live half**

- Chosen source (1 / 2 / 3 above): \_\_\_\_\_
- If 2 or 3: acknowledged that the proof view cannot be verified against a real object until [2-gate-r2-token](2-gate-r2-token.md) clears **and** a booking with a real `proof_key` exists? \_\_\_\_\_

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
# Neon half must pass. The R2 half is 2-gate-r2-token's problem, not this one —
# note which half failed rather than reading a red exit as this gate failing.
```

## Outcome — fill in during or immediately after

| Row                                          | Done | Evidence   |
| -------------------------------------------- | ---- | ---------- |
| 1 — same database, both pooled               | ☐    | \_\_\_\_\_ |
| 2 — migration applied whole                  | ☐    | \_\_\_\_\_ |
| 3 — `check:schema` green, 10/10              | ☐    | \_\_\_\_\_ |
| 4 — at least one row, and where it came from | ☐    | \_\_\_\_\_ |

### Sign-off

- ☐ Complete, in order, verified at each row
- ☐ Complete with deviations — recorded above
- ☐ Blocked — reason recorded, Phase 2 stays unstarted

**Signed off by:** \_\_\_\_\_
**Date:** \_\_\_\_\_

## After this gate

Append the outcome to `docs/PROGRESS.md` here **and** in `arena-player-web` — its own docs still describe this migration as unapplied, and its next session will read that. Then [2-step-01-queries](2-step-01-queries.md) starts.
