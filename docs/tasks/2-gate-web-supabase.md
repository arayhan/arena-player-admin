# Cross-repo checkpoint — `arena-player-web` moves onto Supabase

**Decided by:** the developer, in an `arena-player-web` session. Nobody in this repo can apply these edits.
**Blocks:** [2-gate-migration](2-gate-migration.md) row 4 (real test data), the live half of [2-step-05-proof](2-step-05-proof.md), and the cross-repo proof in [2-step-06-verification](2-step-06-verification.md). Phase 2 can be _built_ without it and cannot be _closed_ without it
**Status:** not yet held
**Format:** a sequence, verified at each row. Not a meeting
**Date completed:** \_\_\_\_\_

## Where things actually stand

The project moved from Neon Postgres to Supabase Postgres and from Cloudflare R2 to Supabase Storage. **This repo has moved. Web has not.**

Web today has `DATABASE_URL` plus four `R2_*` vars in its `.env.local.example`, no Supabase variables at all, and **no database driver installed** — its `src/server/` is empty. Its `db/migrations/20260809_create_bookings.sql` exists and has never been applied to anything. So the provider switch has not broken web; it has simply not reached it, and nothing in web will report the gap, because web has no code that talks to a database yet.

That is what makes this a gate. **Nothing is red.** Both repos build, both check suites pass, and the two apps are configured for two different infrastructures. The first symptom is the one this project keeps producing: two apps that each work perfectly against a backend the other one cannot see.

## Why this is a gate and not a step

**No agent in this repo may touch that one.** Web owns its own source, its own `.env.local.example`, and `db/migrations/` (hard rule 1); a cross-repo edit applied from an admin session is exactly the concurrent-session failure web's own rules exist to prevent. The actor is a developer in a web session, working from this file.

And the ordering is load-bearing rather than tidy. Until web writes proofs into the Supabase bucket, **every `proof_key` in `bookings` names an object that does not exist**, and the admin's proof view fails on every row — rendering, in the best case, a recovery button that never recovers anything. Confirming a payment you cannot see is the one thing this console must never ask its user to do.

## The sequence — each row must be true before the next is attempted

| #   | Step                                                                                                               | Who                         | Verified by                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------- |
| 1   | The Supabase project is chosen and named — **one project, both apps**                                              | user                        | project ref written into row 1 of [2-gate-migration](2-gate-migration.md) |
| 2   | Web's `DATABASE_URL` repointed at that project's **transaction pooler**, port `6543`                               | developer, in a web session | project ref identical to this repo's, port `6543` in both                 |
| 3   | Web's four `R2_*` vars **deleted** from `.env.local.example` and replaced with the Supabase Storage vars           | developer, in a web session | no `R2_` string survives anywhere in web                                  |
| 4   | Web installs the same driver pins this repo set: `postgres` and `@supabase/supabase-js`                            | developer, in a web session | versions identical between the two `package.json` files                   |
| 5   | Web's upload path writes to the Supabase proofs bucket, and stores the object **key** in `proof_key` — never a URL | developer, in a web session | a real upload lands in the bucket; the stored value has no scheme         |
| 6   | Web's DB client carries `prepare: false` and the DATE/TIMESTAMPTZ OID override                                     | developer, in a web session | its own colocated test, run                                               |
| 7   | Only now: a booking made on the local public site is opened in this admin app, proof and all                       | both repos                  | the end-to-end check below                                                |

**Row 5 is the one that gets skipped**, because it is the only row that is not a config change. Repointing a connection string is five seconds; rewriting an upload from the S3 SDK to `supabase.storage.from(bucket).upload(...)` is real work, and a half-done version that still writes to R2 leaves rows whose `proof_key` is valid, non-null, and points into a bucket nobody reads any more.

**Row 6 is the one that is invisible.** Both halves fail silently rather than loudly: without `prepare: false` the pooler produces intermittent "prepared statement does not exist" errors under exactly the concurrency it was chosen for, and without the OID override an Asia/Jakarta machine shifts `booking_date` back one day on serialization. The second is worse — the two apps would then disagree about which day a booking is for, while both display something plausible.

## Questions that must not be left unasked

### 1. One project, or one per app? — **BLOCKS everything**

Two Supabase projects produce the split-brain in the section above. A second project is free and two clicks away, which is precisely why it happens; there is no cost signal and no error.

