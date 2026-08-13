# The admin's own R2 token — a **second**, read-only credential

**Decided by:** the user, minting the token in the client's Cloudflare account. The developer records the shape, never the secret.
**Blocks:** the live half of [2-step-05-proof](2-step-05-proof.md), and two Phase 2 DoD lines — the proof rendering through a presigned GET, and the expired-URL recovery being seen against a real object
**Status:** deferred by the user. Steps 01–04 are unaffected; step 05 is buildable and partly verifiable without it — see below
**Date completed:** \_\_\_\_\_

## Why this is a gate and not "wait for a credential"

Handing this app **web's** R2 key works. Presigning works, the proof renders, `pnpm check:setup` passes, every acceptance criterion in step 05 goes green. There is no check anywhere in either repo that can tell the two keys apart, and there never will be — a credential's _provenance_ is not observable from its behaviour.

So the three properties this design depends on are all invisible:

1. **Read-only.** An admin-side compromise cannot delete or overwrite payment evidence. With web's read-write key, it can.
2. **Separate.** Web's key is handed to the client at handover. One shared key means one rotation silently breaks two apps, and the person rotating it will be looking at only one.
3. **Scoped to the one bucket.** Nothing in this app has a reason to see any other object in the account.

The decision recorded in [architecture.md](../architecture.md) ("Its own credential") is correct and already written. This gate exists because it is the kind of decision that gets quietly undone by whoever is holding a working key at the moment the page is blank, and a signature is the only detector.

## What to mint

| Property     | Required value                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Type         | R2 API token, **Object Read only**                                                                  |
| Bucket scope | `arena-player-proofs` only — not account-wide                                                       |
| Used by      | `arena-player-admin` alone. Never pasted into web's `.env`                                          |
| Env vars     | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — see `.env.local.example` |

The bucket itself stays **private**: no public bucket URL, no `r2.dev` subdomain enabled, no custom domain. If one is ever turned on, the entire presigned-GET design becomes decoration — every proof becomes fetchable by anyone who can guess a key, and nothing in either app reports it.

## Questions that must not be left unasked

### 1. Is this a genuinely second token? — **the whole point of this gate**

- Token name / ID as it appears in Cloudflare (never the secret): \_\_\_\_\_
- Distinct from the token in web's `.env`? \_\_\_\_\_
- Permission shown in the Cloudflare UI: \_\_\_\_\_ _(must read Object Read, not Object Read & Write)_
- Bucket scope shown: \_\_\_\_\_ _(must name one bucket)_

### 2. Is it the same bucket web writes proofs into? — **BLOCKS step 05's live half**

Different bucket = every `proof_key` in `bookings` resolves to a 404, and the failure renders as the expired-link recovery. The admin sees a working recovery button that never recovers anything.

- Bucket name in admin's `.env.local`: \_\_\_\_\_
- Bucket name in web's `.env.local`: \_\_\_\_\_
- Identical? \_\_\_\_\_

### 3. Is the bucket still private?

- Public bucket URL / `r2.dev` access disabled? \_\_\_\_\_
- Custom domain attached? \_\_\_\_\_ _(expected: none)_

### 4. Who holds it after handover, and what breaks if it is rotated?

- Recorded for the Phase 5 handover list? \_\_\_\_\_
- Understood that rotating this token affects **only** the admin's proof view, and rotating web's affects **only** uploads? \_\_\_\_\_ _(that separation is the reason there are two)_

## What is buildable and verifiable **without** this gate

Step 05 does not wait. `presignProofUrl` mints a URL from whatever credentials are in the environment; it does not contact R2 and does not validate that the object exists. So with **syntactically valid but unauthorised dummy values** in the three R2 vars:

- the presign path executes end to end and produces a well-formed URL;
- the browser's fetch of it fails;
- the `onError` handler fires and the **"Muat ulang bukti"** recovery renders instead of a broken-image icon — which is the exact Phase 2 DoD line, provable with no real bucket at all;
- two consecutive renders can be compared to prove a **fresh** URL is minted per request rather than memoised.

Step 05 carries the commands for all four.

## What stays unproven until this gate clears

Written out so it is carried into the DoD rather than assumed away:

1. **That a real proof object renders.** Nothing above requires the object to exist.
2. **That `responseChecksumValidation: "WHEN_REQUIRED"` is doing its job.** [database.md](../database.md) gotcha 2 is explicit that leaving it at the SDK default makes GETs fail "in a way that looks like a credentials problem" — and with dummy credentials every failure looks like a credentials problem. This is the one trap the substitute verification structurally cannot distinguish.
3. **That the keys web writes are readable by this token** — same bucket, same prefix, same account.

All three become one five-minute check the moment a real token and one real booking exist together.

## Outcome — fill in during or immediately after

| Item                                        | Done | Evidence   |
| ------------------------------------------- | ---- | ---------- |
| Second token minted, Object Read only       | ☐    | \_\_\_\_\_ |
| Scoped to `arena-player-proofs` alone       | ☐    | \_\_\_\_\_ |
| Same bucket as web's uploads                | ☐    | \_\_\_\_\_ |
| Bucket confirmed private, no public URL     | ☐    | \_\_\_\_\_ |
| `pnpm check:setup` — R2 presign round-trips | ☐    | \_\_\_\_\_ |
| A real proof rendered in the browser        | ☐    | \_\_\_\_\_ |

### Sign-off

- ☐ Complete — the three unproven items above are now proven, and PROGRESS says so
- ☐ Deferred again — step 05 ships with the three items recorded as open in the Phase 2 DoD
- ☐ Deviation — web's key reused, with the reason and the rotation consequence written here: \_\_\_\_\_

**Signed off by:** \_\_\_\_\_
**Date:** \_\_\_\_\_
