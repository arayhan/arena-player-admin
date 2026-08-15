# Product — Arena Player Admin

<!-- impeccable:product-schema 1 -->

Companion record to [`arena-player-web/docs/PRODUCT.md`](../../arena-player-web/docs/PRODUCT.md), which owns the product truth for the whole system. This file covers only what is different on the admin side. Where the two disagree, the web repo wins — it was written from the client conversation.

## Platform

web, authenticated, single user

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind v4, deliberately the same as the web repo so one developer moves between them without re-learning anything. Supabase Postgres and Supabase Storage, both reachable only from the server.

**What is deliberately absent, relative to web:** GSAP and ScrollTrigger, MSW, zustand, TanStack Query, axios, react-hook-form, react-icons. Server Components render from Supabase directly, filters live in the URL, and the only client component in v1 is the button that re-mints an expired proof URL. Every one of those omissions is a smaller shared-dependency surface and one less thing the client inherits.

**Added, with no web equivalent:** `jose` (session JWT), `hash-wasm` (argon2id), `@supabase/supabase-js` (signed proof URLs).

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

## Positioning

There is no market position to defend — one field, one admin, no competitor and no buyer to persuade. What is worth stating instead is the position **inside the system**, because it is the thing every future decision here is measured against:

**This app is the only writer of `bookings.status` that a human controls.** The public site can create a `pending` row and nothing else; the expiry cron can only move `pending` to `expired`. Every other transition in the product exists because someone opened this app and decided. That is why "the queue is the product", why a status mutation is guarded rather than trusted, and why an admin action the public site cannot read is a defect rather than a missing feature.

Nothing here is differentiated in the market sense, and future work should not manufacture a claim that it is.

## Operating Context

- **This app is a launch dependency of the public site**, which is not obvious and is easy to schedule wrongly. Expiry — pending older than 24h becomes `expired` and frees the slot — runs from a cron here. Until that ships and is scheduled, an abandoned booking holds its slot forever and the public site slowly fills with slots nobody can book. Order: web Phase 4 → admin 1a–3 → public launch → admin 4–5.
- Single field, **eighteen 1-hour slots**, 06.00–24.00, Asia/Makassar (WITA), booking window today + 91 days (`BOOKING_WINDOW_DAYS = 92`, roughly three months). Inherited, not decided here. The slots were nine 2-hour blocks until 2026-08-15; web split them so a visitor can book a single hour instead of being forced into a 2-hour block, and every slot string changed with them.
- **The admin is the bot, for now.** Until the WhatsApp bot ships, they paste the `/booking?date=&time=` link by hand. That is a web-repo concern, but it explains why the admin is already in WhatsApp when they reach this app.
- Cancellation has no customer-facing route anywhere. The customer messages the admin; the admin rejects the booking here. That is why **reject must work on `confirmed` rows, not only `pending` ones** — it is the cancellation mechanism, and it is the one place the Ketentuan's 1×24h rule touches this repo.
- Payment is a 50% DP by bank transfer, evidenced by an uploaded image. The admin quotes the amount over WhatsApp. **This app shows prices, as of 2026-08-15.** That reverses a standing rule and is recorded as a decision rather than left to contradict itself: the client is supplying a rate card, it varies by slot and day type, and it lands in `site_settings` ([003](schema-requests/003-site-settings.md)) rather than in code. Until those figures arrive, **no figure is invented** — a price-bearing surface renders a missing-rate-card state, never a placeholder number. Web's own rule forked at its 2026-08-11 checkpoint (`/` shows none, `/booking` renders one once the rate card lands), so the two apps are no longer symmetrical here and neither should be described as following the other.

## Capabilities and Constraints

- **One admin account, own auth, no vendor.** Password hash in an env var, signed session cookie. No user table, no password reset flow, no MFA. Adding any of those means a schema change to a database this repo may not migrate — deliberately out of scope, and the mitigation is that credential rotation is a redeploy, documented at handover.
- **The proofs bucket stays private forever.** Proofs render through a short-lived presigned GET this app mints per request. No public URL is ever created, by either repo.
- UI language is Indonesian. Code and comments English. The handover user guide is Indonesian.
- **This repo never runs a migration.** Web owns `db/migrations/`.
- Performance is not a constraint here in the way it is on the public site. One authenticated user, on wifi, who came to do a task. Correctness and density beat polish.

## Brand Commitments

