---
name: arena-player-admin-gotchas
description: Use before writing ANY code in arena-player-admin. Project-wide gotchas — migration ownership, the Edge/argon2 split, the next/image trap, silent-failure surfaces. Every agent must load this once per session before touching source files.
---

# Arena Player Admin — project gotchas

Source of truth: [docs/PRD.md](../../../docs/PRD.md), [docs/architecture.md](../../../docs/architecture.md), and [docs/database.md](../../../docs/database.md). This skill is the condensed trap list — read those for full context.

**Values are not copied here.** SQL, tokens, and env var names live in the docs. A duplicated value is a value that drifts, and the other repo lost a day to exactly that, three separate times.

## The one thing to know first

**This repo is the inverse of `arena-player-web`.** Web built three phases of UI against an MSW mock before its backend existed. This app is useless without real data, it starts after web's Phase 4 lands the schema, and there is **no mock layer here**. Every screen reads live Supabase Postgres from a Server Component. Any instinct carried over from the web repo about mocks, motion, or bundle budgets is wrong here.

## Scope traps

- **This repo never owns a migration.** `db/migrations/` lives in `arena-player-web`. A schema change is authored as a request in `docs/schema-requests/`, transcribed verbatim into web's migrations folder, applied by hand in the Supabase SQL editor. Two repos migrating one database is a conflict with no owner.
- **Never `create table if not exists`.** Fail loudly. Web's migration is wrapped in a transaction precisely so a half-failed paste cannot create `bookings` without `uniq_active_slot`; application-code DDL defeats that entirely and produces a table with no constraints and no error.
- **Out of scope entirely**: the landing page, the booking form, `GET /api/availability`, and any customer-facing copy. Those are `arena-player-web`.
- **Prices changed sides on 2026-08-15.** The admin now edits the rate card (`site_settings`) and sees **DP collected** — 50% of the rate, confirmed bookings only. Displaying a price to a _customer_ is still web's. Never invent a figure: no constant, no estimate, no placeholder in a chart or fixture. Until the rate card lands, price surfaces render a missing-rate-card state.
- **Descoped with reasons recorded** in the PRD, do not re-propose from scratch: runtime operating-hours config, un-expiring a booking, password reset / MFA / a second account, reporting.
- **Phases 2 and 4 are blocked on the other repo**, not on effort. Phase 2 needs **two** of web's migrations applied, in order — `20260809_create_bookings.sql` then `20260815_alter_time_slot_1h.sql`, the second of which drops the constraint the first creates. Phase 4 needs web deployed and _reading_ `slot_blocks`. `pnpm check:schema` is how you find out, not a conversation.
- **Slots became eighteen 1-hour strings on 2026-08-15**, replacing nine 2-hour ones; the window is `BOOKING_WINDOW_DAYS = 92`. Never carry a slot count or a window length from memory or from a doc — read `src/domain/slots.ts` and `src/domain/dates.ts`. The numbers are noted here only because a doc, a comment or a client answer written before that date says nine and two hours, and both still read as plausible.
- **This app is a launch dependency of the public site.** Expiry runs from a cron here. Until Phase 3 ships and its scheduler is wired, abandoned slots on the public site are never freed.

## Four silent failures, and what catches each

Nothing throws for any of these. That is the whole reason they are listed together.

| Failure                                                                                                      | Detector                                                                                   |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `src/domain/` drifts by one character from web → anti-double-booking silently stops working **in both apps** | `pnpm check:domain` — byte diff **and** shared peer-dependency ranges                      |
| A slot string drifts between source and the `time_slot_canonical` CHECK constraint                           | `pnpm check:schema` — reads `pg_get_constraintdef`, asserts set equality with `TIME_SLOTS` |
| The expiry cron stops firing → slots held forever                                                            | The dashboard's **"umur booking pending tertua"**. Over ~25h means it is not running       |
| A block written here that web never reads → the feature does nothing                                         | `4-gate-blocks.md` ordering, enforced by a signature                                       |

