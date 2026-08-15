# 002 — `booking_events`

**Status:** requested — **Phase 2 blocking**
**Unblocks:** admin Phase 2 (activity rail, "dikonfirmasi hari ini"), the activity-log export in the Ekspor screen, and **revenue by confirmation date** in Statistik/Ekspor
**Requires of arena-player-web:** yes — one write, added to the booking insert. Web's write is still not order-critical; **the table itself now is.** See below.

> **Amended 2026-08-15.** This request was raised for the activity rail and the log export, and recorded as "not deployment-order critical". One of those two statements has changed. It is now needed for a **second, unrelated feature** — the revenue charts — and because the journal **cannot be backfilled**, the table has to exist before the console starts confirming real bookings rather than whenever it is convenient. The web-repo half of the ordering argument is unchanged and still correct; only the table's own timing moved. The amendment also carries the interaction with [005](005-admin-writes-bookings.md), which adds a fifth status this table's CHECK constraints have to know about.

## Why

Four things the admin app displays cannot be computed from the current schema, and they all fail for the same reason: **`bookings` records when a row was created and nothing else.** There is no `updated_at`, no `confirmed_at`, no history.

| What is displayed                                                              | What it needs                     | Today                                                  |
| ------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------ |
| "Dikonfirmasi hari ini" on the dashboard                                       | when a status became `confirmed`  | uncomputable                                           |
| "Aktivitas terbaru" rail, with relative times                                  | an ordered feed of status changes | uncomputable                                           |
| "Log aktivitas" dataset in the Ekspor screen — _siapa, kapan, dari apa ke apa_ | the same feed, exportable         | the export offers a file that cannot be produced       |
| **Revenue plotted over time** in Statistik and the "Rekap pendapatan" dataset  | when a booking became `confirmed` | uncomputable — the chart can only lie about its x-axis |

### The revenue axis, stated exactly

[003](003-site-settings.md) supplies the **amount**: DP collected is `dp_percent` of the slot's rate, over `confirmed` bookings only. It supplies no date. `bookings` offers two, and **neither of them is when the money landed**:

| Column         | What it actually means                   | Why it is the wrong x-axis for revenue                                 |
| -------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| `booking_date` | the day the slot is **played**           | A booking taken in March for a match in May puts March's income in May |
| `created_at`   | when the customer **submitted** the form | Money the admin has not accepted yet, and may still reject             |

There is no `confirmed_at`, so without this table revenue can only be plotted by when the slot is played — never by when the DP was actually accepted. A monthly income figure built on `booking_date` is not approximately right; it is a different quantity with the same units, and it is the quantity the client will read as their earnings.

### And the journal cannot be backfilled

This is the part that moved 002 from "ship whenever" to blocking. `booking_events` is derived from nothing — there is no timestamp anywhere in `bookings` from which a past confirmation can be reconstructed. **Every booking confirmed before this table exists is permanently invisible to revenue-by-confirmation-date and to the activity log.** Not degraded, not approximate: absent, for the life of the database.

That makes the cost of landing it late strictly increasing, and unrecoverable. The table is cheap, additive, and touches nothing that already works, so there is no reason to accept a hole in the first weeks of real trading in exchange for nothing.

**Rejected first: `alter table bookings add column updated_at`.** It answers only the first row of that table. A single timestamp cannot say what the status changed _from_, cannot say _who_ changed it, and is overwritten by the next change — so the export and the feed stay impossible. It also means an `alter` on the one table `uniq_active_slot` sits on, which the rules in [README.md](README.md) discourage for exactly this kind of convenience.

An append-only journal answers all three, and touches nothing that already works.

**This table is not a second source of truth for status.** `bookings.status` stays authoritative; nothing reconstructs current state by replaying events. The journal records what happened, the row records what is.

## DDL

