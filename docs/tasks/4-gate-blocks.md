# Cross-repo checkpoint — `slot_blocks` is live in both apps

**Decided by:** the developer, with the user applying the migration by hand in the Neon SQL editor.
**Blocks:** admin Phase 4 entirely — no blocking UI ships before this is signed off
**Status:** not yet held
**Format:** a sequence, verified at each step. Not a meeting.
**Date completed:** _____

## Why this is a gate and not a checklist inside a step

**A block this app writes that the public site does not read is a silent no-op.** The admin marks a slot closed, the page says "Diblokir", customers keep booking it, and nothing anywhere reports a problem. The first symptom is two teams at a field the admin thought was closed.

That is the failure class this entire project is built around, and the only defence is ordering. Ordering enforced by a checklist inside a step is ordering an agent can tick out of sequence; ordering enforced by a signature is not.

The full request, DDL, and rationale: [../schema-requests/001-slot-blocks.md](../schema-requests/001-slot-blocks.md).

## The sequence — each row must be true before the next is attempted

| # | Step | Who | Verified by |
|---|---|---|---|
| 1 | DDL transcribed **verbatim** into `arena-player-web/db/migrations/<ts>_create_slot_blocks.sql` and committed there | developer, in a web session | the file exists in web's repo, comments intact |
| 2 | Migration applied by hand in the Neon SQL editor | the user | `slot_blocks` and `uniq_slot_block` both present |
| 3 | `src/server/required-schema.ts` extended here; `pnpm check:schema` green | admin repo | the check passes, including CHECK literals vs `TIME_SLOTS` |
| 4 | Web's availability read **unions** `slot_blocks`, and its booking insert carries the `not exists` guard | developer, in a web session | both statements in web's code |
| 5 | **Web is deployed** with those two statements | developer | a blocked slot inserted by hand reads `booked` on the live public site |
| 6 | Only now: admin's blocking UI ships | admin repo | end-to-end check below |

**Row 5 is the one that gets skipped.** Web having the code merged is not the same as web serving it. The verification for row 5 is a request against the live public site, not a look at a diff.

## Questions that must not be left unasked

### 1. Was the DDL transcribed verbatim? — **BLOCKS everything downstream**

The comments in `001-slot-blocks.md` carry the reasoning for constraints that look redundant and are not — in particular why the nine slot literals are duplicated rather than factored into a `DOMAIN`. A "cleaned up" transcription loses that and invites the domain refactor later, which needs `alter column type` on `bookings`.

- Transcribed without edits, comments included? _____
- If edited, what changed and why: _____

### 2. Is `uniq_slot_block` actually present? — **BLOCKS row 3**

The migration is wrapped in `begin;`/`commit;` precisely so a paste that fails halfway cannot leave the table created without its unique index. Confirm the index, not just the table — the same way web's own migration requires confirming `uniq_active_slot`.

- `slot_blocks` present? _____
- `uniq_slot_block` present **and unique**? _____

### 3. What does the public site do with a blocked slot? — **BLOCKS row 6**

The design maps a block to the existing API status `booked`. No new API status, no client change, FIRM contract untouched.

- Blocked slot returns `booked` from `GET /api/availability`? _____
- A `POST /api/bookings` for a blocked slot returns 409? _____
- Does its 409 copy distinguish "blocked" from "already taken"? _____ *(if not, decide here whether that matters — the customer sees this message)*

### 4. Who blocks a slot that already has a booking? — **BLOCKS nothing, but decide it now**

`uniq_slot_block` prevents double-blocking. It does not prevent blocking a date+slot that already holds a `pending` or `confirmed` booking, and the two tables have no foreign key between them.

- Does the admin UI warn before blocking a slot with an active booking? _____
- Or is blocking-then-rejecting the intended workflow? _____ *(recommended — it matches how the admin already thinks, and needs no cross-table constraint)*

### 5. The race, stated rather than engineered away

An admin blocking a slot in the same instant a customer submits for it can produce both a block and a booking. Window: milliseconds. Resolution: the admin sees the booking in the queue and rejects it.

- Accepted as-is? _____
- If not, what is being built instead, and what does it cost? _____

## End-to-end verification for row 6

Not a code review. Performed against the deployed public site.

1. Block a date+slot in the admin app.
2. Load the public site's order section for that date — the slot renders as taken.
3. Attempt a booking for it — 409, with the correct Indonesian copy.
4. Unblock it in the admin app.
5. The public site shows it available again within the 30s cache window.

## Outcome — fill in during or immediately after

| Row | Done | Evidence |
|---|---|---|
| 1 — DDL in web's migrations | ☐ | _____ |
| 2 — applied in Neon | ☐ | _____ |
| 3 — `check:schema` green | ☐ | _____ |
| 4 — web's two statements written | ☐ | _____ |
| 5 — **web deployed and reading** | ☐ | _____ |
| 6 — admin UI shipped | ☐ | _____ |
| End-to-end verification passed | ☐ | _____ |

### Sign-off

- ☐ Complete, in order, verified at each row
- ☐ Complete with deviations — recorded above
- ☐ Abandoned — Phase 4 descoped, and `001-slot-blocks.md` marked `withdrawn`

**Signed off by:** _____
**Date:** _____

## After this gate

Append the outcome to both repos' `docs/PROGRESS.md`, and update `docs/schema-requests/001-slot-blocks.md` from `requested` to `LANDED AS db/migrations/<file>`.
