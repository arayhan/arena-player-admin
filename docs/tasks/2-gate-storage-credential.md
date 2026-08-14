# The admin's proof credential — read-only **by construction**, not by promise

**Decided by:** the user, in the client's Supabase project dashboard. The developer records the shape, never the secret.
**Blocks:** the live half of [2-step-05-proof](2-step-05-proof.md), and two Phase 2 DoD lines — the proof rendering through a signed URL, and the expired-link recovery being seen against a real object
**Status:** deferred by the user. Steps 01–04 are unaffected; step 05 is buildable and partly verifiable without it — see below
**Date completed:** \_\_\_\_\_

## Why this is a gate and not "wait for a credential"

Handing this app the project's **`service_role`** key works. Signing works, the proof renders, `pnpm check:setup` passes, every acceptance criterion in step 05 goes green. There is no check anywhere in either repo that can tell the two keys apart, and there never will be — a credential's _authority_ is not observable from a request that would have succeeded either way.

So the three properties this design depends on are all invisible:

1. **Read-only.** An admin-side compromise cannot delete or overwrite payment evidence. With `service_role` it can — that key bypasses RLS entirely, on every bucket and every table in the project, including `bookings`.
2. **Separate from web's write path.** Web uploads proofs; this app only looks at them. One shared credential means one rotation silently breaks two apps, and the person rotating it will be looking at only one.
3. **Scoped to the one bucket.** Nothing in this app has a reason to see any other object in the project.

The decision recorded in [architecture.md](../architecture.md) ("Its own credential") is correct and already written. This gate exists because it is the kind of decision that gets quietly undone by whoever is holding a working key at the moment the page is blank, and a signature is the only detector.

## What changed with the move off R2, and why it makes this gate harder

Under R2 the credential carried its own scope: an API token could be minted "Object Read only" on one bucket, and the token itself was the boundary. **Supabase has no such token.** The anon key is a project-wide JWT with the `anon` role. Its scope is not a property of the key — it is a property of the **RLS policies on `storage.objects`**, which live in the database and can be widened by anyone with SQL access, at any time, without touching the key or redeploying anything.

The boundary moved from the credential into the schema. That is the whole reason this gate now has a policy row in it rather than a permission dropdown.

## What must be true

