# Cross-repo checkpoint — web reads `site_settings`, tolerates a null `proof_key`, and knows what `deleted` is

**Decided by:** the developer, in an `arena-player-web` session, plus the user for the two migrations — [005](../schema-requests/005-admin-writes-bookings.md) and [003](../schema-requests/003-site-settings.md). Nobody in this repo can apply any of it.
**Blocks:** the settings screen meaning anything, the walk-in **create** flow, and **soft delete** — the three blocked features of the reset ([6-step-01](6-step-01-direction.md)'s phasing table). The visual reset, the queue, and the CSV export are unaffected and do not wait
**Status:** not yet held
**Format:** a sequence, verified at each row. Not a meeting
**Date completed:** \_\_\_\_\_

## Where things actually stand — verified, not assumed

Read out of both repos on 2026-08-15:

| Fact                                                                                                                  | Where                                                                                   |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/domain/status.ts` is **byte-identical** between the two repos, today                                             | `diff` of both paths — clean                                                            |
| `status_valid check (status in ('pending','confirmed','rejected','expired'))`                                         | `arena-player-web/db/migrations/20260809_create_bookings.sql`                           |
| `uniq_active_slot … where status in ('pending','confirmed')`                                                          | same file                                                                               |
| `ACTIVE_STATUSES = ["pending","confirmed"]`, documented as mirroring that WHERE clause                                | `src/domain/status.ts`, both repos                                                      |
| `proof_key text not null`                                                                                             | same migration                                                                          |
| **Web reads `proof_key` nowhere.** It appears only in that migration, `db/README.md`, and two code comments           | grep of `arena-player-web/src`                                                          |
| `toSlotStatus` is used by web's `src/mocks/availability.ts` as well as its domain tests                               | grep of `arena-player-web/src`                                                          |
| `KETENTUAN` is a hardcoded `readonly string[]` in `src/modules/home/home.content.ts`, rendered by `KetentuanRows.tsx` | grep of `arena-player-web/src`                                                          |
| Web's `src/server/` is still empty and it still has no database driver                                                | as recorded in [2-gate-web-supabase](2-gate-web-supabase.md) — re-verify before quoting |

So none of this is broken today. It is unbuilt on one side and unrequested on the other, which is the condition this folder exists to keep visible.

## Why this is a gate and not a step

**No agent in this repo may touch that one.** Web owns its own source and `db/migrations/` (hard rule 1), and `src/domain/**` is **read-only here** (hard rule 4) — the `deleted` change is _authored in web, then re-copied_, never edited in this repo and pushed the other way. `pnpm check:domain` diffs the two byte-for-byte and will fail on a copy edited locally, which is the correct outcome and a wasted afternoon if someone tries.

And the ordering is load-bearing rather than tidy. Two of these three carry a failure that reports nothing; one carries a failure that reports loudly, and the loud one is the good case.

## The good case: web **fails to compile**

`toSlotStatus()` is an exhaustive `switch` over `BookingStatus` with no `default` branch. Add `"deleted"` to `BOOKING_STATUSES` and every consumer stops compiling until the new case is mapped — in web that is `src/domain/status.test.ts` and `src/mocks/availability.ts`, and later whatever reads availability.

**That is the failure everybody wants.** The mapping is `deleted → available`, for the same reason `rejected` and `expired` map there: anything not in `ACTIVE_STATUSES` is free to rebook, by definition. A build that refuses to start is the cheapest possible notification, and it is why the domain change goes **first** in the sequence below.

## What does **not** change, and must not be implied to

**`uniq_active_slot`'s predicate does not move.** It is `where status in ('pending', 'confirmed')`, and `deleted` is not in that list — so a deleted booking **frees its slot automatically**, with no index change, no migration to the guard, and no second write.

This is the one place in the whole design where the additive-only rule pays off exactly as intended. Do not "help" by widening or narrowing that predicate, and do not add a `where status <> 'deleted'` anywhere as though the index needed it. [schema-requests/README.md](../schema-requests/README.md) names a migration that widens `uniq_active_slot` as the way anti-double-booking gets silently turned off, and both apps would keep working while it happened.

## The sequence — each row must be true before the next is attempted

| #   | Step                                                                                                                                                      | Who                         | Verified by                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| 1   | `"deleted"` added to `BOOKING_STATUSES` and mapped `deleted → available` in `toSlotStatus()`, **in `arena-player-web`**                                   | developer, in a web session | web's own build fails, then passes; its `status.test.ts` covers the new case |
| 2   | The file re-copied byte-identical into this repo                                                                                                          | agent, here                 | `pnpm check:domain` green in **both** repos                                  |
| 3   | [005](../schema-requests/005-admin-writes-bookings.md) applied — **one transaction**: `proof_key` nullable **and** `status_valid` re-added with `deleted` | user                        | `pnpm check:schema` here                                                     |
| 4   | Web's read path tolerates a null `proof_key` — types, and any select that assumes it is present                                                           | developer, in a web session | web's typecheck, against the real column                                     |
| 5   | [003](../schema-requests/003-site-settings.md) applied, and web deploys its **reads 1 and 2** — the WhatsApp number and the Ketentuan                     | developer, in a web session | an edit made here changes the public page                                    |
| 6   | Web's other three reads — address, Maps embed, bank accounts                                                                                              | developer, in a web session | may ship before, after, or never; 003 says why                               |
| 7   | Only now: soft delete and walk-in create ship in this repo                                                                                                | agent, here                 | the end-to-end check below                                                   |

**Rows 1–3 in that order, and the order is the whole point.** Reversed — the CHECK widened before web's domain file knows the value — this repo can write `deleted` rows immediately, and web's `toSlotStatus()` receives a status its switch has no case for. In TypeScript that returns `undefined` at runtime with no throw and no type error, because the union it was compiled against never contained the value. Whether that reaches a customer depends on something nobody can check yet:

> **To verify when web's availability query exists** (its `src/server/` is empty today): whether that query filters to `ACTIVE_STATUSES` in SQL, in which case a `deleted` row never reaches `toSlotStatus()` and the out-of-order window is harmless — or whether it maps every row it finds, in which case the window renders a slot that is neither available nor booked. **Do not assume the safe answer.** Write the finding into this file when the query lands.

**The `proof_key` half of row 3 is the one that looks free.** `alter column proof_key drop not null` touches no index, cannot fail against existing rows, and breaks nothing in web — web reads that column nowhere. The cost lands here instead: every screen that renders a proof must already handle the null **before** the first walk-in row exists, or the first booking the admin creates crashes the detail page they created it from. [6-step-01](6-step-01-direction.md) lists that state — _"dibuat oleh admin, tanpa bukti transfer"_ — as one that is designed, not discovered, for exactly this reason.

**Row 3 is the only `alter table bookings` in the project**, which [schema-requests/README.md](../schema-requests/README.md) singles out as the thing never to do casually: that table is where the only race guard in the system sits. 005 batches both changes into one `begin;`/`commit;` deliberately — read its reasoning before running it — and the sharp edge is that a CHECK cannot be widened in place, so `status_valid` is dropped and re-added under the same name. **Between those two statements `bookings.status` is constrained by nothing at all.** Inside the transaction that window is unobservable; pasted statement-by-statement, which is what people do when the editor complains about the wrapper, it is real.

## Questions that must not be left unasked

### 1. Does `deleted` mean the row is hidden, or that it never happened? — **BLOCKS the soft-delete UI**

- Does a `deleted` booking still appear anywhere in this app — a filter, an export, an audit view? \_\_\_\_\_
- Does it appear in the **CSV export** ([6-step-03](6-step-03-export-csv.md))? \_\_\_\_\_ _(the export reuses the queue's filters, so the answer is whatever the queue's default `status` filter says — decide it once, not twice)_
- Can it be undeleted, and by whom? \_\_\_\_\_ _(PRD.md already descoped un-expiring a booking; this is the same question wearing a different hat)_
- What happens if the admin deletes a `confirmed` booking whose customer has paid? \_\_\_\_\_

### 2. Is the null `proof_key` allowed for anything except a walk-in? — **BLOCKS the create flow's shape**

`proof_key not null` was the constraint that made _"every pending booking has a paid DP attached"_ true, and [6-gate-settings-and-expiry](6-gate-settings-and-expiry.md) question 5 is built on that being true.

- After this change, does the queue still mean "these people have paid"? \_\_\_\_\_
- Does a walk-in enter as `pending` or straight to `confirmed`? \_\_\_\_\_ _(if `pending`, the Phase 3 expiry job will expire a walk-in that has no proof and no customer to chase — which is a new behaviour nobody has specified)_
- Does web's booking form stay unable to submit without a proof? \_\_\_\_\_ _(the column being nullable does not make it optional on the public site, and it must not become so by accident)_

### 3. Are web's reads 1 and 2 deployed, and does Pengaturan know? — **BLOCKS rows 5–6**

[003](../schema-requests/003-site-settings.md) settles which keys exist and which of its five reads are order-critical; that reasoning is not restated here, because a copied rule is a rule that drifts. What this gate needs is the confirmation:

- Are web's reads **1 (WhatsApp number)** and **2 (Ketentuan)** deployed? \_\_\_\_\_
- Until they are, do those two fields render **read-only in Pengaturan, with the reason on the screen**? \_\_\_\_\_ _(003 requires exactly that, and it is the only row of this gate an admin can trip on their own)_
- `KETENTUAN_TITLE` — a constant, or a sixth key? 003 deliberately does not decide it: \_\_\_\_\_

**The distinction 003 draws, and the reason row 5 is separate from row 6:** the address, the Maps embed and the bank accounts render a visible _"menyusul"_ on web today, so a late read leaves a gap anyone can see. The WhatsApp number and the Ketentuan are **hardcoded and plausible** — an admin edits them, the screen says saved, and customers keep messaging the old number and agreeing to the superseded terms. A blank is safe; a stale value that looks current is not. That is [architecture.md](../architecture.md)'s cross-repo binding #3 in its pure form, and it applies to those two rows and nothing else.

### 4. Who applies 005, and was it one paste? — **BLOCKS row 3**

- Pasted `begin;` through `commit;` in **one** execution? \_\_\_\_\_ _(the whole design of 005 is that the drop-and-re-add window never exists; a statement-by-statement paste re-creates it)_
- Afterwards, is `status_valid` present **and** does it list **five** values? \_\_\_\_\_ _(read `pg_get_constraintdef`. Do not infer it from an insert succeeding — a dropped-and-never-re-added constraint also lets the insert succeed, and lets every future typo in)_
- Is `uniq_active_slot` still present, still unique, and still `where status in ('pending','confirmed')`? \_\_\_\_\_
- Is `required-schema.ts` updated in the same change, so `check:schema` asserts the new shape rather than the old one? \_\_\_\_\_

### 5. Is there anything real in `bookings` yet? — **changes the risk, not the sequence**

- Live customer rows present? \_\_\_\_\_
- If yes: 005 runs against production data, and the drop-and-re-add is a window on a live table. Agreed timing: \_\_\_\_\_

## End-to-end verification for row 7

Both apps running locally against the same Supabase project. Not a code review.

1. In this app, soft-delete a `confirmed` booking. Within web's cache window, its slot reads **`available`** on the public site — proving `uniq_active_slot` and `toSlotStatus` agree that `deleted` is not active.
2. Book that same slot again on the public site. It succeeds. If it returns 409, the index predicate was changed and the "does not change" section above was not honoured.
3. Create a **walk-in** here with no proof. It appears in the queue, its detail page renders the _no-proof_ state, and nothing on that page attempts to sign a URL for a null key.
4. Edit a bank account here. The public booking page shows the new one.
5. Edit a **Ketentuan** rule here. The public home page shows the edit. **If it does not, row 5 was skipped, the field should not have been editable, and no error will ever tell you.**

Steps 2 and 5 are the two nobody runs, and they are the only evidence that the slot really was freed and that a settings write is not a no-op.

## Outcome — fill in during or immediately after

| Row                                                              | Done | Evidence   |
| ---------------------------------------------------------------- | ---- | ---------- |
| 1 — `deleted` authored in web, mapped to `available`             | ☐    | \_\_\_\_\_ |
| 2 — re-copied here, `check:domain` green both sides              | ☐    | \_\_\_\_\_ |
| 3 — 005 applied in one transaction, `uniq_active_slot` untouched | ☐    | \_\_\_\_\_ |
| 4 — web tolerates a null `proof_key`                             | ☐    | \_\_\_\_\_ |
| 5 — **web reads the WhatsApp number and the Ketentuan**          | ☐    | \_\_\_\_\_ |
| 6 — web reads address, Maps embed, bank accounts                 | ☐    | \_\_\_\_\_ |
| 7 — end-to-end verification passed                               | ☐    | \_\_\_\_\_ |

### Sign-off

- ☐ Complete, in order, verified at each row
- ☐ Complete with deviations — recorded above
- ☐ Blocked — reason recorded, and the reset ships its buildable half with create, soft delete and settings carried forward as open items

**Signed off by:** \_\_\_\_\_
**Date:** \_\_\_\_\_

## After this gate

Append the outcome to **both** repos' `docs/PROGRESS.md`, and annotate the schema requests as applied. Question 2's answer belongs in [PRODUCT.md](../PRODUCT.md) and next to [6-gate-settings-and-expiry](6-gate-settings-and-expiry.md) question 5 — the two are the same question about what a pending booking means, and answering one without the other leaves the expiry job specified against a premise that has changed.
