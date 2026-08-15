# 005 — `bookings`: nullable `proof_key`, and a fifth status

**Status:** requested
**Unblocks:** admin walk-in booking creation, and soft delete. Both are new scope and neither carries a phase number in [PRD.md](../PRD.md) yet — see the open items
**Requires of arena-player-web:** yes — a `src/domain/status.ts` change **authored there**, and an assumption web's own docs already record as debt. The domain half is order-critical; the `proof_key` half is not

## Why these two changes are one request

This is the only file in this folder that alters `bookings`. [README.md](README.md)'s first DDL rule says not to do that casually, and it is right: `uniq_active_slot` is the only race guard in the system and it sits on this table.

So the two changes are deliberately batched into **one request and one `begin;` / `commit;`** — not for tidiness. Every hand-run `alter table bookings` is a paste against the race-guard table by a human, in a web SQL editor, with no review between the clipboard and the database. Two migrations is two of those exposures for the same amount of work. One transaction, one execution, one signature.

The status half needs the transaction for a second, sharper reason. Postgres has no `alter constraint … check` — a CHECK cannot be widened in place, only dropped and re-added. `check:schema` reads constraints **by name**, so the replacement must reuse the name `status_valid`, which means there is a moment between the `drop` and the `add` in which **`bookings.status` is constrained by nothing at all**. Inside `begin;`/`commit;` nothing can observe that window. Pasted statement-by-statement — which is exactly what someone does when the editor complains about the wrapper — it is real, and it is the state in which a typo becomes a permanent row.

## (a) `proof_key` becomes nullable

Today the column is `text not null`, and web guaranteed it by uploading the proof to the bucket **before** inserting the row. This repo's [PROGRESS.md](../PROGRESS.md) 2026-08-12 lead entry records the conclusion drawn from that: _a booking without a proof cannot exist_. On the strength of it, the Phase 2 mockup's "Belum ada" cell, its disabled "Menunggu bukti" action, the `awaitingProof` flag and the `.proof-none` rule were all deleted as defects.

**They were deleted correctly, and they come back.** The reasoning has not reversed — its premise has. Two independent things moved:

1. **An admin taking a walk-in booking has no transfer screenshot.** The customer is standing at the field and pays there. There is nothing to upload, and [PRODUCT.md](../PRODUCT.md) forbids inventing one. A placeholder key is worse than a null: it points at no object, so every view of that booking renders the storage-failure state described in [2-step-05-proof.md](../tasks/2-step-05-proof.md), forever, and the admin is told to retry something that cannot succeed.
2. **Web has already broken the assumption from its own side.** `arena-player-web/src/modules/booking-form/BookingForm.tsx` sets `SHOW_PROOF_FIELD = false`, and `booking-form.schema.ts` now validates the proof _if one is present_ and requires it never. Web's `docs/database.md` lists this as debt item 3 — "`proof_key text not null` has nothing to point at" — and names exactly three resolutions: **the column becomes nullable**, the admin app supplies the value, or the field comes back.

This request is web's first option, raised from the other side. That framing matters: it is not the admin asking web to relax a guarantee for the admin's convenience. Two repos independently arrived at the same column.

**`phone` is deliberately not included**, even though web's database.md lists it as the identical debt with the identical three options. The options are not equally available. The admin genuinely learns a phone number from the WhatsApp chat and can write it; a walk-in customer is standing there to be asked. Nobody can produce a screenshot of a transfer that never happened. Widening `phone` needs its own argument and its own request — dropping a `not null` nobody explicitly asked for, inside a migration raised for a different reason, is how a constraint disappears without a decision.

### What null means, and what it must never collapse into

`proof_key is null` means **there is no proof, and there never was one** — a walk-in, paid at the field. It does not mean "not uploaded yet". Nothing in either repo writes a booking and attaches a proof afterwards, and no code should be written that assumes a null will later become a key.

Two states must stay visually and behaviourally distinct on `/bookings/[id]`:

| Row state                      | What the proof panel does                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `proof_key is null`            | States the absence. **No signing call is made** — there is no key to sign, and no failure to report |
| `proof_key` set, signing fails | The storage-failure state already specified in [2-step-05-proof.md](../tasks/2-step-05-proof.md)    |

Collapsing them puts a "muat ulang bukti" button in front of an admin whose booking has no proof to reload. That is the same misleading-recovery failure [2-gate-storage-credential.md](../tasks/2-gate-storage-credential.md) already names, arriving through a new door.

## (b) A fifth status, `deleted`

### What does NOT change: `uniq_active_slot`

Its predicate is the **active** set — `status in ('pending','confirmed')` — mirrored by `ACTIVE_STATUSES` in `src/domain/status.ts`. `deleted` is not active. It is therefore not in the predicate, **the index definition is not touched by this request at all**, and a deleted booking leaves the active set the instant its status flips, freeing its date+slot for rebooking. Which is precisely what a delete should do.