**`src/domain/` is read-only in this repo.** Drift is repaired by fixing web and re-copying, never by editing the copy here. Web's copy exists now (its step 06 landed), and the diff includes the four TEST files too — so this repo owes vitest as well as date-fns and @date-fns/tz. `check:domain` still **skips loudly** whenever a side is missing: a skip is not a pass, and its output says so.

## The traps that fail at deploy, not at author time

- **argon2 cannot run on the Edge runtime.** Middleware verifies the `jose` JWT only; the password comparison lives in the login route with `export const runtime = 'nodejs'`. Wrong way round builds clean, runs clean in `pnpm dev`, and fails on Sumopod. Grep the _built_ middleware bundle, not the source — the import can arrive through a barrel file.
- **`hash-wasm`, not `@node-rs/argon2`.** Sumopod's build environment is unverified; native bindings fail at deploy, on a login that happens twice a day and does not need the speed.
- **The session cookie is `Secure`, so login fails over plain HTTP** — in a way that looks like a wrong password. HTTPS on the subdomain is a Phase 5 gate for this reason.

## The worst mistake available in this repo

**Never `next/image` on a payment proof.** Next's optimizer proxies the presigned URL, writes the decoded output to an on-disk cache keyed by URL, and serves it from a stable `/_next/image?url=…` path with a long TTL — copying a private payment document out of a private bucket and outliving the presign entirely. Plain `<img>`.

Related, same class:

- Presign TTL is **120 seconds**, not fifteen minutes. It is a bearer capability for a document carrying a name, an amount, and a bank transfer, and it leaks through browser history and the `Referer` header.
- `export const dynamic = 'force-dynamic'` on the proof page; a cached RSC payload serves an expired URL.
- `Cache-Control: private, no-store` on every admin response.
- The proof credential here is the **anon** key, never `service_role`. A private bucket plus an RLS `select` policy on `storage.objects` scoped to it is what makes it read-only by construction.

## Database traps inherited with the connection

Full detail in [docs/database.md](../../../docs/database.md).

1. **DATE/TIMESTAMPTZ parsers (BLOCKER-class).** postgres.js returns JS `Date` for oids `1082`/`1184`, silently shifting `booking_date` back a day on Asia/Jakarta machines. Override both via the client's `types` option. Every query also casts `::text` — belt and braces, on purpose. The trap is the driver's, not the provider's; it survived the move to Supabase unchanged.
2. **Supabase's transaction pooler**, port 6543, host `…pooler.supabase.com` — and therefore `prepare: false`. pgbouncer in transaction mode hands a different backend connection to each statement, so a prepared statement created on one is not there for the next.

## Never mutate blind

Every status update carries its own `where status in (…)` guard and returns **409** on zero rows. The admin's screen is stale by default — two tabs, a phone and a laptop, and an expiry job all write the same rows. Zero rows is not an error to swallow; it means the row was already actioned.

**Reject accepts `confirmed`, not just `pending`.** That is the only implementation of the Ketentuan's 1×24h cancellation rule anywhere in the system — there is no customer-facing cancel route. Narrowing it silently deletes the feature.

## Workflow

- Commit after each work step passes, conventional-commit style. No attribution trailers.
- Append to `docs/PROGRESS.md` after every completed task: `[date] [agent] [what] [reason]`. Current phase only.
- **A cross-repo decision goes in both repos' PROGRESS logs and lands as a gate file.** A decision recorded only here is one the other repo's next session will not find.
- **Verification before completion**: run the command, quote the decisive output line, then claim. Never assert without evidence.
- **Every check must be proven to fail before it is trusted.** Plant a violation, watch the exit code, revert. The other repo shipped a `Stop` hook that never fired once, for exactly that reason.
- Start Claude sessions inside `arena-player-admin/` — hooks and settings load from session root. One writing session per worktree.
