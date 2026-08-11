# Product — Arena Player Admin

Companion record to [`arena-player-web/docs/PRODUCT.md`](../../arena-player-web/docs/PRODUCT.md), which owns the product truth for the whole system. This file covers only what is different on the admin side. Where the two disagree, the web repo wins — it was written from the client conversation.

## Platform

web, authenticated, single user

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind v4, deliberately the same as the web repo so one developer moves between them without re-learning anything. Neon Postgres and Cloudflare R2, both reachable only from the server.

**What is deliberately absent, relative to web:** GSAP and ScrollTrigger, MSW, zustand, TanStack Query, axios, react-hook-form, react-icons. Server Components render from Neon directly, filters live in the URL, and the only client component in v1 is the button that re-mints an expired proof URL. Every one of those omissions is a smaller shared-dependency surface and one less thing the client inherits.

**Added, with no web equivalent:** `jose` (session JWT), `hash-wasm` (argon2id), `@aws-sdk/s3-request-presigner`.

## Users

**Exactly one: the field admin.** In the web repo's own words (`PRODUCT.md:25`) they are "not a user of this site at all" — this repo is the site they _are_ a user of.

They are the same person who receives the WhatsApp message, quotes the DP amount, pastes the `/booking` link back, and later reads the transfer screenshot. Today all of that happens in WhatsApp and in their head. This app takes over the last third of it: the part where a payment proof has to be looked at and a decision recorded somewhere that the public site can see.

Three things about them shape the design more than anything else:

- **They are on a phone at least as often as a laptop.** They run a field; they are not at a desk. The bookings table must be usable at 375px, which means it is not really a table on mobile.
- **They open this app to do work, not to browse.** The default view is the pending queue, not a history log. Anything that makes them filter before they can act is a design failure.
- **Their next action after reading a booking is almost always to message that person.** The phone number is not a data field; it is a link.

There is no second role, no permissions model, and no user table. One account, one password, one session.

## Product Purpose

Turn a WhatsApp conversation plus a transfer screenshot into a status the database agrees with.

The public site's entire promise — availability that is trustworthy at the moment of asking — is only true if somebody moves rows from `pending` to `confirmed` or `rejected` promptly. **Today nothing can do that.** The `bookings` table has four statuses and, without this app, exactly one of them is reachable.

**Success is that no booking sits unactioned long enough for the customer to notice.** Not throughput, not analytics, not reporting. A queue that is empty by the end of the day.

## Operating Context

- **This app is a launch dependency of the public site**, which is not obvious and is easy to schedule wrongly. Expiry — pending older than 24h becomes `expired` and frees the slot — runs from a cron here. Until that ships and is scheduled, an abandoned booking holds its slot forever and the public site slowly fills with slots nobody can book. Order: web Phase 4 → admin 1a–3 → public launch → admin 4–5.
- Single field, nine 2-hour slots, 06.00–24.00, Asia/Jakarta, booking window today + 13 days. Inherited, not decided here.
- **The admin is the bot, for now.** Until the WhatsApp bot ships, they paste the `/booking?date=&time=` link by hand. That is a web-repo concern, but it explains why the admin is already in WhatsApp when they reach this app.
- Cancellation has no customer-facing route anywhere. The customer messages the admin; the admin rejects the booking here. That is why **reject must work on `confirmed` rows, not only `pending` ones** — it is the cancellation mechanism, and it is the one place the Ketentuan's 1×24h rule touches this repo.
- Payment is a 50% DP by bank transfer, evidenced by an uploaded image. The admin quotes the amount over WhatsApp. **This app shows no prices.** Web's rule forked at its 2026-08-11 checkpoint — `/` still shows none, `/booking` now renders one once the rate card lands — so "same as the public site" is no longer accurate here; the real reason is unchanged underneath the fork: no rate card is confirmed, and this app's own quoting workflow needs it as much as `/booking` does.

## Capabilities and Constraints

- **One admin account, own auth, no vendor.** Password hash in an env var, signed session cookie. No user table, no password reset flow, no MFA. Adding any of those means a schema change to a database this repo may not migrate — deliberately out of scope, and the mitigation is that credential rotation is a redeploy, documented at handover.
- **The R2 bucket stays private forever.** Proofs render through a short-lived presigned GET this app mints per request. No public URL is ever created, by either repo.
- UI language is Indonesian. Code and comments English. The handover user guide is Indonesian.
- **This repo never runs a migration.** Web owns `db/migrations/`.
- Performance is not a constraint here in the way it is on the public site. One authenticated user, on wifi, who came to do a task. Correctness and density beat polish.

## Evidence on Hand

**Confirmed real:** the `bookings` schema (contract, written and reviewed), the four statuses and what each means, the nine canonical slot strings, the brand colours, the 1×24h cancellation rule, and that the admin confirms manually today.

**Not yet supplied — must not be fabricated:** the admin's own account credentials, the bank account the DP lands in (this app displays no bank detail, but the user guide will reference it), the external scheduler account that will call the expiry job, and **the rate card** — `TODO(content)` in web, and shared: the admin quotes the DP amount over WhatsApp today, so this app depends on the same missing figure `/booking` does.

**Not yet true, and the schedule depends on it:** the `bookings` table does not exist in Neon yet. Web's Phase 4 has not run. Everything in this repo is written against SQL text, not against a live database. `pnpm check:schema` exists specifically so that gap fails loudly on day one instead of surfacing as a confusing runtime error.

## Open decisions

Four, and none of them can be answered from inside this repo.

- **Subdomain configuration on Sumopod.** Only Node capability is confirmed. `admin.arena-player.com` needs a subdomain, and so does the cron target. Already open in the web repo (`PRODUCT.md:59`); it now gates more than it did. Gate file: `docs/tasks/5-gate-subdomain.md`.
- **Which external scheduler, and whose account owns it after handover.** A cron that stops firing is a silent failure with a real customer consequence. Gate file: `docs/tasks/5-gate-cron-owner.md`.
- **Does the client ever close on a recurring weekly basis?** They confirmed 06.00–24.00 every day, which is why runtime-configurable operating hours was descoped (see [PRD.md](PRD.md)). If the answer is "we close Mondays", `slot_closures` becomes worth building; if not, it would ship as an empty table behind a config screen with nothing to configure.
- **Does the git repository transfer to the client at handover?** Inherited from the web repo and it matters slightly more here, because `docs/schema-requests/` and `docs/PROGRESS.md` both read as internal engineering correspondence.

## Product Principles

1. **The queue is the product.** Everything else is a supporting screen. If opening the app does not immediately show what needs actioning, the design has failed regardless of how it looks.
2. **Never mutate blind.** Every status change is guarded and can lose. The admin having stale data on screen is the normal case, not the exception — two tabs, a phone and a laptop, and an expiry job all write the same rows.
3. **A payment proof is a payment document.** It carries a name, an amount, and a bank account. Short TTLs, no caching layers, no optimizer, no public URL, ever.
4. **Silent failure is the enemy, and this repo has three sources of it** — a cron that stops firing, a migration that was never applied, and a shared file that drifted by one character. Each gets a check or a visible indicator. None gets a comment asking people to remember.
5. **Boring on purpose.** Same palette as the public site, none of its motion. The admin is doing data entry under time pressure; delight is a tax here.
