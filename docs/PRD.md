# Arena Player Admin — Product Requirements Document

Back-office for the mini soccer field. The admin logs in, works the pending queue, opens the payment proof, and confirms or rejects. Shares the Supabase Postgres database and the Supabase Storage bucket with [`arena-player-web`](../../arena-player-web/); shares no code except three byte-identical files.

Delivery is sequenced **backend-outward**, the opposite of the web repo. There is no mock and no design phase: the schema exists before this repo starts, and the visual language is inherited. Every phase from 2 onward talks to live Supabase.

---

## Phase overview

| Phase | Scope                                                                                          | Blockers                                                        |
| ----- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1a    | Foundation — architecture, scaffold, DX, dev rules, shared copy, db client, auth, verification | None — start here                                               |
| 2     | Bookings console — list + filters, detail, proof view, confirm / reject                        | 1a, web Phase 4 applied, **and `2-gate-web-supabase`**          |
| 3     | Expiry job — `POST /api/jobs/expire`, external cron, staleness indicator                       | 2, and `3-gate-web-expiry`                                      |
| 4     | Slot blocking — block/unblock a date+slot                                                      | `4-gate-blocks` (a migration web must own, apply, **and read**) |
| 5     | Deploy + handover — `admin.arena-player.com`, user guide, credentials                          | `5-gate-subdomain`, `5-gate-cron-owner`                         |

**This app is a launch dependency of the public site.** Phase 3 owns expiry. Until its cron is scheduled, a pending booking older than 24h is never released and the public site accumulates permanently-held slots. Launch order:

```
web Phase 4  →  admin 1a  →  admin 2  →  admin 3  →  PUBLIC LAUNCH  →  admin 4  →  admin 5
```

Stated plainly because the web repo's PRD currently reads as though the admin app is a wholly separate, later project. It was, until expiry moved here.

**Scope of this repo:** back-office only. No public route, no unauthenticated page except `/login`, no customer-facing copy, no pricing. The landing page, the booking form, and `GET /api/availability` belong to `arena-player-web` and never appear here.

---

## Phase 1a — Foundation

No product screen ships here beyond `/login`. It ends with a repo that runs, rules written down, a database client that cannot silently corrupt a date, and four checks that have each been proven to fail.

| #   | Task                  | Output                                                                                                                                                                                            |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Plan the architecture | Route map, server/client boundary, folder structure, and the peer-dependency set that the shared-code contract obliges this repo to carry — reconciled against [architecture.md](architecture.md) |
| 2   | Scaffold              | Next 16 + TypeScript + Tailwind v4 via pnpm, serving `localhost:3001`. Versions pinned to match web wherever a package is shared                                                                  |
| 3   | Developer experience  | Lint / typecheck, Vitest wired as `pnpm check:unit`, credential-free                                                                                                                              |
| 4   | Development rules     | `docs/dev-rules.md` — naming, file layout, the accessibility baseline, what never goes in `src/app/`                                                                                              |
| 5   | Shared copy           | Byte-identical `src/domain/{slots,dates,status,phone}.ts` and `pnpm check:domain`                                                                                                                 |
| 6   | Database client       | postgres.js client with the OID `1082`/`1184` parser override, `src/server/required-schema.ts`, `pnpm check:schema`                                                                               |
| 7   | Auth                  | argon2id via `hash-wasm`, `jose` HS256 session cookie, Edge middleware, `/login`, rate-limited login route on the Node runtime                                                                    |
| 8   | Verification          | All four `check:` scripts run, and **each has been proven to fail**                                                                                                                               |

**Task 5 is the one that looks trivial and is not.** `uniq_active_slot` compares `time_slot` as text, so `'06.00 - 08.00'` and `'06.00-08.00'` are different slots. A one-character drift between the two repos means this app writes rows the public site cannot match, and anti-double-booking silently stops working for both. Nothing throws. **Web has now built `src/domain/`** — four modules plus their tests — so unlike when this task was written there is a real source to copy from and to diff against on day one. Tests are inside the diff, which makes **vitest** a third shared obligation alongside `date-fns` and `@date-fns/tz`. `check:domain` must still **skip loudly** whenever either side is missing: a skip is not a pass, and its output has to say so.

