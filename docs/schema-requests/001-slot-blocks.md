# 001 — `slot_blocks`

**Status:** requested
**Unblocks:** admin Phase 4 — manual slot blocking
**Requires of arena-player-web:** yes — a read change and a write change, both below. **Deployment order is not negotiable**; see [4-gate-blocks.md](../tasks/4-gate-blocks.md).

## Why

The admin needs to take a date+slot off the market without inventing a fake booking: rain, maintenance, or a booking taken over the phone that never went through the site.

**Rejected first: reusing `bookings` with `status = 'blocked'`.** It would require widening `status_valid`, widening `uniq_active_slot`'s `WHERE` clause, putting junk values into three `NOT NULL` columns (`team_name`, `phone`, `proof_key`), and adding a fifth row-state to the API status-mapping table that `arena-player-web/docs/architecture.md:47-57` marks **FIRM**.

Touching the partial unique index that is the only race guard in the system, in order to add a maintenance feature, is a bad trade. A separate additive table costs one migration and touches nothing that already works.

## DDL

```sql
-- db/migrations/<timestamp>_create_slot_blocks.sql
-- Requested by arena-player-admin (docs/schema-requests/001-slot-blocks.md).
-- ADDITIVE ONLY: bookings and uniq_active_slot are not touched.
-- Run manually in the Neon SQL editor. Never auto-applied.
--
-- Wrapped in a transaction for the same reason the bookings migration is: a paste
-- that fails halfway must not leave the table created WITHOUT uniq_slot_block,
-- which would let the same slot be blocked twice and make unblocking ambiguous.
begin;

create table slot_blocks (
  id         uuid primary key default gen_random_uuid(),
  block_date date not null,
  time_slot  text not null,
  reason     text,
  created_at timestamptz not null default now(),

  -- The same nine literals as bookings.time_slot_canonical and src/domain/slots.ts.
  -- Deliberately duplicated rather than factored into a DOMAIN: a DOMAIN would
  -- require altering bookings.time_slot's type by hand, which is a destructive
  -- change to the one table the entire race guard sits on. Drift between the
  -- copies is caught by arena-player-admin's `pnpm check:schema`, which reads
  -- this constraint's literals out of pg_get_constraintdef and asserts set
  -- equality with TIME_SLOTS.
  constraint slot_blocks_time_slot_canonical check (time_slot in (
    '06.00 - 08.00','08.00 - 10.00','10.00 - 12.00','12.00 - 14.00','14.00 - 16.00',
    '16.00 - 18.00','18.00 - 20.00','20.00 - 22.00','22.00 - 24.00'
  )),

  constraint slot_blocks_reason_length check (reason is null or length(reason) <= 200)
);

-- One block per date+slot. Not partial: a block has no lifecycle, it exists or it
-- does not, so unblocking is a DELETE rather than a status change.
create unique index uniq_slot_block on slot_blocks (block_date, time_slot);

commit;
```

No index beyond the unique one. The availability read filters on `block_date = $1`, which `uniq_slot_block` already covers as its leading column.

## What changes in arena-player-web

Two statements. Both are in `arena-player-web`, both must be **deployed** before any blocking UI ships here.

### 1. The availability read unions the new table

```sql
select time_slot from bookings
 where booking_date = $1 and status in ('pending','confirmed')
union
select time_slot from slot_blocks where block_date = $1;
```

Blocked slots map to the existing API status **`booked`**. No new API status, no new client-side rendering, and the FIRM "always nine entries, always canonical order" contract survives untouched.

### 2. The booking insert gains a guard, inside the statement

```sql
insert into bookings (booking_date, time_slot, team_name, phone, notes, proof_key)
select $1, $2, $3, $4, $5, $6
 where not exists (select 1 from slot_blocks where block_date = $1 and time_slot = $2)
returning id, status;
```

Zero rows returned → 409, with copy distinguishing a blocked slot from a taken one.

**This is not check-then-insert.** There is no separate read: the guard lives in the INSERT's own `WHERE`, evaluated in the same statement, and `uniq_active_slot` still owns booking-versus-booking exclusion exactly as before. The rule the web repo's hard rule 1 forbids is _reading, deciding in application code, then inserting_ — this does neither.

### The remaining hole, stated rather than engineered away

An admin blocking a slot in the same instant a customer submits a booking for it can produce both a block and a booking. The window is milliseconds and the resolution is social: the admin sees the booking in the queue and rejects it. Closing it properly would need a trigger or a serialised transaction across two tables, for a scenario that costs one rejection.

### Deployment ordering

```
this DDL transcribed into web's db/migrations/
  →  applied by hand in the Neon SQL editor
  →  check:schema green in arena-player-admin
  →  web deploys BOTH statements above
  →  only then does the blocking UI ship here
```

**A block this app writes that web does not read is a silent no-op** — the admin marks a slot closed, customers keep booking it, and nothing anywhere reports a problem. That is the exact failure class this project exists to avoid, which is why the ordering is a gate with a human signature and not a step with a checklist.

## Verification

Added to `src/server/required-schema.ts`, asserted by `pnpm check:schema`:

- `slot_blocks` exists, with columns `id`, `block_date`, `time_slot`, `reason`, `created_at` at the expected types
- `uniq_slot_block` exists and is **unique** on `(block_date, time_slot)`
- `slot_blocks_time_slot_canonical` exists, and its literals read out of `pg_get_constraintdef` are **set-equal to `TIME_SLOTS`** from `src/domain/slots.ts`
- `slot_blocks_reason_length` exists

Runtime, before the migration lands: `src/server/schema-guard.ts` returns false for `slot_blocks`, `/blocks` renders the migration-missing error naming this file, and the block/unblock actions return 503. **The bookings console is unaffected** — Phase 2 needs nothing from this table.
