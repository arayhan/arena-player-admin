# docs/schema-requests/

This repo needs schema changes it is not allowed to make. This folder is the protocol for getting one from here into the database, and the record that it happened.

**The rule it exists to serve:** `arena-player-web` owns `db/migrations/`. This repo reads the schema and never alters it. Two repos migrating one database is a conflict with no owner to resolve it.

## The protocol

| Question                                   | Answer                                                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where does the SQL live                    | `arena-player-web/db/migrations/<timestamp>_<slug>.sql`. One location, no exceptions                                                                                                              |
| Who writes it                              | This repo _authors_ it as a request file here — the exact DDL, the feature it unblocks, and what changes in web                                                                                   |
| How does it get there                      | A human transcribes it **verbatim** into web's `db/migrations/`, commits it there, and comes back to annotate this file `LANDED AS db/migrations/<file>`                                          |
| Who applies it                             | The user, by hand, in the Supabase SQL editor, in the project **both** apps connect to. No agent, no boot-time DDL, no MCP, no CLI                                                                |
| How does this repo know it landed          | `pnpm check:schema`. Not a conversation, not a checkbox                                                                                                                                           |
| What happens at runtime if it did not land | The feature's page renders a loud error naming the exact file; its mutating routes return 503. The bookings console is unaffected — see the schema guard in [architecture.md](../architecture.md) |

**Verbatim means verbatim.** Do not "clean up" the SQL while transcribing. The comments in these files carry the reasoning for constraints that look redundant and are not.

Once a request is annotated `LANDED`, it is historical. Nothing in this repo reads it at build time or run time; `src/server/required-schema.ts` is the machine-readable expectation, and web's migration file is the authority.

## File format

`NNN-<slug>.md`, three-digit ordinal, in request order.

````markdown
# NNN — <title>

**Status:** requested | LANDED AS db/migrations/<file> | withdrawn
**Unblocks:** <admin phase / feature>
**Requires of arena-player-web:** <read changes web must make, or "none">

## Why

<what the feature needs and what was rejected>

## DDL

```sql
...
```
````

## What changes in arena-player-web

<the reads or writes web must add, and the deployment ordering>

## Verification

<the check:schema assertions this adds>
```

## Rules for the DDL itself

- **Additive only, unless there is no alternative.** Never `alter` `bookings` casually. `uniq_active_slot` is the only race guard in the system; a migration that widens its predicate, or changes `time_slot`'s type, is a migration that can silently turn off anti-double-booking. [005](005-admin-writes-bookings.md) is the worked example of the exception: it alters `bookings` twice, in one transaction, and opens by arguing why each change had no additive form and why the guard's predicate stays exactly as it is.
- **Wrap in `begin;` / `commit;`.** A paste that fails halfway must not leave a table created _without_ its unique index. This is the reason web's own migration is wrapped, and it applies to every request here.
- **Name every constraint.** `check:schema` reads constraints by name; an anonymous constraint is one it cannot assert on.
- **Repeat the nine canonical slot strings rather than factoring them out.** A Postgres `DOMAIN` would deduplicate them and needs `alter column type` on `bookings` — a hand-run destructive change to the one table the race guard sits on. Duplicate the literal and let `check:schema` detect the drift.
- **Say what web must read.** A table this repo writes and web never reads is a silent no-op, which is the failure class this project exists to avoid. If web must read it, the deployment ordering goes in a gate file, not a step.

## Current requests

| #                                   | Title                                                                         | Status                           |
| ----------------------------------- | ----------------------------------------------------------------------------- | -------------------------------- |
| [001](001-slot-blocks.md)           | `slot_blocks` — one-off date+slot blocking                                    | requested (Phase 4)              |
| [002](002-booking-events.md)        | `booking_events` — the activity rail, the log export, revenue by confirmation | requested (**Phase 2 blocking**) |
| [003](003-site-settings.md)         | `site_settings`, `site_rules`, `rate_card`, `bank_accounts` — Pengaturan      | requested (Phase 2)              |
| [004](004-bookings-on-supabase.md)  | `bookings` — web's existing migration, applied on Supabase                    | requested (Phase 2)              |
| [005](005-admin-writes-bookings.md) | `bookings` — nullable `proof_key`, and a fifth status `deleted`               | requested (phase unassigned)     |

**004 authors no DDL.** It records that web's already-written `bookings` migration has to be applied verbatim in the Supabase SQL editor now that the project has moved off Neon, and that both repos must point at the same Supabase project. A provider move is not a schema change, but "who applies the unapplied migration, and where" is exactly the question this folder exists to keep from falling between two repos.

**005 is the only request that alters `bookings`**, and the only one that is not additive. It carries its own argument for why the first DDL rule below permits it, why its two changes share one transaction, and why `uniq_active_slot` is not touched despite a fifth status arriving. Read that file before running it; do not treat it as ordinary.

**Two orderings are not free choices:**

- **002 and 005 both own the same status literals.** 005 adds `'deleted'` to `BOOKING_STATUSES`, and `check:schema` asserts `booking_events`' two status CHECKs set-equal to it. Land **005 first** and transcribe 002 with five literals; if 002 lands first, 005's migration gains four `alter table booking_events` statements, written out in its DDL section.
- **003 is order-critical for two of its five values, and only two.** The WhatsApp number and the Ketentuan are hardcoded in `arena-player-web` today, so an admin editing them before web reads them produces a value that looks saved and is silently stale. The address, the Maps embed and the bank accounts are visible `menyusul` placeholders — a blank is safe, a confidently wrong value is not. The full table is in that file.

**002's "not deployment-order critical" was about web, not about the table.** `booking_events` cannot be backfilled — `bookings` holds no `confirmed_at` to reconstruct from — so every booking confirmed before that migration lands is permanently absent from the activity log and from revenue-by-confirmation-date. It moved to Phase-2 blocking for that reason, not because web's write became urgent.

## Sketched, not requested

**`slot_closures`** — recurring weekly closures, keyed `(day_of_week, time_slot)` using only the existing nine canonical slots, where an empty table means fully open. It is the reshaped survivor of the descoped operating-hours config ([PRD.md](../PRD.md)), and it carries **no contract change**: the availability API still returns nine entries, some of them just come back `booked`.

It is not requested because the client has confirmed 06.00–24.00 every day, so it would ship as an empty table behind a config screen with nothing to configure. Ask whether they ever close on a recurring basis first. If the answer is yes, the DDL is:

```sql
begin;
create table slot_closures (
  id          uuid primary key default gen_random_uuid(),
  day_of_week smallint not null,   -- 0=Sunday..6=Saturday; matches extract(dow) AND JS getDay()
  time_slot   text not null,
  created_at  timestamptz not null default now(),
  constraint slot_closures_dow_valid check (day_of_week between 0 and 6),
  constraint slot_closures_time_slot_canonical check (time_slot in (
    '06.00 - 08.00','08.00 - 10.00','10.00 - 12.00','12.00 - 14.00','14.00 - 16.00',
    '16.00 - 18.00','18.00 - 20.00','20.00 - 22.00','22.00 - 24.00'
  ))
);
create unique index uniq_slot_closure on slot_closures (day_of_week, time_slot);
commit;
```

The `0=Sunday` choice is load-bearing: it matches both Postgres `extract(dow)` and JavaScript `getDay()`, so no translation layer is needed on either side. ISO weekday numbering would need one, and a translation layer is a place for an off-by-one to live.
