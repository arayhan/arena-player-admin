# 006 — `time_slot_canonical`, eighteen 1-hour slots

**Status:** LANDED AS db/migrations/20260815_alter_time_slot_1h.sql — **authored in web, not yet applied**
**Unblocks:** nothing new. It is what makes `pnpm check:schema` capable of going green at all, and therefore what [../tasks/2-gate-migration.md](../tasks/2-gate-migration.md) is waiting on alongside [004](004-bookings-on-supabase.md)
**Requires of arena-player-web:** nothing further — web authored the file and owns it. What it requires of a **human** is a second paste in the Supabase SQL editor, after 004's.

## Why this file exists at all

Like [004](004-bookings-on-supabase.md), this request authors no DDL. The migration was written in `arena-player-web` on 2026-08-15, in the repo that owns `db/migrations/`, exactly as the protocol requires. This file is the record on **this** side that it exists and is unapplied, because the failure mode is the one this folder was built for: web's docs say the file is written, this repo's `check:schema` says the literals disagree, both statements are true forever, and nobody is wrong.

**What changed and why.** `TIME_SLOTS` went from nine 2-hour slots to **eighteen 1-hour slots**, 06.00–24.00, on 2026-08-15 — per the migration's own comment, "so a visitor can book a single hour instead of being forced into a 2-hour block." Every slot string changed; not one of the nine survives. `BOOKING_WINDOW_DAYS` moved to 92 in the same re-copy, but that is a source-only constant with no schema surface, so it appears in no DDL anywhere.

**No code changed in this repo, and that is the design working.** `src/server/required-schema.ts` imports `TIME_SLOTS` and passes it directly as `expectedLiterals` rather than retyping the strings, so `check:schema` began asserting eighteen literals the moment the domain copy landed. That is the [README's](README.md) "repeat the literals in SQL, never retype them in TypeScript" rule paying for itself: the SQL side needed a hand-written migration, the TypeScript side needed nothing, and the drift between them was detected rather than discovered.

## DDL

**None new.** Apply `arena-player-web/db/migrations/20260815_alter_time_slot_1h.sql` **verbatim**, in the Supabase SQL editor, in the project both apps connect to, **after** `20260809_create_bookings.sql`. It drops the `time_slot_canonical` constraint that file created and adds the eighteen-literal replacement; run alone, against a database with no `bookings` table, it fails on the `drop constraint`.

Three properties of that file are load-bearing:

- **The `begin;` / `commit;` wrapper**, for the same reason as every other migration here, and with a sharper edge: the halfway state is `bookings` with the old constraint **dropped and never replaced**, which accepts any string at all as a `time_slot`. That is worse than the wrong constraint, because nothing rejects and nothing warns.
- **`not valid` on the new constraint.** It skips validating rows that predate it, so the migration cannot fail on data written under the old strings. The new constraint still applies to every `INSERT` and `UPDATE` from that point on. Removing `not valid` to "be thorough" turns a migration that always succeeds into one that fails on exactly the databases that have history.
- **Existing rows are deliberately left alone.** A booking already stored as `'06.00 - 08.00'` is not rewritten. What happens to it — honour it, contact the customer, cancel it — is the admin's call, not a migration's, and web's comment says so explicitly. The project has taken no bookings under the old strings, so this is currently theoretical.

> **ASSUMPTION FLAGGED — an old-slot row is invisible to this app's slot logic, not just to the constraint.** If any row under a 2-hour string ever does exist, `isTimeSlot()` rejects it, no slot grid cell corresponds to it, and `uniq_active_slot` still holds it against a slot nothing can now book. Nothing throws; the row simply cannot be matched. Whether the admin console needs a surface for such rows depends entirely on whether any exist, which is a question for the live database and not one to answer speculatively here. Check before Phase 2's list ships: `select count(*) from bookings where time_slot not in (<the eighteen>)`.

Do not run it through the Supabase CLI, a migrations tool, or an MCP client. By hand, in the SQL editor, whole file, one execution.

## What changes in arena-player-web

Nothing beyond the migration it already owns, and its own `src/domain/slots.ts`, which is the source this repo copied from. Web's slot grid renders eighteen cells rather than nine, and `GET /api/availability`'s FIRM "always N entries, always canonical order" contract now means **eighteen** entries — a web-side concern, recorded here only so the number is not read off a stale admin doc.

## Verification

`pnpm check:schema`. No new assertion — assertion 3 (`time_slot_canonical` literals **set-equal to `TIME_SLOTS`**) is the existing one, and it is the assertion that has been failing since the domain re-copy.

Read the failure before applying, not only the pass after. It should name the nine literals as `extra` and the eighteen as `missing`; that is what proves the check is comparing against the live constraint text rather than reporting a table it never read.