State that loudly, because the intuition runs the other way. "Adding a status" sounds like it must widen the guard, and [001](001-slot-blocks.md) rejected `status = 'blocked'` for exactly that reason. The difference is direction: `blocked` had to be **inside** the active set to hold a slot, `deleted` has to be **outside** it to release one. Only a status that must hold a slot forces the predicate open. This one does the opposite of forcing it open, and it does so by doing nothing.

`ACTIVE_STATUSES` is likewise unchanged, and must stay unchanged. It is the TypeScript mirror of that predicate; adding `deleted` to it would make the two disagree while the index kept its old meaning — the silent failure CLAUDE.md hard rule 4 exists to prevent.

### What does change: three things, and only three

1. **`status_valid`** — the CHECK constraint on `bookings`. Name confirmed against `src/server/required-schema.ts`, which asserts it as `kind: "enum-subset"`, `name: "status_valid"`, set-equal to `BOOKING_STATUSES`.
2. **`BOOKING_STATUSES`** in `src/domain/status.ts` — gains `'deleted'`, becoming five members.
3. **`toSlotStatus()`** — gains a case. `deleted` maps to **`available`**, the same arm as `rejected` and `expired`.

### The compile failure is the feature

`toSlotStatus` is a `switch` over `BookingStatus` with no `default` and no trailing `return`. Both repos are `"strict": true`. The moment a fifth member joins `BOOKING_STATUSES` and the switch does not name it, TypeScript reports that the function lacks an ending return statement and **web will not build**.

That is worth naming as a design property rather than an inconvenience. Compare the alternative: had that function been written `default: return "available"`, `deleted` would map correctly by accident and nobody in the web repo would ever be told that a fifth row state now exists. The exhaustive switch converts a schema change into a build break in the other repo — which, across two repos with one database, is the only reliable way to make a change arrive.

Two further detectors already exist and were not written for this:

- **`src/domain/status.test.ts:13`** asserts `BOOKING_STATUSES` **toEqual** the literal four-element array. Adding a member fails it, in both repos.
- The same file's invariant test loops over every member of `BOOKING_STATUSES` and asserts `toSlotStatus(s) === "available"` **iff** `!isActiveStatus(s)`. Because `deleted` is not in `ACTIVE_STATUSES`, that loop **already requires** the mapping this request specifies. It passes the moment `deleted → available` is written, and fails if anyone maps it to `booked`. The correct answer is enforced by a test that predates the question.

`status.test.ts` lives inside `src/domain/`, so it is in the byte-identical set and travels with `status.ts`. `pnpm check:unit` in **this** repo goes red on that same line until the copy arrives.

### The domain change is authored in web, and never here

CLAUDE.md hard rule 4, without exception. `src/domain/status.ts` is byte-identical with `arena-player-web` and read-only in this repo.

1. Author in `arena-player-web/src/domain/status.ts` and its test: add `'deleted'` to `BOOKING_STATUSES`, add the `case "deleted":` arm to `toSlotStatus`, update line 13's literal array. **Leave `ACTIVE_STATUSES` alone.**
2. Web builds and its tests pass.
3. Copy both files **byte-identical** into this repo at the same path.
4. `pnpm check:domain` green.

Editing this repo's copy first produces two files that differ, which `pnpm check:domain` catches — but only when someone runs it in an admin session with `ARENA_WEB_PATH` set. Authoring in the right place is the guarantee; the check is the backstop.

## DDL