**Task 6 adds a check the web repo does not have.** `check:domain` guards source against source. Nothing guards source against the _database_, and the nine canonical slot strings live in three places — `src/domain/slots.ts`, the `time_slot_canonical` CHECK constraint, and web's copy — becoming four once `slot_blocks` exists. `check:schema` reads `pg_get_constraintdef` and asserts the constraint's literals are set-equal to `TIME_SLOTS`. Deliberately **not** solved with a Postgres `DOMAIN`: that would require `alter column type` on `bookings`, a hand-run destructive change to the one table the whole race guard sits on. Duplicate the literal; detect the drift.

**Task 7 has a runtime trap with no author-time warning.** Next middleware runs on the Edge runtime. `jose` works there; argon2 does not — it needs WASM instantiation or native bindings that Edge will not give it. So middleware verifies the JWT only, and the password comparison lives in the login route handler with `export const runtime = 'nodejs'`. Getting this wrong fails at deploy, not at `pnpm dev`.

**Done when:** `pnpm dev` serves `localhost:3001`, lint and typecheck run clean, `pnpm check:unit` passes with real assertions, `check:domain` skips loudly with web's `src/domain/` absent, `check:schema` correctly reports the `bookings` table missing, `/login` accepts the right password and rejects the wrong one, and every check has been observed failing on a planted violation.

### Definition of Done — Phase 1a

