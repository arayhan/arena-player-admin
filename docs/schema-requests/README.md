# docs/schema-requests/

This repo needs schema changes it is not allowed to make. This folder is the protocol for getting one from here into the database, and the record that it happened.

**The rule it exists to serve:** `arena-player-web` owns `db/migrations/`. This repo reads the schema and never alters it. Two repos migrating one database is a conflict with no owner to resolve it.

## The protocol

| Question                                   | Answer                                                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where does the SQL live                    | `arena-player-web/db/migrations/<timestamp>_<slug>.sql`. One location, no exceptions                                                                                                              |
| Who writes it                              | This repo _authors_ it as a request file here — the exact DDL, the feature it unblocks, and what changes in web                                                                                   |
| How does it get there                      | A human transcribes it **verbatim** into web's `db/migrations/`, commits it there, and comes back to annotate this file `LANDED AS db/migrations/<file>`                                          |
| Who applies it                             | The user, by hand, in the Neon SQL editor. No agent, no boot-time DDL, no MCP                                                                                                                     |
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

- **Additive only, unless there is no alternative.** Never `alter` `bookings` casually. `uniq_active_slot` is the only race guard in the system; a migration that widens its predicate, or changes `time_slot`'s type, is a migration that can silently turn off anti-double-booking.
- **Wrap in `begin;` / `commit;`.** A paste that fails halfway must not leave a table created _without_ its unique index. This is the reason web's own migration is wrapped, and it applies to every request here.
- **Name every constraint.** `check:schema` reads constraints by name; an anonymous constraint is one it cannot assert on.
- **Repeat the nine canonical slot strings rather than factoring them out.** A Postgres `DOMAIN` would deduplicate them and needs `alter column type` on `bookings` — a hand-run destructive change to the one table the race guard sits on. Duplicate the literal and let `check:schema` detect the drift.
- **Say what web must read.** A table this repo writes and web never reads is a silent no-op, which is the failure class this project exists to avoid. If web must read it, the deployment ordering goes in a gate file, not a step.

## Current requests

| #                         | Title                                      | Status              |
| ------------------------- | ------------------------------------------ | ------------------- |
| [001](001-slot-blocks.md) | `slot_blocks` — one-off date+slot blocking | requested (Phase 4) |

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
