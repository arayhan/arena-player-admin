# 2 · step 03 — `/bookings/[id]`, one booking in full

**Depends**: 01 (`getBookingById`), 02 (the rows link here)
**Blocks**: 04 (the actions live on this page too), 05 (the proof panel mounts here)
**Agent**: `software-engineer`

## Goal

Every field of one booking, including the two the list deliberately does not carry: `notes` and the payment proof. This step builds everything except the proof — that is [step 05](2-step-05-proof.md), which is gated on a credential the user has deferred, and isolating it here is what keeps the rest of Phase 2 unblocked.

## Deliverables

- **`src/app/(dashboard)/bookings/[id]/page.tsx`** — Server Component, `export const dynamic = "force-dynamic"` (architecture.md's route map states it; the reason is the presign at step 05, and it must be present before step 05 rather than added with it).
  `params` is a **Promise in Next 16** and must be awaited.
- **`src/modules/bookings/booking-detail.tsx`** — all nine columns:

  | Field                        | Rendering                                                                                                                                       |
  | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
  | `booking_date` + `time_slot` | The heading. Date formatted Indonesian, slot verbatim from the canonical string                                                                 |
  | `team_name`                  | Below it                                                                                                                                        |
  | `phone`                      | `wa.me` link, same as the list — this is the admin's next action                                                                                |
  | `notes`                      | **Only place it appears.** Up to 500 chars, whitespace preserved, and an explicit empty rendering when null — `notes` is nullable in the schema |
  | `status`                     | `StatusPill`                                                                                                                                    |
  | `created_at`                 | Absolute timestamp **and** age, since age is what drives the 24h clock                                                                          |
  | `proof_key`                  | The key itself is shown as metadata; the image is step 05                                                                                       |
  | `id`                         | Not displayed. It is in the URL                                                                                                                 |

- **Breadcrumbs** — `Beranda / Booking / <team name>`, using the existing `Breadcrumbs` primitive. The "Booking" crumb links back to `/bookings`; it does **not** preserve the queue's filters, and that is a known small loss rather than an oversight — the browser's back button does preserve them, which is the whole reason filters are URL state.
- **A named, empty region for the proof panel**, with a comment pointing at step 05. Not a placeholder image, not a "menyusul" box that could ship by accident.
- **Action buttons region** — same treatment, filled by step 04.

## Two 404s, and one of them is a 500 by default

**A well-formed UUID that matches no row** → `notFound()`. Straightforward.

**A malformed id** → `where id = $1` against a `uuid` column raises Postgres `22P02` (`invalid_text_representation`), which propagates as an unhandled error and renders a 500. `/bookings/not-a-uuid` is one address-bar typo away and every crawler finds it. Validate the id as a UUID **before** the query — zod, in the page — and `notFound()` when it fails. Do not catch `22P02` after the fact: the query should never be issued.

Related and different: a `42P01` (undefined table) must become a **503**, never a 404 and never an empty render. `isUndefinedTableError` already exists in `src/server/schema-guard.ts`. The bookings console needs no new migration, so this is defence against the database being pointed somewhere wrong, which is exactly the failure [2-gate-migration](2-gate-migration.md) question 1 exists to prevent.

## Acceptance

```bash
pnpm dev        # with a valid session cookie in $C and a real booking id in $ID

# the three id cases
curl -s -o /dev/null -w "%{http_code}\n" -b "$C" "localhost:3001/bookings/$ID"                                  # 200
curl -s -o /dev/null -w "%{http_code}\n" -b "$C" "localhost:3001/bookings/00000000-0000-0000-0000-000000000000" # 404
curl -s -o /dev/null -w "%{http_code}\n" -b "$C" "localhost:3001/bookings/not-a-uuid"                           # 404, NOT 500

# notes render here and only here
curl -s -b "$C" "localhost:3001/bookings/$ID" | grep -ci "catatan"        # expect: >= 1
grep -rn "notes" src/modules/bookings/bookings-table.tsx                  # expect: no match

# the rules that fail at deploy or in a cache
grep -n "force-dynamic" "src/app/(dashboard)/bookings/[id]/page.tsx"
grep -rn "next/image" src/                                                # expect: no match
curl -sI -b "$C" "localhost:3001/bookings/$ID" | grep -i cache-control    # expect: private, no-store

# still no client component at this step
grep -rn "use client" src/modules/bookings                                # expect: no match

pnpm check && pnpm build
```

**Prove the 404s.** The malformed-id case must be observed returning 404 with the dev server's error log **silent** — a 404 rendered after a caught database exception is a different thing from a query never issued, and only the log tells them apart.

**Not done until** `/bookings/not-a-uuid` has been requested and returned 404. Reason: it is the only route in Phase 2 that takes raw user input straight into a typed database column, it is reachable by typing, and the default behaviour is a 500 that looks like the app is broken rather than like a bad link.

handoff: `software-engineer` for step 04