```sql
-- db/migrations/<timestamp>_bookings_nullable_proof_and_deleted_status.sql
-- Requested by arena-player-admin (docs/schema-requests/005-admin-writes-bookings.md).
-- NOT ADDITIVE, and the only request in that folder that alters `bookings` —
-- the table uniq_active_slot sits on. Read the request before running this.
-- Run manually in the Supabase SQL editor. Never auto-applied.
--
-- ONE TRANSACTION, TWO CHANGES, ON PURPOSE. Each hand-run `alter table bookings`
-- is one exposure of the race-guard table; two migrations would be two exposures
-- for the same work. And the status change has no in-place form — Postgres has no
-- `alter constraint ... check` — so status_valid is dropped and re-added under the
-- SAME name, because check:schema reads constraints by name. BETWEEN THOSE TWO
-- STATEMENTS bookings.status IS CONSTRAINED BY NOTHING. Inside begin;/commit;
-- that window is unobservable. Pasted statement-by-statement it is real.
--
-- uniq_active_slot IS NOT TOUCHED, and must not be. Its predicate is the ACTIVE
-- set, 'pending','confirmed'. 'deleted' is not active, so a deleted booking
-- leaves that set on its own and frees its date+slot. Widening the predicate to
-- "help" would turn anti-double-booking off, silently, for both apps at once.
begin;

-- (a) A walk-in booking taken at the field has no transfer screenshot, and no
-- value may be fabricated to satisfy the constraint. arena-player-web's own
-- docs/database.md lists this column as debt item 3 and names "the column
-- becomes nullable" as one of its three resolutions; this is that resolution.
--
-- Dropping a NOT NULL cannot fail against existing rows: every row already
-- holds a value, and the constraint is only being relaxed.
alter table bookings
  alter column proof_key drop not null;

-- (b) The fifth row state. A soft-deleted booking stops counting, keeps its
-- history, and releases its slot.
--
-- Dropped and re-added rather than added ALONGSIDE under a new name: a second
-- constraint would leave the original four-value status_valid still rejecting
-- 'deleted', while check:schema — which asserts by name — reported green.
alter table bookings
  drop constraint status_valid;

-- The five literals are duplicated from src/domain/status.ts rather than
-- factored into a DOMAIN, for the same reason the eighteen slot strings are: a
-- DOMAIN needs `alter column type` on bookings, by hand, on the race-guard
-- table. Drift between the copies is caught by arena-player-admin's
-- `pnpm check:schema`, which reads these out of pg_get_constraintdef and
-- asserts set equality with BOOKING_STATUSES.
--
-- NOT VALID is deliberately not used. It would skip the scan of existing rows,
-- but the new set is a strict SUPERSET of the old one, so no existing row can
-- fail that scan — and a constraint left marked NOT VALID because nobody
-- remembered `validate constraint` is one the planner will not trust and a
-- reader will assume is enforced.
alter table bookings
  add constraint status_valid check (status in (
    'pending','confirmed','rejected','expired','deleted'
  ));

commit;
```

### Only if [002](002-booking-events.md) has already landed

`booking_events` duplicates the same status literals in two named CHECKs, and `check:schema` asserts both set-equal to `BOOKING_STATUSES`. If 002 landed **first**, this migration needs four more statements inside the same transaction, immediately before `commit;`:

```sql
alter table booking_events drop constraint booking_events_to_status_valid;
alter table booking_events add constraint booking_events_to_status_valid check (to_status in (
  'pending','confirmed','rejected','expired','deleted'
));
alter table booking_events drop constraint booking_events_from_status_valid;
alter table booking_events add constraint booking_events_from_status_valid check (from_status is null or from_status in (
  'pending','confirmed','rejected','expired','deleted'
));
```

If 002 lands **after** 005, it needs none of this — but its DDL must then be transcribed with the **five** literals, not the four printed in that file today. 002 carries the same warning on its own side. Getting this wrong is not subtle: the first soft delete raises a CHECK violation on the journal insert and the whole mutation rolls back.

## What changes in arena-player-web

**Half of this request costs web nothing, and half of it stops web's build.** They are worth separating, because a reader who sees "alters `bookings`" will assume both halves are dangerous.

### `proof_key` nullable — no web change required

Web does not `select` `proof_key` anywhere. The only two references in `arena-player-web/src/` are comments, at `booking-form.schema.ts:84` and `BookingForm.tsx:51`, both describing the constraint as debt. Web's insert keeps supplying the column exactly as it does today; a nullable column accepts a value.

What web must do is **stop writing the assumption down as a guarantee**. Its `docs/database.md` debt item 3 becomes resolved rather than pending, and any future read of `proof_key` must be typed `string | null` from the start. There is no deployment ordering here: the change is purely permissive, and nothing web does today can observe it.

### `deleted` — order-critical, and web breaks loudly

Web must add the fifth status to its own `src/domain/status.ts`, map it in `toSlotStatus`, and deploy. Until it does, web has no compile error, because nothing has changed in its tree — it has a **runtime hole**: a `'deleted'` string reaching that switch returns `undefined` while TypeScript's signature promises `SlotStatus`.

That hole is narrow but must not be waved away. Web's availability read filters on the active set by contract (see [001](001-slot-blocks.md) and web's own architecture docs), so `deleted` rows never reach `toSlotStatus` through that path. The rule is therefore stated as an ordering constraint rather than trusted to a filter that is not yet written code: **no `deleted` row is written until web's updated `status.ts` is deployed.**

### Deployment ordering

```
transcribe this DDL into web's db/migrations/
  →  web edits src/domain/status.ts + status.test.ts, builds, tests, DEPLOYS
  →  apply the DDL by hand in the Supabase SQL editor
  →  copy status.ts + status.test.ts byte-identical into this repo
  →  update src/server/required-schema.ts (proof_key nullable) IN THE SAME COMMIT
  →  pnpm check:domain, pnpm check:unit, pnpm check:schema — all green
  →  only then does anything here write 'deleted' or insert a null proof_key
```

