# 2 · step 06 — Verification, and the cross-repo proof

**Depends**: 02, 03, 04, 05
**Blocks**: Phase 3 — and the public launch, since expiry cannot be built on a console nobody has verified
**Agent**: `software-engineer`, then `code-reviewer`

## Goal

Close the Phase 2 Definition of Done with evidence, and prove the one thing this repo cannot prove from inside itself: **that a status changed here is a status the public site reads.**

Everything else in Phase 2 can be verified against this app alone. That line cannot, and it is the line the whole project is built around — a feature this app writes that the public site does not read is a silent no-op.

## The cross-repo proof

Run `arena-player-web` locally on :3000 against **the same** `DATABASE_URL` this app uses — same Supabase project ref, both on the transaction pooler ([2-gate-migration](2-gate-migration.md) question 1 is where that was confirmed; re-check it here rather than assume it held).

```bash
# 1. pick a booking_date + time_slot with a pending row in this app's queue
curl -s "localhost:3000/api/availability?date=$DATE" | grep -o '"'"$SLOT"'"[^}]*'
#    expect: that slot reads `pending`

# 2. confirm it in the admin app

# 3. within 30 seconds — the s-maxage window — read again
sleep 30
curl -s "localhost:3000/api/availability?date=$DATE" | grep -o '"'"$SLOT"'"[^}]*'
#    expect: `booked`
```

**The 30 seconds are `Cache-Control: public, s-maxage=30` on web's availability route, not slack.** A read inside the window can legitimately serve the old value; a read after it that still shows `pending` means the two apps are not on the same database, and everything either of them does is theatre. That is the failure [2-gate-migration](2-gate-migration.md) question 1 exists for, and this is the only place it becomes observable.

Also verify the reverse: **reject** a `confirmed` booking and watch the slot return to `available`. That is the cancellation rule reaching the customer-facing side, and it is the half nobody tests.

## Where the test data comes from

This repo may never `insert`. The cheapest source of a valid row is **a booking made on the public site running locally** — it produces a normalised `628…` phone, a `proof_key` pointing at a real object in the Supabase proofs bucket, and it exercises web's insert path at the same time. It presumes web has already moved to Supabase — [2-gate-web-supabase](2-gate-web-supabase.md). It is also the only route that unblocks step 05's live half. See [2-gate-migration](2-gate-migration.md) row 4.

## The Definition of Done, line by line

Run each, quote the decisive output line in the handoff, then tick it in [PRD.md](../PRD.md). No line is ticked from a step summary.

| DoD line                                              | How it is proven                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| List renders live Supabase; filters round-trip in URL | Step 02's URL matrix, re-run, plus one shared link opened in a fresh window           |
| Default view is the pending queue, zero clicks        | `curl` the naked `/bookings` and read the rendered filter state                       |
| `wa.me` link works; `notes` only on detail            | Tap the link on a phone viewport; grep the list components for `notes`                |
| Proof renders via a signed URL, bucket still private  | Step 05 — **or** its three unproven items carried forward, in writing                 |
| Expired URL shows "Muat ulang bukti"                  | Seen in a browser, step 05                                                            |
| Confirm and reject guarded, 409 on zero rows          | Step 04's two-tab procedure, re-run                                                   |
| Reject works on a `confirmed` booking                 | Run it, then read the row's status in the database                                    |
| Usable at 375px                                       | Real viewport, `scrollWidth === clientWidth`, on `/bookings` **and** `/bookings/[id]` |
| Cross-repo proof                                      | The sequence above                                                                    |

## Full sweep

```bash
pnpm check                 # lint, typecheck, format:check, check:domain, check:unit
pnpm build                 # route table: every route ƒ, none ○
pnpm check:schema          # 10/10 against the live database
pnpm check:setup           # database + storage; note WHICH half fails if the storage credential is still deferred

# the four rules that fail silently, swept once more across the whole tree
grep -rn "next/image" src/                                              # expect: no match
grep -rn "use client" src/                                              # expect: exactly the files named in architecture.md
grep -rniE "create table|alter table|drop table|insert into bookings|delete from bookings" src/ scripts/
grep -rnE "update bookings" src/ --include=*.ts --include=*.tsx | grep -v "src/server/queries.ts"   # expect: no match

# argon2 still absent from the Edge bundle after a phase of new code
grep -rl "argon2\|hash-wasm" .next/server/edge --include=*.js           # expect: no match
```

**Prove one check from this phase fails.** The rule is repeated in every step file for a reason: pick the SQL-guard test from step 04, strip the guard, watch it go red, revert. A check that has only ever passed is a check nobody has tested.

## Deliverables

- Phase 2 DoD checkboxes in `docs/PRD.md` ticked, each against evidence, with any carried-forward item written as a note rather than a tick.
- `docs/PROGRESS.md` appended: what shipped, what is unproven, and where.
- Both gate files filled in — a gate with blank answers is a decision that has not happened.
- Anything owed to `arena-player-web` written as a gate file here, not applied from this session.

**Not done until** the cross-repo proof has been run and its two reads quoted. Reason: every other line in this phase can be satisfied by an app that talks convincingly to itself. This one is the only evidence that the queue, the guards and the confirmations mean anything to a customer — and if it fails, it fails by both apps working perfectly against different databases, which is a state nobody notices from either side.

handoff: `code-reviewer` for the Phase 2 checkpoint
