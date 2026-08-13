# 2 · step 04 — Confirm and reject, guarded

**Depends**: 01 (the two guarded statements), 02 (the queue's action cell), 03 (the detail page's action region)
**Blocks**: 06
**Agent**: `software-engineer`

## Goal

The two mutations this entire application exists to perform, and the third outcome nobody designs for: **409, the row was already actioned.**

Without this step every booking in the database stays `pending` forever. With it done carelessly, the admin confirms a row the expiry job already released and the app reports success.

## The rules, restated because each one is a deletion risk

**Never a blind update by id.** Both statements carry their own `where … and status in (…)` and `returning`. Zero rows returned is **not an error to swallow** — it means the row was actioned in another tab, on the admin's phone, or by the expiry job between render and click. Respond 409, re-render the current state.

**Reject accepts `confirmed`, not just `pending`.** This is the only implementation of the Ketentuan's 1×24h cancellation rule anywhere in the system — there is no customer-facing cancel route. The customer messages the admin; the admin rejects here. Narrowing the guard to `pending` silently deletes a product feature, passes every test anyone would think to write, and is the single most likely "simplification" in this step.

**Un-expiring is not built.** Confirming an `expired` row can collide with `uniq_active_slot` and raise `23505` because another booking may have taken the released slot. The guard already excludes it — an `expired` row simply yields 409. Do not add an `expired` branch; the reasoning is in architecture.md's "Status mutations".

## Deliverables

- **`src/modules/bookings/bookings.actions.ts`** — `"use server"`, one file per module per [dev-rules.md](../dev-rules.md). Two actions, `confirmBooking(id)` and `rejectBooking(id)`, each calling the matching statement in `src/server/queries.ts`. **No SQL in this file.**
- **A typed result, never a thrown exception**: the action returns what happened so the caller can render it. Zero rows is a 409 _result_.
- **The 409 carries the row's current status.** On zero rows, re-read through `getBookingById` and use it: _"Booking ini sudah dikonfirmasi"_, _"…sudah ditolak"_, _"…sudah kedaluwarsa"_. architecture.md's `"Booking ini sudah diproses"` is the fallback when the row has vanished entirely. The PRD's DoD asks for **distinct Indonesian copy**; telling the admin what the row is _now_ is what makes the message worth reading, and the second read costs one round trip on a path that only runs when something already went wrong.
- **`revalidatePath`** after a successful mutation — `/bookings` and the detail path. Not an optimistic client update; there is no client cache to keep consistent.
- **Surfacing the result without a client component.** Plain `<form action={…}>` with a hidden `id`. On 409 the action `redirect()`s back to the current URL with a `?conflict=<id>` param, and the page renders a banner server-side from it. This keeps the boundary rule intact — the actions ship **zero** `"use client"` files — and the back button still works. Note in the code that `redirect()` throws by design and must sit outside any `try`/`catch`.
- **Settled rows show no buttons.** A non-`pending` row in the queue renders the mockup's note instead: `confirmed`/`rejected` → "Sudah ditindak", `expired` → "Slot terbuka lagi". A `confirmed` row still offers **Tolak** on the detail page — that is the cancellation path, and hiding it there is the same silent deletion as narrowing the guard.
- **Colocated `bookings.actions.test.ts`** — see below.

## What the tests must assert, because a review will not catch it

1. `rejectBooking` succeeds against a `confirmed` row.
2. `confirmBooking` against a non-`pending` row returns a 409 result and **updates nothing**.
3. Neither statement can be issued without its status predicate — assert against the SQL text itself, so deleting the guard turns a test red rather than turning a feature off.
4. No `insert` or `delete` reaches `bookings` from anywhere in `src/`.

## Acceptance

```bash
# the guards exist in the only file allowed to hold SQL
grep -rnE "update bookings" src/ --include=*.ts --include=*.tsx | grep -v "src/server/queries.ts"   # expect: no match
grep -nE "where id = \$1 and status" src/server/queries.ts                                          # expect: 2
grep -n "status in \('pending','confirmed'\)" src/server/queries.ts                                 # expect: the reject guard

# actions, not route handlers; server, not client
grep -n '"use server"' src/modules/bookings/bookings.actions.ts
grep -rn "use client\|useActionState\|useTransition" src/modules/bookings                           # expect: no match
grep -rn "revalidatePath" src/modules/bookings/bookings.actions.ts                                  # expect: present

# this repo never writes rows, only their status
grep -rniE "insert into bookings|delete from bookings" src/ scripts/                                # expect: no match

pnpm check && pnpm build
```

**Live, against real rows — all four:**

1. Confirm a `pending` row → status flips, both the queue and the detail page show it without a manual reload.
2. **Reject a `confirmed` row** → it becomes `rejected`. This is the cancellation rule; verify it deliberately.
3. **Produce the 409 for real:** open the same booking in two tabs, confirm in one, then confirm in the other. Expect the banner naming the current status — not a crash, not a silent success, not a duplicate write.
4. Confirm an `expired` row → 409, and the row is untouched.

**Prove the guard fails before trusting it.** Strip `and status = 'pending'` from the confirm statement; the SQL-text test must go red. Revert, re-run. A guard that has only ever passed is exactly the guard this repo has been burned by.

**Not done until** case 3 has been produced by actually actioning the same row twice, in two windows. Reason: it is the only path in Phase 2 where the _database_ decides the outcome rather than the code, it is the path the mockup's happy flow never shows, and it is the one the admin will hit within the first week — two tabs, or the expiry job moving underneath a page that has been open for an hour.

handoff: `software-engineer` for step 05