**Expect red in the middle, and do not "fix" it.** `check:schema` asserts `status_valid` set-equal to `BOOKING_STATUSES`, so it fails whichever side moves first — five in the database against four in TypeScript, or four against five. It cannot tell "halfway through 005" from "drift", and it is not supposed to. The failure is resolved by finishing the sequence, never by editing one side to match the other.

## What arena-player-admin writes

**Soft delete**, carrying its own guard per CLAUDE.md hard rule 5:

```sql
update bookings
   set status = 'deleted'
 where id = $1
   and status in ('pending','confirmed','rejected','expired')
returning id, status;
```

The `where` is an explicit inclusion list rather than `status <> 'deleted'` so that a second delete of the same row returns zero rows and answers **409** — the row may have been deleted in another tab, or flipped by the expiry job between render and click. Same shape, same guard, same 409 as confirm and reject.

**Walk-in insert**, the first `insert` this repo has ever specified:

```sql
insert into bookings (booking_date, time_slot, team_name, phone, notes, proof_key, status)
values ($1, $2, $3, $4, $5, null, $6)
returning id;
```

`uniq_active_slot` owns the double-booking case. A collision raises `23505` and the route answers 409 — **insert, catch, respond, never check-then-insert.** The admin's slot picker showing a slot as free is a render-time observation, not a lock.

**The queue is unaffected by `deleted` without any code change.** `architecture.md`'s list query filters `b.status = any($1::text[])`, an inclusion list built from the UI's status filter, so a deleted row is absent unless a filter explicitly asks for it. **The detail read is not** — it is `where b.id = $1` with no status predicate, so `/bookings/[id]` will happily render a deleted booking to anyone holding the URL. That page needs a state, not a filter: a deleted booking is still a record, and hiding it behind a 404 loses the history the soft delete was chosen to keep.

## Verification

Changed in `src/server/required-schema.ts`, asserted by `pnpm check:schema`:

- `proof_key` flips from `nullable: false` to **`nullable: true`** in the `BOOKINGS` column list
- `status_valid` keeps its name, its `kind: "enum-subset"` shape and its `expectedLiterals: BOOKING_STATUSES` — the entry does **not** change, because `BOOKING_STATUSES` grew underneath it. That is the check working as designed: the expectation is expressed against the domain module, so widening the domain module is what re-points the assertion
- `uniq_active_slot`'s entry is untouched, including `wherePredicateContains: ACTIVE_STATUSES` — and it staying green is the assertion that matters most here. A migration that widened the predicate would fail it

Both edits land **in the same commit as the copied `status.ts`**, and after the SQL has been applied. Landing them earlier turns a green check red for a reason that has nothing to do with drift.

Runtime, before the migration lands: nothing degrades, because nothing in Phase 2's queue reads either change. Walk-in creation and soft delete are the features gated, and their actions return 503 through the same schema guard the other requests use. **The bookings console, confirm and reject are unaffected.**

## Open items

> **ASSUMPTION FLAGGED — phase.** Walk-in creation and soft delete are not in [PRD.md](../PRD.md)'s phase table. This file does not assign them one; it records what they need from the schema. Whoever scopes them owns the number, and the README's status column says `phase unassigned` until then.

> **DECIDED 2026-08-15 — a walk-in enters at `confirmed`.** The admin has already taken the cash, so there is nothing left to approve and no proof to wait for. Two consequences worth stating rather than rediscovering: the slot reads `booked` on the public site immediately, which is correct — it _is_ booked; and the Phase 3 expiry job never sees the row, which removes the hazard that made this question urgent. Expiry only touches `pending`, and it cannot distinguish a cash-paid walk-in from an abandoned online booking, so a walk-in entering `pending` would have had its slot released 24 hours later with the money already in the till.
>
> The insert keeps `status` parameterised rather than hardcoding the literal. The default is `confirmed`; the parameter exists so the decision lives in one call site that can be read, not scattered through a query.

> **RESOLVED 2026-08-15 — this repo now inserts.** [2-step-06-verification.md](../tasks/2-step-06-verification.md) and [2-gate-migration.md](../tasks/2-gate-migration.md) both stated as fact that "this repo may never `insert`" and reasoned from it. Both are now amended, and both reach the same conclusion by a better route: a walk-in carries a **null `proof_key`**, so it can verify the create flow but can never be the test data that unblocks step 05's live half. The original conclusion survives; only the reason it was true has changed.

> **ASSUMPTION FLAGGED — the premise of gate 6, question 5.** [6-gate-settings-and-expiry.md](../tasks/6-gate-settings-and-expiry.md) argues that `expired` releases a slot the customer already paid for, and its argument rests entirely on `proof_key NOT NULL` proving every pending booking carries a transferred DP. **This request removes that proof.** The question does not go away — it gets harder, because after 005 a pending booking may have a proof, or may be a walk-in with cash, and the row alone no longer says which. Raise it at the same client conversation rather than treating the gate as answered.