- [x] Repo scaffolded, `pnpm dev` serves `localhost:3001`
- [x] Lint / typecheck clean; `pnpm check:unit` passes and never needs credentials
- [x] `docs/dev-rules.md` written, including the accessibility baseline
- [x] `src/domain/{slots,dates,status,phone}.ts` present, or `check:domain` skipping loudly with a message naming web's unbuilt step
- [x] `pnpm check:domain` **proven to fail** on a planted one-character drift, then reverted
- [x] postgres.js client carries the OID `1082`/`1184` override; `types.getTypeParser(1082)('2026-08-01')` returns a **string**
- [x] `pnpm check:schema` asserts table, columns, `uniq_active_slot`, and CHECK-literals-vs-`TIME_SLOTS` set equality — and **fails** cleanly against a database with no `bookings` table (algorithm proven via `schema-diff.test.ts`; the live-database path is credential-blocked in this environment and carried forward as a **Phase 2 blocker**, not a Phase 1a gap — `pnpm check:schema` is how Phase 2's start is confirmed)
- [x] Login works; the session cookie is `HttpOnly; Secure; SameSite=Lax`; middleware redirects an unauthenticated request to `/login`
- [x] argon2 verification confirmed **absent** from the Edge middleware bundle
- [x] All four checks have each been observed exiting non-zero at least once

**Closed 2026-08-12.** `check:schema` and `check:setup` cannot be run end-to-end against a live database in this environment (no `DATABASE_URL` / Supabase credentials) — expected and acceptable for Phase 1a closure per the credential-free/credentialed split this phase was scoped around. Both scripts are proven to fail loudly and correctly (missing-variable errors, not silent passes) and their algorithms are proven correct against fixtures. Live verification against the real Supabase database is carried forward as a **Phase 2 entry gate**, not a reopened Phase 1a item — see `docs/PROGRESS.md`, 2026-08-12.

---

## Phase 2 — Bookings console

The product. Everything else in this repo supports it.

| #   | Task             | Output                                                                                                                      |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | App shell        | Layout, nav, the token subset from [DESIGN.md](DESIGN.md), Indonesian copy. Usable at 375px — the admin is often on a phone |
| 2   | Bookings list    | The list query from [architecture.md](architecture.md), server-rendered, filters and pagination entirely in the URL         |
| 3   | Booking detail   | One booking, all fields including `notes`, and the payment proof through a presigned GET                                    |
| 4   | Confirm / reject | Guarded status mutations, the 409 "already processed" path, revalidation                                                    |
| 5   | Verification     | A status change made here is visible on the public site's availability within 30s                                           |

**Defaults matter more than features here.** The list opens on `status = pending`, `booking_date >= today`, sorted `booking_date asc, time_slot asc`. Not `created_at desc` — that is a feed, and this is a queue; what matters is which game is soonest, because that is the booking about to be lost. `created_at` is displayed (it drives the 24h clock) but is not the sort key.

**Reject works on `confirmed` rows, not just `pending`.** That is not a convenience — it is the only implementation of the Ketentuan's 1×24h cancellation rule anywhere in the system. The customer messages the admin; the admin rejects here.

**Un-expiring is deliberately out of scope.** Confirming an `expired` row can collide with `uniq_active_slot` and raise `23505`, which needs the full `isSlotConflict()` contract and a distinct 409 message. Parked rather than half-built; the reasoning is in [architecture.md](architecture.md).

**Blocked on web Phase 4.** Not on its UI — on the migration being applied. `check:schema` is how that is confirmed, not a conversation.

### Definition of Done — Phase 2

- [ ] List renders live Supabase data; filters, date range, search, and pagination all round-trip through the URL
- [ ] Default view is the pending queue from today forward, and reaching it requires zero clicks
- [ ] Phone renders as a working `wa.me` link; `notes` does **not** appear in the list, only on the detail page
- [ ] Proof image renders via a presigned GET; the bucket has no public URL and none was created
- [ ] An expired presigned URL produces a visible "Muat ulang bukti" recovery, not a broken image icon
- [ ] Confirm and reject both use guarded UPDATEs and return 409 on zero rows, with distinct Indonesian copy
- [ ] Reject works on a `confirmed` booking (the cancellation path)
- [ ] Usable at 375px — verified on a real phone viewport, not inferred from a breakpoint
- [ ] **Cross-repo proof:** confirm a booking here, then load the public site's `/api/availability` for that date and see the slot read `booked` within 30s

---

## Phase 3 — Expiry job

Resolves an open question in the **other** repo. `arena-player-web/docs/architecture.md:129-143` records the conflict: `GET /api/availability` carries `Cache-Control: public, s-maxage=30`, so a cache hit never reaches the origin, so lazy-on-read expiry starves — on a quiet night nothing frees an abandoned slot.

Three candidates were written out there. This is the resolution:

| Candidate       | Verdict                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Scheduled job   | **Chosen.** Owned by this repo                                                                                      |
| Expire on POST  | Rejected — expiry then only runs when someone books, which starves on exactly the quiet night the problem describes |
| Drop `s-maxage` | Rejected — pays origin load on every date-pill tap _and_ leaves a write inside a GET                                |

| #   | Task         | Output                                                                                                                          |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Expiry route | `POST /api/jobs/expire` — bearer auth, one idempotent UPDATE, plus a manual "Jalankan sekarang" button using the session cookie |
| 2   | Scheduler    | External HTTP cron every 15 minutes, failure notification on, ownership recorded for handover                                   |

**Not `node-cron`.** A timer inside the Node process stops when Sumopod restarts, redeploys, or idles the container — silently. That trades a cache-starved expiry for a lifecycle-starved one and learns nothing. Not Vercel cron either; this deploys to Sumopod. An external scheduler hitting an authenticated URL keeps the trigger outside the app, and its own failure history _is_ the monitoring.

**Fifteen minutes, not one.** The rule is ">24h", so 15-minute granularity releases a slot at most 15 minutes late, at 96 trivially-indexed UPDATEs a day.

**A dead-man's switch, for free.** The dashboard shows **"umur booking pending tertua"** — the age of the oldest pending booking. Over ~25h means the cron is not firing. Zero schema, zero infrastructure, and it surfaces the symptom on the page the admin opens every day. Deliberately preferred over a `job_runs` table, which would need a migration to monitor a job.

**No new index.** Arithmetic, not taste: 9 slots × 14 days caps active rows at 126, and lifetime accumulation is low thousands. Written down so nobody optimises it later.

### Definition of Done — Phase 3

- [ ] `POST /api/jobs/expire` requires `Authorization: Bearer $CRON_SECRET`; an unauthenticated call returns 401 and mutates nothing
- [ ] Running it twice in succession updates zero rows the second time (idempotent by construction, no lock, no job table)
- [ ] Manual button works through the session cookie and reports how many rows changed
- [ ] External scheduler wired at 15-minute intervals with failure notification enabled
- [ ] Dashboard shows the oldest-pending age, and it has been seen crossing its warning threshold at least once (plant a row, observe, remove)
- [ ] `3-gate-web-expiry` signed off and the six web-repo edits applied
- [ ] Verified end to end: a `pending` row older than 24h becomes `expired`, and the public site's availability shows that slot free

---

## Phase 4 — Slot blocking

Lets the admin take a date+slot off the market without inventing a fake booking — rain, maintenance, a booking taken by phone.

Rejected first, on the record: reusing `bookings` with `status = 'blocked'`. It would widen `status_valid`, widen `uniq_active_slot`'s WHERE clause, put junk in three NOT NULL columns, and add a fifth row-state to the API status-mapping table that `arena-player-web/docs/architecture.md:47-57` marks **FIRM**. Touching the index that is the only race guard in the system, to add a maintenance feature, is a bad trade.

So: a new additive table, `slot_blocks`. DDL and rationale in [schema-requests/001-slot-blocks.md](schema-requests/001-slot-blocks.md).

**The sequencing is the hard part, and it is a gate, not a step.** An admin-created block that the public site does not read is a **silent no-op** — the exact failure class this project exists to avoid. Hard order:

```
migration written into web's db/migrations/  →  applied by hand in Supabase
  →  check:schema green here
  →  web's availability read unions slot_blocks AND IS DEPLOYED
  →  only then does the block UI ship here
```

Blocks map to the existing API status **`booked`**. No new API status; the FIRM contract survives untouched.

### Definition of Done — Phase 4

- [ ] `4-gate-blocks` signed off, with web deployed and reading `slot_blocks` **before** any UI here ships
- [ ] `check:schema` asserts `slot_blocks`, `uniq_slot_block`, and its CHECK literals against `TIME_SLOTS`
- [ ] Block / unblock a date+slot with an optional reason (≤200 chars)
- [ ] With the migration **not** applied, the blocks page shows a loud error naming the exact migration file, and the bookings console keeps working normally
- [ ] Verified: block a slot here, then see the public site report it `booked` and refuse a booking for it

---

## Phase 5 — Deploy + handover

- Production deploy to the client's Sumopod account, `output: 'standalone'`, on `admin.arena-player.com`
- HTTPS confirmed — the session cookie is `Secure` and will not be set over plain HTTP
- External scheduler repointed from any staging URL to production
- Indonesian **admin user guide**: how to log in, how to read the queue, what each status means, what confirm and reject do, what the oldest-pending indicator means and who to call when it goes red
- Credential handover: admin password, `SESSION_SECRET`, the read-only Supabase anon key, `CRON_SECRET`, and the scheduler account itself

### Definition of Done — Phase 5

- [ ] `5-gate-subdomain` resolved — `admin.arena-player.com` serves over HTTPS
- [ ] `5-gate-cron-owner` resolved — the scheduler account is named and its post-handover owner recorded
- [ ] All seven env vars set in production; `check:schema` passes against the production database
- [ ] Admin user guide written in Indonesian and walked through with the client once
- [ ] Credentials handed over; rotation procedure documented (rotating `SESSION_SECRET` logs the admin out — that is intended)

---

## Descoped, with reasons

Recorded rather than dropped, so nobody re-proposes them from scratch.

**Operating-hours configuration.** Listed as a nice-to-have in `arena-player-web/docs/PRD.md:473`. Descoped, and this is a contract judgement rather than a scheduling one: runtime-configurable hours means the nine slots become dynamic, which breaks `GET /api/availability`'s FIRM "always nine entries, always in canonical order" guarantee, invalidates the hand-applied `time_slot_canonical` CHECK, makes `TIME_SLOTS` stop being a constant (so `check:domain` would guard a file that no longer holds the truth), and breaks the web repo's Phase 2 slot grid, which is being built against a 9-element constant right now. And the client has already confirmed 06.00–24.00 daily (`arena-player-web/docs/PRODUCT.md:89`). The whole operational value — closing a slot — is delivered by Phase 4's `slot_blocks` at zero contract cost.

If a recurring closure ever becomes real ("we close Mondays"), the reshaped version is a `slot_closures` table keyed on `(day_of_week, time_slot)` using only the existing nine canonical slots, where an empty table means fully open. DDL sketched in [schema-requests/README.md](schema-requests/README.md), **not** requested. It needs a client answer first, because as things stand it would ship empty on day one.

**Un-expiring a booking.** See Phase 2.

**A read-only database role.** `DATABASE_URL` here cannot be read-only — this app writes `bookings.status`. A separate Postgres role scoped to `select, update(status)` on `bookings` is the correct hardening and costs one hand-run `GRANT`. Noted as a handover nice-to-have rather than built in v1.

**Password reset, MFA, a second account, an audit log.** All require a schema change to a database this repo may not migrate, for a single-user app whose credential rotation is a redeploy. If an audit trail is ever wanted, it is a schema request, not a feature.

**Reporting, analytics, revenue dashboards.** The client measures success by whether dead hours get booked; that is a question about the public site, not this one. Park here rather than reject.
