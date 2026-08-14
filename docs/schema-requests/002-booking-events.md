# 002 — `booking_events`

**Status:** requested
**Unblocks:** admin Phase 2 (activity rail, "dikonfirmasi hari ini") and the activity-log export in the Ekspor screen
**Requires of arena-player-web:** yes — one write, added to the booking insert. Not order-critical; see below.

## Why

Three things the admin app displays cannot be computed from the current schema, and they all fail for the same reason: **`bookings` records when a row was created and nothing else.** There is no `updated_at`, no `confirmed_at`, no history.

| What is displayed                                                              | What it needs                     | Today                                            |
| ------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------ |
| "Dikonfirmasi hari ini" on the dashboard                                       | when a status became `confirmed`  | uncomputable                                     |
| "Aktivitas terbaru" rail, with relative times                                  | an ordered feed of status changes | uncomputable                                     |
| "Log aktivitas" dataset in the Ekspor screen — _siapa, kapan, dari apa ke apa_ | the same feed, exportable         | the export offers a file that cannot be produced |

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

### Deployment ordering: none required

Unlike 001, nothing breaks if web ships this late. Without web's write, the journal simply starts at the first admin action instead of at creation — the export, the rail and the daily count all still work, they just do not show the "booking masuk" event. **Degraded, not wrong.** Nobody should treat this as a blocker on the admin console.

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

Zero rows returned still means the row was already actioned, and still answers **409** — see [architecture.md](../architecture.md). The expiry job writes the same shape with `actor = 'system'`, one event per row it flips.

## Verification

Added to `src/server/required-schema.ts`, asserted by `pnpm check:schema`:

- `booking_events` exists, with columns `id`, `booking_id`, `from_status`, `to_status`, `actor`, `created_at` at the expected types, and `from_status` **nullable** while `to_status` is not
- the FK on `booking_id` references `bookings (id)` and is `on delete cascade`
- `booking_events_to_status_valid` and `booking_events_from_status_valid` exist, and their literals read out of `pg_get_constraintdef` are **set-equal to `BOOKING_STATUSES`** from `src/domain/status.ts`
- `booking_events_actor_valid` exists with exactly `customer`, `admin`, `system`
- `booking_events_moved` exists
- `booking_events_booking_idx` and `booking_events_recent_idx` exist

Runtime, before the migration lands: `src/server/schema-guard.ts` returns false for `booking_events`; the dashboard's activity rail and daily-confirmed count render their missing-migration state naming this file, and the Ekspor screen disables the "Log aktivitas" dataset with the same reason. **The bookings console and the confirm/reject actions are unaffected** — they need nothing from this table, and the mutation falls back to the plain `update` above until it lands.
