# 2 · step 05 — The payment proof

**Depends**: 03 (it mounts in the detail page's proof region). [2-gate-storage-credential](2-gate-storage-credential.md) gates its **live** half only — build and the substitute verification below do not wait
**Blocks**: 06
**Agent**: `software-engineer`

## Goal

Render a private payment document, from a private Supabase Storage bucket, through a signed URL that stops working in two minutes — and make the moment it stops working legible instead of broken.

This is the step with the worst available mistake in the repo in it.

## The three rules, and why each fails silently

**Never `next/image`.** Next's optimizer proxies the signed URL, writes the decoded output to an on-disk cache keyed by that URL, and serves it from a stable `/_next/image?url=…` path with a long TTL. That copies a payment document — a name, an amount, a bank transfer — out of the private bucket into a cache that outlives the signature entirely. It renders perfectly. Nothing reports it. Plain `<img>`. Hard rule 2.

**`force-dynamic` on the detail page**, already landed at step 03. A cached RSC payload serves a URL that expired minutes ago, and the symptom is a broken image the admin blames on their connection.

**TTL is 120 seconds**, `PROOF_URL_TTL_SECONDS` in `src/server/storage.ts`. It is short because a Supabase signed URL is a **bearer capability**: the token in its query string is all anyone needs to fetch the document, and URLs leak through history, screenshots and the `Referer` header.

One more, in the same family: **never render the signed URL as text or as an `<a href>`.** It belongs in exactly one place — the `src` of the `<img>`.

## Deliverables

- **`src/modules/bookings/proof-panel.tsx`** — Server Component. Calls `src/server/storage.ts`'s proof-URL signer with `booking.proof_key` **on every render**; no module-level memo, no cache wrapper. Renders a plain `<img>` with a meaningful `alt` naming the booking, inside the region step 03 left for it.

- **A second failure state, new with Supabase and easy to miss.** `createSignedUrl` is a **server round-trip**, not a local HMAC, so signing can fail before any URL exists — bad credentials, an unreachable project, an RLS policy that does not grant `select`, or a `proof_key` naming no object. That failure lands in the Server Component, not in the browser, and it must **not** be collapsed into the expired-link recovery: "the link timed out, press refresh" is actively misleading advice for a misconfigured bucket, and pressing the button produces the identical failure forever. Render a distinct message, and log the underlying error server-side where the admin cannot see it.

  > **To verify against a real project before this is finalised:** whether `createSignedUrl` returns an error for a key that does not exist, or signs a URL that only fails when fetched — the two put the failure in different halves of this component. Also unverified: the HTTP status the signed URL returns for a missing object versus an expired token. Write the branch against what the API actually does, and record what it did.

- **`src/modules/bookings/proof-frame.tsx`** — **`"use client"`.** It holds the `onError` handler, which is a browser event and has no server equivalent. On error it replaces the image with the recovery block:

  > **Tautan bukti sudah kedaluwarsa.** Tautan hanya berlaku 120 detik karena ini dokumen pembayaran. Muat ulang untuk membuat tautan baru.

  and a **"Muat ulang bukti"** button that calls `router.refresh()`. Not a `fetch`, not a route handler, not a client-side data call — the page is `force-dynamic`, so a refresh re-runs the Server Component and mints a fresh URL. That is the whole mechanism and it keeps "no client data-fetching" true.

- **Correct architecture.md's client-component rule.** Its boundary section still says `"use client"` appears **exactly once in v1**, naming this component. That has been false since the shell landed: `theme-toggle.tsx` and `nav-drawer.tsx` are both client components. This one is the **third**, and rule 3 requires a written reason here — write all three, and restate the rule as "each `"use client"` file is named here with its reason" rather than a count that will be wrong again by Phase 4.

## What is not built, deliberately

**The mockup's live countdown** — "Tautan berlaku 87 detik lagi", ticking each second. Dropped. It re-renders a client component once per second to display a number derived from the client's clock about a signature minted on the server, and the two disagree whenever a render is warm or a clock is skewed. It would then confidently tell the admin the link is fine at the moment it stops working. The `onError` path is the only honest signal, and it is the one that already has to exist.

**A `/api/proof/[id]` proxy route.** Rejected in architecture.md: it pushes megabytes through the same Node process that serves the queue and runs the expiry job, and it re-implements in application code the authorisation that the RLS policy and the signed URL already perform. The browser fetches Supabase Storage directly.

## Verifying this **without** the storage credential

**Read this before reusing the old procedure.** Under R2 the signature was a local HMAC: dummy credentials still produced a well-formed URL, so the whole path ran and failed only at the browser's fetch. **That substitute is gone.** Supabase signs on its own server, so dummy credentials fail at the call and the browser never sees a URL at all — a run with fake values now exercises the signing-failure branch, not the expiry branch.

Both branches still have to be proven, by different means:

**A. The signing-failure branch — free, no credential needed.** Point `SUPABASE_URL` / `SUPABASE_ANON_KEY` at plausible nonsense and load a booking detail page. The panel must render its distinct "proof could not be loaded" message, the server log must carry the real reason, and **"Muat ulang bukti"** must not be the advice offered.

**B. The expiry branch — the Phase 2 DoD line.** It needs a URL of the right shape, not a working one. Two routes, in order of preference:

1. A real signed URL, aged past its 120 seconds (needs the credential, once).
2. Failing that, a hand-mangled `token=` query value on a URL of the right shape, injected in place of the signer's return during a dev run. It proves the same thing the DoD asks for — that a browser-side image failure renders the recovery instead of a broken-image icon.

```bash
# --- static rules, no credentials, no network ---

# 1. the expiry TTL is the one that is written down
grep -n "PROOF_URL_TTL_SECONDS" src/server/storage.ts       # expect: 120

# 2. the rules that would be invisible in review
grep -rn "next/image" src/                                   # expect: no match, anywhere
grep -rn "use client" src/                                   # expect: exactly 3 files, all named in architecture.md

# 3. no signature is memoised anywhere
grep -rn "unstable_cache\|React.cache\|\bcache(" src/modules/bookings/proof-panel.tsx   # expect: no match

# --- with a working credential, against a real object ---
# 4. a signed URL is produced and lands in the img src
curl -s -b "$C" "localhost:3001/bookings/$ID" | grep -o 'storage/v1/object/sign/[^"]*token=[A-Za-z0-9._-]\{16\}' | head -1

# 5. it is minted per request, not memoised — two renders, two tokens
for i in 1 2; do curl -s -b "$C" "localhost:3001/bookings/$ID" \
  | grep -o 'token=[A-Za-z0-9._-]*' | head -1; done
# expect: two DIFFERENT tokens

# 6. the URL never appears anywhere but the img src
curl -s -b "$C" "localhost:3001/bookings/$ID" | grep -c 'href="[^"]*token='   # expect: 0
```

**Then open it in a browser.** The image request fails, `onError` fires, and the recovery block plus **"Muat ulang bukti"** renders in place of a broken-image icon. That is the Phase 2 DoD line _"An expired signed URL produces a visible 'Muat ulang bukti' recovery, not a broken image icon"_. Click the button and confirm a **new** token is minted.

## What stays unproven, and must be written down rather than assumed

Carry these three into `docs/PROGRESS.md` and the Phase 2 DoD, and into [2-gate-storage-credential](2-gate-storage-credential.md)'s outcome table:

1. **That a real proof object renders.** Nothing above needs the object to exist.
2. **That the credential is read-only in fact.** The only honest proof is a negative one: attempt an upload or a delete against the proofs bucket with this key and watch it be refused. A `service_role` key pasted "just to unblock" passes every other check in this file, and that is precisely the substitution this phase is exposed to.
3. **That the keys web writes are readable by this credential** — same project, same bucket, same prefix.

## Acceptance

```bash
pnpm check && pnpm build
grep -n "force-dynamic" "src/app/(dashboard)/bookings/[id]/page.tsx"
curl -sI -b "$C" "localhost:3001/bookings/$ID" | grep -i cache-control    # expect: private, no-store
grep -n "proof-frame\|proof-panel" docs/architecture.md                  # the third client component has its written reason
```

**Not done until** the recovery state **and** the signing-failure state have both been **seen in a browser**, not asserted in a test, and the three unproven items above are recorded in PROGRESS and the DoD. Reason: this is the one surface whose only failure mode is invisible until the exact moment the admin needs it — they are looking at a payment before releasing a field — and a recovery path that has never rendered is a recovery path nobody has.

handoff: `software-engineer` for step 06