```sql
-- db/migrations/<timestamp>_create_booking_events.sql
-- Requested by arena-player-admin (docs/schema-requests/002-booking-events.md).
-- ADDITIVE ONLY: bookings, status_valid and uniq_active_slot are not touched.
-- Run manually in the Supabase SQL editor. Never auto-applied.
--
-- Wrapped in a transaction for the same reason the bookings migration is: a paste
-- that fails halfway must not leave the table created WITHOUT its indexes, which
-- would turn the activity rail into a sequential scan of the whole journal on
-- every dashboard render and hide the mistake behind "it works".
begin;

create table booking_events (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,

  -- NULL only for the row written when the booking is first created: there is
  -- no status it moved away from. Every later row has both ends, which is what
  -- makes the export's "dari apa ke apa" column possible.
  from_status text,
  to_status   text not null,

  -- A role, not a person. This system has one admin account and no user table,
  -- so identity beyond the role does not exist yet; when a second account is
  -- added this is the column that grows, and no other table has to change.
  --   customer — wrote the booking on the public site
  --   admin    — acted in the back office
  --   system   — the expiry cron in arena-player-admin
  actor text not null,

  created_at timestamptz not null default now(),

  -- The same four literals as bookings.status_valid and src/domain/status.ts.
  -- Deliberately duplicated rather than factored into a DOMAIN, for the same
  -- reason 001 duplicates the nine slot strings: a DOMAIN needs an ALTER on
  -- bookings.status by hand. Drift between the copies is caught by
  -- arena-player-admin's `pnpm check:schema`, which reads these literals out of
  -- pg_get_constraintdef and asserts set equality with BOOKING_STATUSES.
  --
  -- FIVE, NOT FOUR, IF 005 HAS ALREADY LANDED. See the note under this block
  -- before transcribing: BOOKING_STATUSES is what these must equal, and 005
  -- adds 'deleted' to it.
  constraint booking_events_to_status_valid check (to_status in (
    'pending','confirmed','rejected','expired'
  )),
  constraint booking_events_from_status_valid check (from_status is null or from_status in (
    'pending','confirmed','rejected','expired'
  )),

  constraint booking_events_actor_valid check (actor in ('customer','admin','system')),

  -- A row that claims nothing changed is noise in an audit trail, and usually a
  -- bug in the caller rather than a real event.
  constraint booking_events_moved check (from_status is null or from_status <> to_status)
);

-- One booking's history, oldest first. Also the FK's supporting index.
create index booking_events_booking_idx on booking_events (booking_id, created_at);

-- The dashboard's activity rail and the "dikonfirmasi hari ini" count both read
-- a recent time window across all bookings.
create index booking_events_recent_idx on booking_events (created_at desc);

commit;
```

### Interaction with [005](005-admin-writes-bookings.md), which must be checked before transcribing

005 widens `bookings.status_valid` to five literals by adding `'deleted'`, and `check:schema` asserts **both** of this table's status CHECKs set-equal to `BOOKING_STATUSES`. So the two requests cannot be transcribed independently:

| Landing order   | What to do                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **005 first**   | Transcribe the two CHECKs above with **five** literals, `'deleted'` included. Nothing else in this file changes                           |
| **002 first**   | 005's migration gains four `alter table booking_events` statements, inside its own transaction. They are written out in 005's DDL section |
| **Neither yet** | Land 005 first. It is one transaction against a table that already exists; the alternative is two migrations touching this one            |

Getting it wrong is not subtle, and it is not silent either: the first soft delete raises a CHECK violation on the journal insert, the whole mutation rolls back, and the booking stays undeleted. Loud — but loud in production rather than at transcription time, which is why it is a table here.

## What changes in arena-player-web

One statement. Web writes the `customer` event when a booking is created.

```sql
with inserted as (
  insert into bookings (booking_date, time_slot, team_name, phone, notes, proof_key)
  select $1, $2, $3, $4, $5, $6
  returning id, status
)
insert into booking_events (booking_id, from_status, to_status, actor)
select id, null, status, 'customer' from inserted
returning booking_id;
```

**One statement, so the journal cannot disagree with the table.** A separate insert afterwards can fail on its own and leave a booking with no origin row.

**This composes with [001](001-slot-blocks.md).** If both land, the `select` inside `inserted` also carries 001's `where not exists (select 1 from slot_blocks …)` guard. Order of landing does not matter; the two changes touch different parts of the same statement.

### Deployment ordering: none required **for web's write**

Unlike 001, nothing breaks if web ships this late. Without web's write, the journal simply starts at the first admin action instead of at creation — the export, the rail and the daily count all still work, they just do not show the "booking masuk" event. Revenue is untouched by it either way: a `customer` origin event carries no money, only a confirmation does. **Degraded, not wrong.**