- Project ref web will use: \_\_\_\_\_
- Project ref this repo uses: \_\_\_\_\_
- Identical? \_\_\_\_\_
- How many Supabase projects exist in the client's org, and what is each for? \_\_\_\_\_

### 2. Does web need a **write** credential, and what is it? — **BLOCKS row 5**

This app reads proofs with the anon key under a `select`-only RLS policy ([2-gate-storage-credential](2-gate-storage-credential.md)). Web must **write** to the same bucket, which that policy deliberately does not permit.

- What credential does web's upload use? \_\_\_\_\_
- If it is `service_role`: is it confined to the server-side upload route, and is it kept out of every client bundle? \_\_\_\_\_ _(it bypasses RLS on every table and bucket in the project, `bookings` included)_
- If it is the anon key plus an `insert` policy: what is the policy's `bucket_id` predicate, and does it grant `insert` **only**? \_\_\_\_\_
- Either way — does the admin's read policy stay `select`-only afterwards? \_\_\_\_\_ _(policies are additive; a broad write policy added for web can silently hand this app write access it is designed not to have)_

> **To decide with the API in front of you, not from memory:** whether uploading from the browser directly (a signed upload URL) or through web's own route handler is the right shape here. It changes which credential is needed and where it lives, and it is the kind of choice that is expensive to reverse once `proof_key` values exist.

### 3. What happens to the objects already in R2? — **BLOCKS nothing today, and will later**

- Any real customer bookings with `proof_key` values pointing into R2? \_\_\_\_\_
- If yes: are those objects migrated into the Supabase bucket, or are those rows accepted as unviewable? \_\_\_\_\_
- If the database is still empty of real rows, say so here — it makes this a non-question, permanently, and saves the next person asking it: \_\_\_\_\_

### 4. Is anything still paying for R2 or Neon? — **BLOCKS nothing, costs money**

- Neon project deleted or paused? \_\_\_\_\_
- R2 bucket and its API tokens revoked? \_\_\_\_\_ _(a live read-write token against a bucket nobody watches is worse than a bill)_

### 5. Are the driver versions actually pinned together? — **BLOCKS nothing, drifts everything**

This repo resolved `postgres` and `@supabase/supabase-js` first, so its versions are the de-facto standard ([1a-step-01-architecture](1a-step-01-architecture.md) records the same rule).

- Versions in web's `package.json`: \_\_\_\_\_
- Identical to this repo's? \_\_\_\_\_
- Recorded in web's `docs/architecture.md`? \_\_\_\_\_

## End-to-end verification for row 7

Not a code review. Performed with both apps running locally against the same project.

1. Make a booking on the public site at `localhost:3000`, uploading a real image as the payment proof.
2. Confirm in the Supabase dashboard that the object landed in the proofs bucket, and that `bookings.proof_key` holds its **key** — no scheme, no host, no signed token.
3. Open the booking in this admin app at `localhost:3001/bookings/[id]`. The proof renders.
4. Confirm it here; within 30 seconds — web's `s-maxage` window — the slot reads `booked` on the public site.
5. Reject it; the slot returns to `available`.

Steps 3 and 5 are the two halves nobody tests together, and they are the only evidence that the two apps share one backend.

## Outcome — fill in during or immediately after

| Row                                         | Done | Evidence   |
| ------------------------------------------- | ---- | ---------- |
| 1 — one project, ref recorded               | ☐    | \_\_\_\_\_ |
| 2 — web on the transaction pooler           | ☐    | \_\_\_\_\_ |
| 3 — no `R2_` var survives in web            | ☐    | \_\_\_\_\_ |
| 4 — driver pins identical                   | ☐    | \_\_\_\_\_ |
| 5 — **uploads land in the Supabase bucket** | ☐    | \_\_\_\_\_ |
| 6 — `prepare: false` + OID override in web  | ☐    | \_\_\_\_\_ |
| 7 — end-to-end verification passed          | ☐    | \_\_\_\_\_ |

### Sign-off

- ☐ Complete, in order, verified at each row
- ☐ Complete with deviations — recorded above
- ☐ Blocked — reason recorded, and Phase 2 closes with the cross-repo proof carried forward as an open item

**Signed off by:** \_\_\_\_\_
**Date:** \_\_\_\_\_

## After this gate

Append the outcome to **both** repos' `docs/PROGRESS.md`. A cross-repo decision recorded in one log is a decision the other repo's next session will not find — and web's own docs still describe Neon and R2 as its infrastructure until someone edits them.
