# Client checkpoint — settings content, and what `expired` actually means

**Decided by:** the user, with the client. Two of these questions cannot be answered from inside either repo.
**Blocks:** the Pengaturan screen shipping with real values; and, for question 5, possibly the whole expiry design
**Status:** not yet held
**Format:** a conversation with the client, then a record. Not a sequence.
**Date completed:** \_\_\_\_\_

## Why this is a gate and not a step

Two different kinds of unanswerable sit in here.

The first is content: [003](../schema-requests/003-site-settings.md) creates the tables that hold the WhatsApp number, the Maps embed, the bank accounts and the rate card, but **a table is not an answer** — the field has to supply the values, and four of them are still `TODO(content)` in the web repo. Shipping the Pengaturan screen against invented values would put a fabricated bank account in front of paying customers, which [PRODUCT.md](../PRODUCT.md) forbids by name.

The second is worse, and was found by reading web's schema rather than its prose. It is question 5.

## Questions that must not be left unasked

### 1. Bank accounts — **confirmed, recorded here for the transcription**

Supplied by the user 2026-08-12:

| #   | Bank | Nomor rekening        | Atas nama     |
| --- | ---- | --------------------- | ------------- |
| 1   | BCA  | `7255105108`          | MARIANA ULFAH |
| 2   | BRI  | `4736-01-017915-53-2` | MARIANA ULFAH |

- Is this the full list, or are more coming? \_\_\_\_\_
- Which order should the customer see them in? The `sort_order` column is data, and the field will want its most-used bank first. \_\_\_\_\_
- Confirm each number and holder name against a bank statement, not from memory. A wrong digit here sends a customer's DP to a stranger. Checked? \_\_\_\_\_

### 2. Google Maps embed URL — **still outstanding**

`arena-player-web/src/modules/home/HomePage.tsx` has rendered _"Alamat dan titik Google Maps menyusul — menunggu data dari pihak lapangan"_ since Phase 1. Needs the `src` of the iframe from Google Maps → Share → Embed a map, not a shortened share link.

- URL: \_\_\_\_\_
- Address as it should read on the page: \_\_\_\_\_

### 3. The rate card — **still outstanding, and now blocks two things**

Unsupplied since the beginning. It now gates more than it did: the admin's revenue estimate in Statistik and the "Rekap pendapatan" dataset in Ekspor both derive from it, and web's `/booking` is the one page allowed to render a rupiah figure.

**Ask for the per-HOUR rate, not the per-slot rate.** Slots became one hour each on 2026-08-15 (eighteen of them, 06.00–24.00), so a rate quoted "per slot" from an earlier conversation means two hours and would be charged as one. If the client answers with a 2-hour figure, halve it explicitly with them rather than in the schema — `rate_card` stores one price per slot and there is nowhere for the ambiguity to be caught later.

- Tarif normal (06.00–16.00), **per 1-hour slot**: \_\_\_\_\_
- Tarif prime time (16.00–24.00), **per 1-hour slot**: \_\_\_\_\_
- Is prime time real, or is there one flat rate? \_\_\_\_\_
- Does a multi-hour booking get a discount? \_\_\_\_\_ _(the per-slot table sums; a four-hour game is now four rows, not two — see the bulk-pricing flag in [../schema-requests/003-site-settings.md](../schema-requests/003-site-settings.md))_
- DP percentage — the Ketentuan says 50%. Confirmed still 50%? \_\_\_\_\_

**Until this is answered the revenue figures stay hidden**, not estimated against a guess. A number on a dashboard is read as a fact.

### 4. WhatsApp number — **supplied, but confirm the move**

`6289682620666`, hardcoded in `home.constants.ts` since web's 2026-08-11 checkpoint. 003 moves it into `site_settings`.

- Still the correct number? \_\_\_\_\_
- Any objection to it becoming admin-editable rather than a code constant? \_\_\_\_\_

### 5. `expired` frees a slot the customer already paid for — **BLOCKS the expiry design, not just this gate**

This one was not noticed until the admin app was checked against web's actual DDL.

`bookings.proof_key` was **`NOT NULL`** when this was written, and web's documented flow uploads the transfer receipt to the proofs bucket **before** inserting the row. So a booking row could not exist without a payment proof attached, and every `pending` booking in the queue was one where the customer had **already transferred a DP**.

[PRODUCT.md](../PRODUCT.md) and [PRD.md](../PRD.md) describe expiry as freeing "abandoned" slots — a customer who started a booking and walked away. **With `proof_key NOT NULL` that customer could not exist.** What the 24-hour job actually does is release the slot of someone who paid, because the admin did not action it in time.

> **AMENDED 2026-08-15 — the premise weakened, the question got harder.** [005](../schema-requests/005-admin-writes-bookings.md) makes `proof_key` nullable so the admin can create walk-in bookings, and web had already turned its proof field off from its own side. So "every pending row carries a transferred DP" is no longer true, and **the row alone no longer says which kind it is**:
>
> - **(a)** online, DP transferred, proof attached — the case this question was written about;
> - **(b)** walk-in, cash, no proof — new, and expiry would release a slot already paid for in full-view of the person who took the money.
>
> Case (b) is **largely defused** by the decision that a walk-in enters at `confirmed` ([005](../schema-requests/005-admin-writes-bookings.md)), since expiry only touches `pending`. It is not eliminated: any future path that creates a `pending` row without a proof reopens it, and nothing in the schema prevents one.

- Is releasing a paid customer's slot the intended behaviour? \_\_\_\_\_
- If not, which changes — the expiry rule, or the requirement to upload before booking? \_\_\_\_\_
- If it stays: what happens to the DP of an expired booking, and who tells the customer? There is no customer-facing notification anywhere in the system. \_\_\_\_\_
- Should expiry skip rows with a null `proof_key` outright? \_\_\_\_\_ _(cheap to implement, but it is a product rule and inventing it here is exactly what this gate exists to prevent)_

**This is a product question, not an engineering one**, which is why it is a signature and not a ticket. Do not code around it: the expiry job in Phase 3 is already specified against the current reading, and changing the answer changes what that job is for.

## Outcome — fill in during or immediately after

| Question                                        | Answered | Answer / evidence |
| ----------------------------------------------- | -------- | ----------------- |
| 1 — bank accounts confirmed and ordered         | ☐        | \_\_\_\_\_        |
| 2 — Maps embed URL                              | ☐        | \_\_\_\_\_        |
| 3 — rate card + DP percentage                   | ☐        | \_\_\_\_\_        |
| 4 — WhatsApp number, and moving it to the table | ☐        | \_\_\_\_\_        |
| 5 — **what `expired` means**                    | ☐        | \_\_\_\_\_        |

### Sign-off

- Held on: \_\_\_\_\_
- Present: \_\_\_\_\_
- Recorded by: \_\_\_\_\_

## After this gate

Question 5's answer goes into [PRODUCT.md](../PRODUCT.md) and [PRD.md](../PRD.md) as a correction, and into `arena-player-web`'s own docs via a note in [PROGRESS.md](../PROGRESS.md) — a decision recorded only here is one the other repo's next session will not find. Questions 1–4 become the first rows written into `site_settings` and `bank_accounts`, and only then does the Pengaturan screen stop saying "belum tersambung ke data asli".