**The table's own timing is a different question, and the amendment changed the answer.** "Not order-critical" was written about web, and it was read as "this can wait" about everything. It cannot: the journal is not backfillable, so the table must exist before the console confirms its first real booking, or that booking's revenue has no date forever. The gate is not on `arena-player-web` — it is on this migration landing before Phase 2 goes live.

### What arena-player-admin writes

Every status mutation becomes one statement, keeping the guard that already exists:

```sql
-- confirm
with updated as (
  update bookings set status = 'confirmed'
   where id = $1 and status = 'pending'
  returning id, 'pending'::text as from_status, status as to_status
)
insert into booking_events (booking_id, from_status, to_status, actor)
select id, from_status, to_status, 'admin' from updated
returning booking_id, to_status;
```

Zero rows returned still means the row was already actioned, and still answers **409** — see [architecture.md](../architecture.md). The expiry job writes the same shape with `actor = 'system'`, one event per row it flips, and 005's soft delete writes it with `to_status = 'deleted'`.

### And what the revenue read looks like

```sql
-- Every DP accepted in a window, dated by when it was ACCEPTED.
select e.created_at::date as confirmed_on, b.booking_date, b.time_slot
  from booking_events e
  join bookings b on b.id = e.booking_id
 where e.to_status = 'confirmed'
   and e.created_at >= $1 and e.created_at < $2;
```

The amount is not in this statement, on purpose. It comes from `rate_card` via the day-type and DP functions in `src/domain/pricing.ts` ([003](003-site-settings.md)), so the arithmetic stays in the one place both repos share rather than being duplicated into SQL that only this repo runs.

**Two properties of that query are load-bearing.** It reads `to_status = 'confirmed'` rather than `b.status = 'confirmed'`, so a booking confirmed in March and later refunded, rejected or soft-deleted still shows the March income it genuinely produced — the journal records what happened, the row records what is, and revenue is a question about what happened. And a booking confirmed twice cannot exist, because `booking_events_moved` rejects a no-op transition and the confirm mutation's own `where status = 'pending'` guard returns zero rows the second time.

**No third index is added for this.** `booking_events_recent_idx` on `(created_at desc)` already covers a time window, and `architecture.md` settled the scale question at max 126 active rows — a few thousand journal rows a year does not earn a partial index on `to_status`, and one added "for the chart" is one nobody will ever measure.

## Verification

Added to `src/server/required-schema.ts`, asserted by `pnpm check:schema`:

- `booking_events` exists, with columns `id`, `booking_id`, `from_status`, `to_status`, `actor`, `created_at` at the expected types, and `from_status` **nullable** while `to_status` is not
- the FK on `booking_id` references `bookings (id)` and is `on delete cascade`
- `booking_events_to_status_valid` and `booking_events_from_status_valid` exist, and their literals read out of `pg_get_constraintdef` are **set-equal to `BOOKING_STATUSES`** from `src/domain/status.ts`. The assertion is written against the domain module rather than a copied list, so [005](005-admin-writes-bookings.md) growing `BOOKING_STATUSES` re-points it automatically — and turns it red against a four-literal database, which is the intended detector for the transcription mistake in the table above
- `booking_events_actor_valid` exists with exactly `customer`, `admin`, `system`
- `booking_events_moved` exists
- `booking_events_booking_idx` and `booking_events_recent_idx` exist

Runtime, before the migration lands: `src/server/schema-guard.ts` returns false for `booking_events`; the dashboard's activity rail and daily-confirmed count render their missing-migration state naming this file, the Ekspor screen disables the "Log aktivitas" dataset with the same reason, and **any revenue chart with a time axis is hidden rather than plotted against `booking_date`**. A chart drawn on the wrong date column looks correct, cannot be spotted by inspection, and is the failure this table exists to prevent — falling back to it is worse than showing nothing.

**The bookings console and the confirm/reject actions are unaffected** — they need nothing from this table, and the mutation falls back to the plain `update` above until it lands. That fallback is what makes the console shippable ahead of this migration; it is **not** a reason to ship it ahead, because every confirmation taken through the fallback is a confirmation with no recoverable date.
