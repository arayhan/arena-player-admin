# 004 — `bookings`, applied on Supabase

**Status:** requested
**Unblocks:** admin Phase 2 entirely, and therefore Phases 3–5. Held as [../tasks/2-gate-migration.md](../tasks/2-gate-migration.md)
**Requires of arena-player-web:** no new SQL — the migration already exists there. What it requires is a **connection change**: web's `DATABASE_URL` must point at the same Supabase project this repo does. See [../tasks/2-gate-web-supabase.md](../tasks/2-gate-web-supabase.md)

## Why this file exists at all

Every other request in this folder authors **new** DDL. This one authors none. It exists because the project moved from Neon Postgres to Supabase Postgres while `arena-player-web/db/migrations/20260809_create_bookings.sql` was still unapplied, and a migration that was never applied to the old provider has to be applied to the new one by someone, in a named place, once.

Without a record, the failure is the ordinary one for this project: nobody is wrong, and nothing happens. Web's docs describe the file as pending, this repo's `check:schema` reports a missing table, and both statements stay true indefinitely because each repo assumes the other's owner is holding it.

**No DDL is rewritten for Supabase.** Supabase is stock Postgres; `gen_random_uuid()`, partial unique indexes, `timestamptz` and named CHECK constraints all behave identically. A migration "adapted" for the new provider is a migration that no longer matches what `src/server/required-schema.ts` asserts, which converts a five-minute paste into a schema drift nobody is looking for.

## DDL

**None new.** Apply `arena-player-web/db/migrations/20260809_create_bookings.sql` **verbatim**, in the Supabase SQL editor, in the project both apps connect to.

Three properties of that file are load-bearing and are the reason this is a signature and not a checklist tick:

- **The `begin;` / `commit;` wrapper.** A paste that fails halfway must not leave `bookings` created _without_ `uniq_active_slot`. That partial unique index is the only anti-double-booking guard in the entire system. A table created without it works perfectly, throws nothing, passes every screen in the admin app, and lets the public site sell one slot twice — forever, silently. Pasting statement-by-statement, or dropping the wrapper because the editor complained, produces exactly that.
- **The canonical slot literals in `time_slot_canonical`.** They are duplicated from `src/domain/slots.ts` on purpose rather than factored into a Postgres `DOMAIN`; the reasoning is in the migration's own comments. A "tidied" paste that reformats or reorders them breaks nothing visibly and breaks `uniq_active_slot`'s text comparison permanently, in both repos at once. **This file still carries the nine 2-hour literals and that is correct — do not edit it.** `TIME_SLOTS` became eighteen 1-hour strings on 2026-08-15, and the replacement constraint is a second migration, [006](006-time-slot-1h.md). Paste this one as written, then that one.
- **`bookings_pending_expiry_idx`.** Phase 3's expiry `UPDATE` relies on it. Its absence is a performance problem that only appears once there are rows.

Do not run it through the Supabase CLI, a migrations tool, or an MCP client. By hand, in the SQL editor, whole file, one execution — the same rule as every other request here.

## What changes in arena-player-web

Nothing in its SQL. Two things around it:

1. **`DATABASE_URL` moves to the Supabase transaction pooler**, same project ref as this repo, port `6543`. Two Supabase projects — one per app — produce an admin console that confirms bookings the public site never sees and a public site whose bookings never reach the queue. Both apps work. Nothing errors. The whole product is a no-op, and a second project is free and two clicks away.
2. **Its storage vars move off R2** to the same Supabase bucket this app reads, because `bookings.proof_key` is `not null` and points into it.

Both are the subject of [../tasks/2-gate-web-supabase.md](../tasks/2-gate-web-supabase.md). Neither is applied from an admin session.

## Verification

`pnpm check:schema` — the same 10 assertions it already carries, against the Supabase connection. No new assertion is added by this request, which is the point: the expectation in `src/server/required-schema.ts` is provider-independent and stays untouched.

**It will still be red after this file alone, on exactly one assertion.** `time_slot_canonical` is asserted set-equal to `TIME_SLOTS`, which is now eighteen 1-hour strings, and this migration writes the nine 2-hour ones. That is the check working, not a transcription error — it goes green only once [006](006-time-slot-1h.md) is applied on top. Apply both, in order, then read the output once.

Read the output rather than inferring it from the table existing. The two assertions that matter here are `uniq_active_slot` being present **and unique** with its partial predicate intact, and the `time_slot_canonical` literals being **set-equal to `TIME_SLOTS`**. Both are green in a database where the paste half-succeeded and a human glanced at the table list.

Then `pnpm check:setup`, and note **which half** fails if it does — the database half belongs to this request, the storage half to [../tasks/2-gate-storage-credential.md](../tasks/2-gate-storage-credential.md).