Binding, and none of them is a choice available to future work. Recorded here rather than only in [DESIGN.md](DESIGN.md) so they survive a visual replacement — a redesign may change how they are used, never whether.

- **Navy `#011A43` and blue `#2563EB`** are sampled from the client's own logo. They are the client's colours, not a palette decision this project made.
- **`public/logo.jpeg`** is the supplied mark. It has no alpha channel and is painted on white by the asset itself, so it needs a light backing wherever it sits.
- **UI copy is Indonesian; code and comments are English.** The handover user guide is Indonesian too. The reader of every string this app renders is the field admin, not a developer.
- **Prices come from the client, never from us.** The rate card is a client-owned business fact stored in `site_settings`, not a constant in code and not a number anyone here estimates. Revenue shown on the dashboard is **DP actually collected** — 50% of the rate, confirmed bookings only — because that is the half this app has evidence for: an approved transfer screenshot. The other half is paid in cash at the field and this app never sees it. Inventing any of these figures is the fabrication this project most easily commits — see Evidence on Hand.
- **Dense, boring, fast.** The admin is doing data entry under time pressure with a customer waiting on WhatsApp. Delight is a tax here, and that is a product position, not a visual preference.

The full token system, measured contrast, and the motion ceiling live in [DESIGN.md](DESIGN.md), which is normative for anything visual.

## Evidence on Hand

**Confirmed real:** the `bookings` schema (contract, written and reviewed), the four statuses and what each means, the eighteen canonical slot strings, the brand colours, the 1×24h cancellation rule, and that the admin confirms manually today.

**Not yet supplied — must not be fabricated:** the admin's own account credentials, the bank account the DP lands in (this app displays no bank detail, but the user guide will reference it), the external scheduler account that will call the expiry job, and **the rate card** — `TODO(content)` in web, and shared: the admin quotes the DP amount over WhatsApp today, so this app depends on the same missing figure `/booking` does.

**Not yet true, and the schedule depends on it:** the `bookings` table does not exist in Supabase yet. Web's Phase 4 has not run. Everything in this repo is written against SQL text, not against a live database. `pnpm check:schema` exists specifically so that gap fails loudly on day one instead of surfacing as a confusing runtime error.

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

## Accessibility & Inclusion

**WCAG 2.2 AA is the bar.** Not aspiration — the repo already enforces most of it, and naming the standard is what makes the rest checkable rather than a habit somebody remembers.

What is already true and must stay true:

- **Contrast is computed, never asserted.** Body text 4.5:1, large text 3:1, and a border that carries state clears 3:1 against **both** the page and its own fill. Every figure in [DESIGN.md](DESIGN.md) was recomputed rather than carried forward — three overstated ratios have already shipped in this project, and a plausible number is the easiest kind not to check.
- **Status is never colour alone.** Surface + border + ink, always. A status the admin misreads is a booking they action wrongly, which makes this the one visual rule here that is a requirement rather than a preference.
- **Fully keyboard-operable.** The admin tabs through a queue; filters, pagination, confirm, reject and the proof reload are all reachable and activatable without a mouse. A `<div>` with an `onClick` is not a control.
- **Focus is restyled, never removed.** `outline: none` with nothing put back is a defect.
- **Errors are words.** Every field-level error is tied to its input with `aria-describedby`, the input carries `aria-invalid`, and the message says what is wrong. A colour change is not a message.
- **Focus moves to the result after a mutation.** A confirm or reject that returns 409 moves focus to the "Booking ini sudah diproses" message — otherwise a screen-reader user sees a page that appears to have done nothing.
- **375px and touch.** The admin is on a phone at the field at least as often as at a desk. Targets are at least 44px, and at that width the bookings list is a stack of cards, not a table with a horizontal scrollbar.
- **`prefers-reduced-motion` is honoured**, though there is little to remove: the motion ceiling is `background-color` and `border-color` at ≤160ms.

Two deliberate exemptions, recorded so neither reads as an oversight: **row dividers** (`grey-200` light, `#1C2B4D` dark) and the **border on controls that carry their own text label** — a ghost button, a menu, a popover. Both draw a shape; neither is the signal. WCAG 1.4.11 governs boundaries that _are_ the information, and a table rule is not one.

No accessibility requirement has been stated by the client. This bar is the project's own, and it is not negotiable downward on the grounds that there is only one user — that user is doing time-pressured data entry on a phone, outdoors, in daylight.
