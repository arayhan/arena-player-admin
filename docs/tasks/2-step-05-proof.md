# 2 · step 05 — The payment proof

**Depends**: 03 (it mounts in the detail page's proof region). [2-gate-r2-token](2-gate-r2-token.md) gates its **live** half only — build and the substitute verification below do not wait
**Blocks**: 06
**Agent**: `software-engineer`

## Goal

Render a private payment document, from a private bucket, through a URL that stops working in two minutes — and make the moment it stops working legible instead of broken.

This is the step with the worst available mistake in the repo in it.

## The three rules, and why each fails silently

**Never `next/image`.** Next's optimizer proxies the presigned URL, writes the decoded output to an on-disk cache keyed by that URL, and serves it from a stable `/_next/image?url=…` path with a long TTL. That copies a payment document — a name, an amount, a bank transfer — out of the private bucket into a cache that outlives the presign entirely. It renders perfectly. Nothing reports it. Plain `<img>`. Hard rule 2.

**`force-dynamic` on the detail page**, already landed at step 03. A cached RSC payload serves a URL that expired minutes ago, and the symptom is a broken image the admin blames on their connection.

**TTL is 120 seconds**, `PROOF_URL_TTL_SECONDS` in `src/server/storage.ts`, already correct. It is short because a presigned GET is a **bearer capability**: anyone holding the URL can fetch the document, and URLs leak through history, screenshots and the `Referer` header.

One more, in the same family: **never render the presigned URL as text or as an `<a href>`.** It belongs in exactly one place — the `src` of the `<img>`.

## Deliverables

- **`src/modules/bookings/proof-panel.tsx`** — Server Component. Calls `presignProofUrl(booking.proof_key)` **on every render**; no module-level memo, no cache wrapper. Renders a plain `<img>` with a meaningful `alt` naming the booking, inside the region step 03 left for it.
- **`src/modules/bookings/proof-frame.tsx`** — **`"use client"`.** It holds the `onError` handler, which is a browser event and has no server equivalent. On error it replaces the image with the recovery block:

  > **Tautan bukti sudah kedaluwarsa.** Tautan hanya berlaku 120 detik karena ini dokumen pembayaran. Muat ulang untuk membuat tautan baru.

  and a **"Muat ulang bukti"** button that calls `router.refresh()`. Not a `fetch`, not a route handler, not a client-side data call — the page is `force-dynamic`, so a refresh re-runs the Server Component and mints a fresh URL. That is the whole mechanism and it keeps "no client data-fetching" true.

- **Correct architecture.md's client-component rule.** Its boundary section still says `"use client"` appears **exactly once in v1**, naming this component. That has been false since the shell landed: `theme-toggle.tsx` and `nav-drawer.tsx` are both client components. This one is the **third**, and rule 3 requires a written reason here — write all three, and restate the rule as "each `"use client"` file is named here with its reason" rather than a count that will be wrong again by Phase 4.

## What is not built, deliberately

**The mockup's live countdown** — "Tautan berlaku 87 detik lagi", ticking each second. Dropped. It re-renders a client component once per second to display a number derived from the client's clock about a signature minted on the server, and the two disagree whenever a render is warm or a clock is skewed. It would then confidently tell the admin the link is fine at the moment it stops working. The `onError` path is the only honest signal, and it is the one that already has to exist.

**A `/api/proof/[id]` proxy route.** Rejected in architecture.md: it pushes megabytes through the same Node process that serves the queue and runs the expiry job, and discards the zero-egress reason R2 was chosen. The browser fetches R2 directly.

## Verifying this **without** R2 credentials

The user has deferred the credential. `presignProofUrl` signs locally — it never contacts R2 and never checks that the object exists — so with **syntactically valid but unauthorised dummy values** in `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`, the whole path executes and the fetch fails at the browser. That failure is exactly the state the recovery exists for.

```bash
# dummy, non-empty, syntactically plausible — NOT real credentials
R2_ACCOUNT_ID=0000000000000000000000000000dead \
R2_ACCESS_KEY_ID=0000000000000000000000000000beef \
R2_SECRET_ACCESS_KEY=00000000000000000000000000000000000000000000000000000000000000ba \
pnpm dev

# 1. a well-formed presigned URL is produced and lands in the img src
curl -s -b "$C" "localhost:3001/bookings/$ID" | grep -o 'X-Amz-Signature=[a-f0-9]\{16\}' | head -1

# 2. it is minted per request, not memoised — two renders, two signatures
for i in 1 2; do curl -s -b "$C" "localhost:3001/bookings/$ID" \
  | grep -o 'X-Amz-Date=[0-9TZ]*&[^"]*X-Amz-Signature=[a-f0-9]*' | head -1; done
# expect: two DIFFERENT signatures

# 3. the URL never appears anywhere but the img src
curl -s -b "$C" "localhost:3001/bookings/$ID" | grep -c 'href="https://[^"]*X-Amz-Signature'   # expect: 0

# 4. the expiry TTL is the one that is written down
grep -n "PROOF_URL_TTL_SECONDS" src/server/storage.ts       # expect: 120

# 5. the rule that would be invisible in review
grep -rn "next/image" src/                                   # expect: no match, anywhere
grep -rn "use client" src/                                   # expect: exactly 3 files, all named in architecture.md
```

**Then open it in a browser.** The image request 403s, `onError` fires, and the recovery block plus **"Muat ulang bukti"** renders in place of a broken-image icon. That is the Phase 2 DoD line _"An expired presigned URL produces a visible 'Muat ulang bukti' recovery, not a broken image icon"_, proven against no bucket at all. Click the button and confirm a new signature is minted.

## What stays unproven, and must be written down rather than assumed

Carry these three into `docs/PROGRESS.md` and the Phase 2 DoD, and into [2-gate-r2-token](2-gate-r2-token.md)'s outcome table:

1. **That a real proof object renders.** Nothing above needs the object to exist.
2. **That `responseChecksumValidation: "WHEN_REQUIRED"` is doing its job.** [database.md](../database.md) gotcha 2 is explicit that the default setting makes GETs fail "in a way that looks like a credentials problem" — and with dummy credentials, every failure looks like a credentials problem. This is the one trap the substitute verification structurally cannot see.
3. **That the keys web writes are readable by this token** — same bucket, same account, same prefix.

## Acceptance

```bash
pnpm check && pnpm build
grep -n "force-dynamic" "src/app/(dashboard)/bookings/[id]/page.tsx"
curl -sI -b "$C" "localhost:3001/bookings/$ID" | grep -i cache-control    # expect: private, no-store
grep -n "proof-frame\|proof-panel" docs/architecture.md                  # the third client component has its written reason
```

**Not done until** the recovery state has been **seen in a browser**, not asserted in a test, and the three unproven items above are recorded in PROGRESS and the DoD. Reason: this is the one surface whose only failure mode is invisible until the exact moment the admin needs it — they are looking at a payment before releasing a field — and a recovery path that has never rendered is a recovery path nobody has.

handoff: `software-engineer` for step 06