| Property           | Required value                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Project            | The **same** Supabase project as `arena-player-web` — same project ref                                                                   |
| Bucket             | The proofs bucket, **private** (`public = false`)                                                                                        |
| Key handed to this app | The project's **anon** key. **Never `service_role`**                                                                                 |
| Authorisation      | One RLS policy on `storage.objects`: `select` only, `to anon`, `using (bucket_id = '<proofs bucket>')`. No `insert`, `update` or `delete` |
| Env vars           | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PROOFS_BUCKET` — see `.env.local.example`                                                 |

The bucket itself stays **private**. If it is ever flipped public, the entire signed-URL design becomes decoration — every proof becomes fetchable by anyone who can guess a key, the TTL stops meaning anything, and nothing in either app reports it. A public bucket is one toggle in the dashboard and produces no error anywhere.

> **To verify in the dashboard, not from memory:** newer Supabase projects present API keys as **publishable** / **secret** rather than **anon** / **service_role**. If the project shows the new pair, confirm which one carries the `anon` role and RLS enforcement before pasting anything, and record the name used here. The rule is unchanged — the RLS-enforced key, never the bypass key — only the label is.

## Questions that must not be left unasked

### 1. Is this the anon key, and does RLS actually constrain it? — **the whole point of this gate**

- Key label as it appears in the Supabase dashboard (never the value): \_\_\_\_\_
- Confirmed **not** `service_role` / the secret key? \_\_\_\_\_
- Is RLS **enabled** on `storage.objects`? \_\_\_\_\_ _(a policy on a table with RLS off constrains nothing and reads as if it does)_
- Policy name, and the exact operation it grants: \_\_\_\_\_ _(must read `SELECT`, not `ALL`)_
- Policy's `bucket_id` predicate: \_\_\_\_\_ _(must name one bucket; a policy with no bucket predicate grants the whole project)_
- Any **other** policy on `storage.objects` granting `anon` more than this one? \_\_\_\_\_ _(policies are additive — a permissive leftover elsewhere silently restores write access)_

### 2. Is it the same bucket web writes proofs into? — **BLOCKS step 05's live half**

Different bucket = every `proof_key` in `bookings` resolves to nothing, and the failure renders as the expired-link recovery. **The admin sees a working recovery button that never recovers anything** — they click it, a fresh URL is minted, it fails identically, and the only visible signal is the same message that means "this is normal, try again".

- Bucket name in admin's `.env.local`: \_\_\_\_\_
- Bucket name in web's `.env.local`: \_\_\_\_\_
- Identical? \_\_\_\_\_
- Same project ref in both `SUPABASE_URL`s? \_\_\_\_\_ _(a bucket of the same name in a different project fails exactly the same way and looks even more convincing)_

### 3. Is the bucket still private?

- `public = false` on the bucket? \_\_\_\_\_
- Anything else attached to it — a custom domain, a CDN rule, an image-transformation URL? \_\_\_\_\_ _(expected: none)_

### 4. Who holds it after handover, and what breaks if it is rotated?

- Recorded for the Phase 5 handover list? \_\_\_\_\_
- Understood that the anon key is **shared with web** if web also uses the anon key for its uploads — and that if web instead needs a write credential, rotating that one affects **only** uploads? \_\_\_\_\_
- Understood that widening the RLS policy is a **schema change**, and therefore goes through [../schema-requests/](../schema-requests/) like any other? \_\_\_\_\_

## What is buildable and verifiable **without** this gate

Less than it was under R2, and the reason is a real behavioural difference that must not be papered over.

**AWS presigning was a local HMAC.** `presignProofUrl` produced a well-formed URL from any syntactically valid credentials, contacted nothing, and validated nothing — so dummy values exercised the whole path and failed only at the browser's fetch. **Supabase's `createSignedUrl` is a server round-trip** to the Storage API, which means unauthorised or absent credentials fail at the _call_, not at the image load.

> **To verify against a real project before step 05's verification block is trusted:** whether `createSignedUrl` returns an error for a key that exists in the bucket but is unreadable under RLS, versus one that does not exist at all; and what HTTP status the signed URL itself returns once the token has expired. The recovery UI keys off the browser's failed image load either way, but the two failure modes reach it by different routes and the step file must describe the one that is real.

What still does not wait:

- the `onError` recovery path, driven by an expired or deliberately malformed URL rather than by absent credentials — the **"Muat ulang bukti"** block renders instead of a broken-image icon, which is the exact Phase 2 DoD line;
- that a URL is minted **per render** rather than memoised, comparable across two consecutive renders;
- that the URL appears in exactly one place, the `src` of a plain `<img>`, and never as text or an `<a href>`;
- every static rule — no `next/image`, `force-dynamic` present, the TTL constant.

Step 05 carries the commands.

## What stays unproven until this gate clears

Written out so it is carried into the DoD rather than assumed away:

1. **That a real proof object renders.** Nothing above requires the object to exist.
2. **That the credential is read-only in fact.** The only honest proof is a negative one: attempt an upload or a delete against the proofs bucket with this key and watch it be refused. That test cannot be written without the key, and it is the single most valuable five minutes in this gate — a `service_role` key pasted "just to unblock" passes every other check on this page.
3. **That the keys web writes are readable by this credential** — same project, same bucket, same prefix.

All three become one five-minute check the moment a real credential and one real booking exist together.

## Outcome — fill in during or immediately after

| Item                                                     | Done | Evidence   |
| -------------------------------------------------------- | ---- | ---------- |
| Anon key confirmed, `service_role` never pasted          | ☐    | \_\_\_\_\_ |
| RLS enabled on `storage.objects`                         | ☐    | \_\_\_\_\_ |
| `select`-only policy, scoped to the proofs bucket alone  | ☐    | \_\_\_\_\_ |
| No other `anon` policy widening it                       | ☐    | \_\_\_\_\_ |
| Same project ref and same bucket as web                  | ☐    | \_\_\_\_\_ |
| Bucket confirmed private                                 | ☐    | \_\_\_\_\_ |
| `pnpm check:setup` — storage half signs a URL            | ☐    | \_\_\_\_\_ |
| A write with this key **refused** (the negative proof)   | ☐    | \_\_\_\_\_ |
| A real proof rendered in the browser                     | ☐    | \_\_\_\_\_ |

### Sign-off

- ☐ Complete — the three unproven items above are now proven, and PROGRESS says so
- ☐ Deferred again — step 05 ships with the three items recorded as open in the Phase 2 DoD
- ☐ Deviation — a broader credential used, with the reason and the rotation consequence written here: \_\_\_\_\_

**Signed off by:** \_\_\_\_\_
**Date:** \_\_\_\_\_
