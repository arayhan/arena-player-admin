# Cross-repo checkpoint — expiry moves to the admin app

**Decided by:** the developer, in an `arena-player-web` session. Nobody in this repo can apply these edits.
**Blocks:** admin Phase 3 (the expiry job) · web's Phase 4 Definition of Done
**Status:** not yet held
**Format:** a documentation-only commit in `arena-player-web`. No code changes, no migration.
**Date applied:** _____

## What was decided, and why it is a gate

`arena-player-web/docs/architecture.md:129-143` carries an `UNRESOLVED` block: `GET /api/availability` sets `Cache-Control: public, s-maxage=30`, so a cache hit never reaches the origin, so lazy-on-read expiry starves — on a quiet night nothing frees an abandoned slot.

Three candidates were written out there. The resolution is **candidate 1**: a scheduled job, owned by `arena-player-admin`, triggered by an external HTTP scheduler every 15 minutes. Expire-on-POST was rejected because it starves on exactly the quiet night the problem describes; dropping the cache was rejected because it pays origin load on every date-pill tap *and* leaves a write inside a GET.

This is a gate rather than a step because the failure it prevents is silent: until the edits land, **two repos hold contradictory descriptions of where expiry runs**, and a future agent will build against whichever one it reads first. Nothing throws either way.

**It is not applied from an admin session** on purpose. Web has an uncommitted scaffold in its working tree, and its own hard rule 10 — one writing session per worktree — exists because two concurrent sessions shipped two defects in a single day, neither able to see the other.

## The six edits

All paths relative to `arena-player-web/`. Line numbers are where they were when this gate was written; verify by content, not by number.

| # | File | Edit |
|---|---|---|
| 1 | `docs/architecture.md:126` | **Delete step 2 of the `GET /api/availability` request flow** — the lazy-expiry step. The GET becomes a pure read with no write in it |
| 2 | `docs/architecture.md` | **Keep `Cache-Control: public, s-maxage=30` exactly as it is.** Stated as an edit because it is the one people will assume changed. The conflict is resolved by removing the write, not the cache |
| 3 | `docs/architecture.md:129-143` | **Replace the whole `> UNRESOLVED` block** with the decision above, naming `arena-player-admin` as the owner of the mechanism and pointing at `arena-player-admin/docs/architecture.md` for the handler |
| 4 | `docs/PRD.md:266` and `docs/PRD.md:417` | `:266` — "Where that expiry runs is UNRESOLVED" becomes resolved, with the owner named. `:417` — **strike the "Where expiry runs" row** from the Phase 4 agenda table entirely |
| 5 | `docs/database.md:45-49` | `bookings_pending_expiry_idx` is currently `(booking_date, created_at) where status = 'pending'`, justified by a **per-date** lazy expiry that no longer exists. The scheduled job filters on `created_at` alone across all dates. Change it to `(created_at) where status = 'pending'` with a comment naming the admin job — **and do it now, while the migration is still unapplied**, rather than shipping an index with a false comment |
| 6 | `docs/PRD.md` Phase 4 DoD | Drop the expiry item. Add an operational-dependency line: the public site's slots are only freed by a cron in `arena-player-admin`, so **that app and its scheduler are a launch dependency of this one** |

## Questions that must not be left unasked

### 1. Does edit 5 still hold once the index is real? — **BLOCKS nothing, but is easy to get wrong later**

The migration has not been applied anywhere. If it *has* been applied by the time this gate is held, changing the index is no longer a documentation edit — it is a second migration.

- Applied yet? _____
- If yes: does the index change ship as a new migration, or is it left as-is with a corrected comment? _____

### 2. Does web's `check:docs` need updating? — **BLOCKS web's Phase 1a**

`check:docs` asserts that the phase overview table names the same phases as the detail sections. Striking a Phase 4 agenda row may or may not trip it.

- Ran `pnpm check:docs` after the edits? _____
- Result: _____

### 3. Who is told that the launch order changed? — **BLOCKS scheduling, not code**

Edit 6 changes the project's critical path. Web's PRD currently reads as though the admin app is a wholly separate, later project.

- Client informed that admin ships before public launch? _____
- Any schedule commitment already made on the old ordering? _____

## Outcome — fill in during or immediately after

| Edit | Applied | Commit |
|---|---|---|
| 1 — delete lazy-expiry step | ☐ | _____ |
| 2 — `s-maxage` confirmed unchanged | ☐ | _____ |
| 3 — replace UNRESOLVED block | ☐ | _____ |
| 4 — two PRD statements | ☐ | _____ |
| 5 — index justification | ☐ | _____ |
| 6 — Phase 4 DoD + launch dependency | ☐ | _____ |

**Anything found while applying these that contradicts the decision:**

_____

### Sign-off

- ☐ All six applied and committed in `arena-player-web`
- ☐ Applied with changes — recorded above
- ☐ Rejected — expiry stays in web, and `arena-player-admin` Phase 3 is cancelled

**Applied by:** _____
**Date:** _____

## After this gate

1. Append the outcome to **both** repos' `docs/PROGRESS.md`. A cross-repo decision recorded in one log is a decision the other repo's next session will not find.
2. `arena-player-admin` Phase 3 unblocks; write its step files then, not before.
3. `5-gate-cron-owner.md` becomes urgent rather than merely open — the mechanism now has no fallback.
