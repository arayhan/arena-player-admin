# Arena Player Admin — Architecture

System design for the back-office. Product scope is [PRD.md](PRD.md); the inherited database contract is [database.md](database.md). This document holds the decisions: routes, auth, every SQL statement this app issues, the proof read path, and the contracts that bind it to `arena-player-web`.

Where a decision was already made in the web repo, this file points at it rather than restating it. A copied rule is a rule that drifts.

---

## System shape

```
                    ┌──────────────────────────┐
  admin (1 person)  │  admin.arena-player.com  │
   phone / laptop   │  Next 16 · Server Comps  │
        │           └────────────┬─────────────┘
        │  session cookie        │
        └────────────────────────┤
                                 │
   external scheduler ───────────┤  POST /api/jobs/expire  (Bearer CRON_SECRET)
   every 15 min                  │
                                 │
                    ┌────────────┴─────────────┐
                    │   one Supabase project   │
                    │                          │
             ┌──────▼───────┐         ┌────────▼─────────┐
             │ Postgres     │         │ Supabase Storage │
             │  bookings    │         │ private bucket   │
             │  (shared)    │         │ (shared)         │
             │  pooler:6543 │         │ signed URL, 120s │
             └──────▲───────┘         └────────▲─────────┘
                    │                          │  browser fetches directly
        ┌───────────┴──────────┐               │
        │ arena-player-web     │               │
        │ arena-player.com     ├───────────────┘  (write only, never reads)
        └──────────────────────┘
```

Two apps, one database, one bucket, no shared runtime. They communicate exclusively through the `bookings` table. There is no HTTP call between them in either direction, and adding one would be a new coupling to justify rather than a convenience.

**The database and the bucket are now two halves of one Supabase project, and both apps must point at the same one.** That is a tighter binding than two independent vendors were: a second project would give each app a schema that migrates on its own and a bucket the other cannot read, and the split-brain arrives as "the proof is missing" long before anyone suspects the wiring. Same failure as before, one fewer place to notice it.

## Route map

| Route                   | Runtime             | Auth                  | Notes                                                                                                                                              |
| ----------------------- | ------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                | Node                | public                | The only unauthenticated page. Password comparison happens here                                                                                    |
| `/`                     | Node                | session               | Dashboard: pending count, **oldest-pending age**, confirmed-today count (needs [002](schema-requests/002-booking-events.md)), manual expiry button |
| `/bookings`             | Node                | session               | The list. All filter state in the URL                                                                                                              |
| `/bookings/[id]`        | Node                | session               | Detail + payment proof. `export const dynamic = 'force-dynamic'`                                                                                   |
| `/blocks`               | Node                | session               | Phase 4. Behind the schema guard                                                                                                                   |
| `/pricing`              | Node                | session               | Phase 6, [003](schema-requests/003-site-settings.md). Rate card + public holidays. Behind the schema guard                                         |
| `POST /api/auth/login`  | **Node** (explicit) | public                | Rate-limited. `export const runtime = 'nodejs'` — argon2 cannot run on Edge                                                                        |
| `POST /api/auth/logout` | Node                | session               | Clears the cookie                                                                                                                                  |
| `POST /api/jobs/expire` | Node                | Bearer **or** session | Bearer for the scheduler, session for the manual button                                                                                            |
| `middleware.ts`         | **Edge**            | —                     | Verifies the JWT and nothing else                                                                                                                  |

**Server Components by default.** The one client component in v1 is the proof-image reload button (see [The proof read path](#the-proof-read-path)). No TanStack Query, no zustand, no axios: filters live in the URL, the server reads Postgres, and a mutation is a Server Action followed by `revalidatePath`.

**Every admin response carries `Cache-Control: private, no-store`.** A cached RSC payload serves an expired signed URL, and a cached bookings list serves a status the admin already changed.

### The server/client boundary

Stated as a rule rather than a habit, because every exception to it is load-bearing:

1. **Every file under `src/app/` and `src/modules/` is a Server Component unless it carries `"use client"`.** Data is read in the component that renders it. There is no fetch layer, no client cache, no loading state to keep in sync — the page either rendered with the row or it did not.
2. **`"use client"` appears exactly once in v1**: the proof-image reload button. It exists because a 120-second signed URL expires on a page left open, and recovering from that needs an `onError` handler, which is a browser event.
3. **A second client component is a decision, not a detail.** It needs a written reason here, because each one is a place the "no client data-fetching" posture can quietly stop being true — a `"use client"` boundary is where somebody eventually adds a `useEffect` that fetches.
4. **Mutations are Server Actions**, followed by `revalidatePath`. Not route handlers called by `fetch` from a client component; the guarded `update … where status in (…)` and its 409 live server-side, and the answer the admin needs is the re-rendered row.
5. **Filters are URL state.** `searchParams` in, SQL parameters out. Shareable link, working back button, no store.
6. **`import "server-only"` opens every file in `src/server/`**, so a client component importing `db.ts` or `storage.ts` fails the build instead of failing review. Hard rule 3 in [CLAUDE.md](../CLAUDE.md).

---

## Dependencies

Resolved **2026-08-11**, and resolved rather than recalled: the shared half is quoted from `arena-player-web/package.json` as read on that date. The two clients web does not yet have were **re-resolved 2026-08-14**, when the project moved to Supabase, and their cells are quoted from this repo's `package.json` as installed. Step 02 installs this set and nothing outside it.

The reason this is exact rather than approximate: `pnpm check:domain` compares the **version range of every shared peer dependency** in both `package.json` files as well as the file bytes. `src/domain/dates.ts` imports `date-fns` and `@date-fns/tz`, whose v3 and v4 differ in the timezone API it relies on — so two repos on different majors produce a byte-identical file computing different dates, and nothing throws.

### Shared with `arena-player-web` — majors must match

| Package                | Version | Section in web  | Why this repo carries it                                                                      |
| ---------------------- | ------- | --------------- | --------------------------------------------------------------------------------------------- |
| `next`                 | 16.3.0  | dependencies    | Same framework, same App Router semantics                                                     |
| `react` / `react-dom`  | 19.2.8  | dependencies    | —                                                                                             |
| `date-fns`             | 4.4.0   | dependencies    | **Imported by `src/domain/dates.ts`** — `check:domain` asserts the range                      |
| `@date-fns/tz`         | 1.5.0   | dependencies    | Same                                                                                          |
| `zod`                  | 4.4.3   | dependencies    | Filter and search-param parsing. Cheap here — no route-split budget rule in this repo         |
| `server-only`          | 0.0.1   | dependencies    | Every file in `src/server/`                                                                   |
| `typescript`           | 5.9.3   | devDependencies | `src/domain/*.ts` is TypeScript                                                               |
| `tailwindcss`          | 4.3.3   | devDependencies | Same token layer                                                                              |
| `@tailwindcss/postcss` | 4.3.3   | devDependencies | Same                                                                                          |
| `vitest`               | 4.1.10  | devDependencies | `check:unit` and `check:schema`. Shared because the domain **tests** are inside the byte diff |

**`server-only` is shared, not admin-only.** Web carries it at `0.0.1`; a task-file draft listed it under admin-only. Recorded here because the version now has to match like any other shared line.

**Mirror web's `dependencies` / `devDependencies` placement exactly**, per the right-hand column. Nothing functional turns on it, but `check:domain` reads both objects to compare ranges, and a package sitting in a different section in each repo is a diff to explain every time somebody looks.

### Shared in waiting — this repo resolves them first

Neither is installed in web today. This repo reaches Postgres and Supabase Storage before web does, so **whatever it pins becomes the standard web adopts** when its own Phase 4 needs them. Recorded here for that reason: otherwise web resolves independently later and the two clients diverge for no reason anyone can reconstruct.

| Package                 | Version     | Note                                                                                                                               |
| ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `postgres`              | **3.4.9**   | Web: absent. The SQL path. Carries the `types` DATE/TIMESTAMPTZ override **and** `prepare: false` — see [database.md](database.md) |
| `@supabase/supabase-js` | **2.112.3** | Web: absent. **Storage only** — `createSignedUrl`. Nothing in this repo reads or writes `bookings` through it                      |

**Two clients, one project, and the split is deliberate.** `supabase-js` can reach the database through PostgREST, and it must not: `pnpm check:schema` reads `information_schema.columns`, `pg_indexes` and `pg_get_constraintdef(pg_constraint.oid)`, and PostgREST cannot read the catalog at all. That check is the only thing that proves a migration was applied **and unedited** — [PRODUCT.md](PRODUCT.md) principle 4's second silent failure. Losing it to save a dependency is trading the check for the convenience it exists to replace. So: `postgres.js` for SQL, `supabase-js` for Storage, and no exceptions in either direction.

**Both are exact pins**, matching every shared line above. `pnpm add` writes a caret range by default; it was normalised by hand here, because "whatever this repo pins becomes web's standard" only binds if it is a pin. A caret that drifts on web's install is the divergence this table exists to prevent.

**pnpm's `minimumReleaseAge` still applies to whatever lands here.** A version published inside the cutoff fails at install, and the resolution is to take the next-older already-aged version rather than relax the policy — the trap `arena-player-web`'s step 02 hit on `react-hook-form` and this repo's step 02 hit again (`docs/PROGRESS.md`). Editing `package.json` alone is not enough when it strikes: the stale resolution has to be cleared with `pnpm clean --lockfile` before reinstalling.

### Admin-only — no web equivalent, and none expected

| Package     | Version | Why                                                                  |
| ----------- | ------- | -------------------------------------------------------------------- |
| `jose`      | 6.2.8   | HS256 sign/verify. The half of auth that runs on **Edge**            |
| `hash-wasm` | 4.12.0  | argon2id, pure WASM, no native binding — the Sumopod reason is above |

### Dev-only

`eslint` 9.39.5, `eslint-config-next` 16.3.0, `eslint-config-prettier` 10.1.8, `prettier` 3.9.6, `@types/node` 24.13.3, `@types/react` 19.2.18, `@types/react-dom` 19.2.4 — all quoted from web, all required by `pnpm check` (lint, typecheck, `format:check`).

### Deliberately absent

Each of these is in web and is **not** an oversight here. Adding one back is a decision that belongs in this file, not a line in a lockfile.

| Not installed                 | Why not                                                                                                                                                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gsap`, `@gsap/react`         | No motion layer and no `src/lib/motion.ts`. Hard rule 7 — DESIGN.md here is web's palette with none of its motion                                                                                                                                          |
| `msw`                         | **No mock layer, by design.** This app is useless without real data; every screen reads live Postgres from a Server Component. A mock here buys screens that pass with no database, which is the failure mode this repo exists downstream of               |
| `zustand`                     | No client state to hold. Filters are URL state                                                                                                                                                                                                             |
| `@tanstack/react-query`       | No client data-fetching. Server Components read, Server Actions write, `revalidatePath` refreshes                                                                                                                                                          |
| `axios`                       | No HTTP client. There is no call between the two apps in either direction, and adding one is a new coupling to justify                                                                                                                                     |
| `react-hook-form`             | Three forms in the whole app — login, reject-with-reason, add-block — each a plain `<form>` posting to a Server Action. RHF makes every one of them a client component, which reverses the boundary above to buy validation `zod` already does server-side |
| `react-icons`                 | DESIGN.md encodes status as a surface + border + ink triple, never an icon and never a single hue. No icon requirement exists to satisfy                                                                                                                   |
| `clsx`, `tailwind-merge`      | Status styling is a lookup object keyed by the four DB states, not a conditional class expression. If a real conditional-class need appears, adding `clsx` is a decision recorded here                                                                     |
| `babel-plugin-react-compiler` | It optimises client re-renders. v1 has one client component                                                                                                                                                                                                |
| `check:budget`                | See [Verification practice](#verification-practice). One authenticated user on wifi; the 200KB/LCP contract has no consumer here                                                                                                                           |

### Design tokens: a hand-authored `@theme` block

**Decided: hand-author the Tailwind v4 `@theme` block in `src/app/globals.css`, transcribed from [DESIGN.md](DESIGN.md)'s frontmatter. No generator, no build step.**

The case for generating was that it would keep this palette and web's in lockstep automatically. That case is factually wrong, and checking it is what settled the decision:

- **The two palettes are already deliberately different.** Web's frontmatter carries `amber-300` and `red-300` and no green tier at all; this one carries `green-100/700/800`, `amber-700` and `red-600`, because the `-300` status borders measured 1.29–1.90 against a 3:1 requirement and failed WCAG 1.4.11 (recorded in [PROGRESS.md](PROGRESS.md), 2026-08-08). Web's type ramp is Orbitron display faces at `clamp()` sizes; this one is fixed-px Inter. "Same palette" is a description of intent, not an equality anyone can generate.
- **A generator would read `docs/DESIGN.md` in _this_ repo.** So it would prevent CSS-vs-DESIGN.md drift — a two-file, ~30-value surface that a human diff catches — while doing nothing at all about DESIGN.md-vs-web drift, which is the only cross-repo hazard in the vicinity. It buys the wrong guarantee.
- **`docs/DESIGN.md` is explicitly outside `check:domain`**, which covers `src/domain/*.ts` and nothing else. A generator would therefore be the one piece of machinery here with no check behind it — and under hard rule 9 it would need one, proven to fail, making it a fifth check in a repo that deliberately has four.
- **The surface is 18 colours, 6 type steps, 3 radii and a spacing scale, written once.** Web hand-authors for the same reason; matching its approach means a palette change is one workflow in both repos rather than two.

**DESIGN.md stays normative.** When the two disagree, DESIGN.md wins and the `@theme` block is corrected — the same direction of repair as `src/domain/`, where web wins and the copy is corrected.

---

## Auth

One account. Password hash in `ADMIN_PASSWORD_HASH`, session as a signed JWT in an HttpOnly cookie. No user table, no session table, no vendor.

### The Edge/Node split — the trap that fails at deploy, not at author time

Next middleware runs on the **Edge runtime**. `jose` works there. argon2 does not. So:

- **`middleware.ts` (Edge)** verifies the JWT signature and expiry, and redirects to `/login` on failure. It never sees a password.
- **`POST /api/auth/login` (Node, explicit `export const runtime = 'nodejs'`)** is the only place `verifyPassword()` is called.

Getting this backwards builds fine and runs fine in `pnpm dev`, then fails on Sumopod. `1a-step-07-auth.md` carries an acceptance check that greps the built middleware bundle for the argon2 import.

### Hashing: `hash-wasm`, not `@node-rs/argon2`

argon2id either way. `hash-wasm` is pure WASM with no build step; `@node-rs/argon2` is faster but ships native bindings that must compile or find a prebuilt for the host. Sumopod's build environment is unverified — only Node capability was confirmed — and a native-binding failure surfaces at deploy, on a login that happens twice a day and does not need the speed.

Generate the hash with `scripts/hash-password.mjs`. It prompts for the
password with terminal echo suppressed and prints only the encoded hash —
**never pass the password as an argv, and never commit a plaintext password
anywhere, including a comment**, since argv lands in a process listing and
shell history either way:

```bash
node scripts/hash-password.mjs
# Password: <hidden — type it and press Enter>
# $argon2id$v=19$m=65536,t=3,p=1$...
```

Same cost parameters either way: `parallelism: 1, iterations: 3, memorySize: 65536, hashLength: 32, outputType: 'encoded'`.

**Every `$` in the hash must be escaped as `\$` in `.env.local`.** Next.js's built-in `.env` loader (`@next/env`, `dotenv-expand` under it) expands `$name` in a value by looking up another env var literally called `name`. An argon2id hash is nothing but `$`-delimited fields (`$argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>`), so an unescaped hash is silently rewritten into a short garbage string — no error, no warning, and the resulting login failure is indistinguishable from a wrong password. Confirmed directly: an unescaped 97-character hash was observed truncated to 17 characters at `process.env.ADMIN_PASSWORD_HASH` inside the running dev server, purely from this expansion. `scripts/hash-password.mjs` prints the pre-escaped line — copy that one, not the bare hash — and the same applies to `SESSION_SECRET`/`CRON_SECRET` in the unlikely event either random value ever contains a `$`.

### Session cookie

```
admin_session = <jose HS256 JWT>
HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800   (7 days)
```

Payload is `{ sub: 'admin', iat, exp }` and nothing else. There is no second subject, so anything more is a field to keep in sync for no reason.

**`SameSite=Lax` is the CSRF defence.** Stated explicitly so nobody adds a token later "for completeness": a single-user admin with no cross-site form posts and `Lax` cookies has no CSRF surface worth a token that would then need maintaining. If a cross-origin embed is ever added, this decision is reopened.

**Rotating `SESSION_SECRET` logs the admin out.** That is the intended emergency revocation, since there is no session table to delete from. Document it at handover rather than treating it as a bug.

### Login rate limiting

In-memory, per-IP, on the login route only: 5 attempts per 15 minutes, then 429. Deliberately not Redis and not a database table — one admin, one password, and a process restart clearing the counter is an acceptable weakness against an argon2id hash. It exists to make online brute force pointless, not to be a security product.

**The window is anchored to the first attempt and is never extended when the limit fires.** Five attempts spread over fourteen minutes leave one minute on the clock when the sixth is refused, not fifteen. `/login` therefore reads the remaining time out of the live bucket (`peekRateLimit`) rather than printing the window length — the derived constant it used to interpolate was the length of the window, not the length of the wait, and overstated it by up to the whole fifteen minutes.

**The bucket `Map` is pinned to `globalThis`, and that is load-bearing rather than defensive.** Next bundles the route-handler layer and the RSC layer separately, so a module imported by both is instantiated twice in one process. Measured against a production build before the pin: the route returned 429 while `/login`, rendering microseconds later in the same process, found no bucket for the same IP and silently fell back to its non-numeric copy. Nothing throws when the two copies diverge. The counter is still per-process and still cleared by a redeploy — the pin fixes visibility across bundle layers, not durability.

---

## The bookings list

### Contract

| Aspect             | Decision                                                                                                               | Why                                                                                                                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filters            | `status` (multi-select over the four DB states), `from` / `to` on `booking_date`, `q` free text over team name + phone | Matches `status_valid` exactly; no derived states                                                                                                                                                                                                                                |
| Default status     | `pending` **only**                                                                                                     | The admin opens this page to do work. Defaulting to "all" makes the first screen a history log                                                                                                                                                                                   |
| Default date range | `from = today` (`todayAtField()`, Asia/Makassar), no `to`, plus an explicit "Semua tanggal" toggle                     | Yesterday's unconfirmed booking is about to be auto-expired and its game already happened. Stragglers surface through the dashboard's oldest-pending indicator instead                                                                                                           |
| Default sort       | `booking_date asc, time_slot asc`                                                                                      | A queue's question is _which game is soonest_ — that is the booking about to be lost. `created_at desc` is a feed. `created_at` is displayed (it drives the 24h clock) but is not the sort key                                                                                   |
| Pagination         | `LIMIT`/`OFFSET`, 50 per page, page number in the URL                                                                  | Keyset is the right answer at scale and the wrong answer here. Deepest reachable offset is 1,656 rows / 34 pages, against the cost of a compound cursor. Note this is no longer decoration: at the old 126-row ceiling the queue nearly always fit one page, and it now does not |
| State              | Entirely in the URL                                                                                                    | Shareable links, working back button, zero client data-fetching                                                                                                                                                                                                                  |
| Indexes            | **None added — the reasoning below no longer holds; re-examine before Phase 2 ships**                                  | Decided on a ceiling of 126 active rows that no longer exists. See the flag directly below                                                                                                                                                                                       |

> **ASSUMPTION FLAGGED — the index decision was argued from a ceiling that changed.** "None added" was never a taste call; it was arithmetic, and the arithmetic was 9 slots × 14 days = **126** active rows. On 2026-08-15 `TIME_SLOTS` became eighteen 1-hour slots and `BOOKING_WINDOW_DAYS` became 92, so the same arithmetic is now 18 × 92 = **1,656** — thirteen times the number the decision was made from. Whether "none added" still holds at 1,656 is **an open question, not a settled one**. It is not obviously wrong: 1,656 rows is still small for Postgres, and the filtered query is a sequential scan over a table that fits in cache either way. It is also no longer self-evidently right, and the second half of the original justification — "revisit past ~50k rows, which at 9 slots/day is roughly 15 years" — is dead as written, because at 18 slots/day the same 50k arrives in roughly 7.5 years and lifetime accumulation of `rejected` and `expired` rows now grows at twice the old rate. **Do not add an index from this paragraph.** Choosing one is an engineering decision that needs a measurement against the real table, and it belongs to whoever builds the list query in Phase 2 — with the answer written back into this row either way, so the next reader inherits a decision rather than a flag.

### The query

```sql
-- $1 status[]  text[]   e.g. ARRAY['pending']
-- $2 from      date     nullable
-- $3 to        date     nullable
-- $4 q_text    text     nullable — the raw query, for team_name
-- $5 q_phone   text     nullable — normalisePhone(q) from src/domain/phone.ts;
--                                  null when q contains no digits
-- $6 limit     int      50
-- $7 offset    int
select
  b.id,
  b.booking_date::text as booking_date,
  b.time_slot,
  b.team_name,
  b.phone,
  b.proof_key,
  b.status,
  b.created_at::text   as created_at,
  count(*) over ()     as total_count
from bookings b
where b.status = any($1::text[])
  and ($2::date is null or b.booking_date >= $2::date)
  and ($3::date is null or b.booking_date <= $3::date)
  and (
    $4::text is null
    or b.team_name ilike '%' || $4 || '%'
    or ($5::text is not null and b.phone like '%' || $5 || '%')
  )
order by b.booking_date asc, b.time_slot asc, b.created_at asc
limit $6 offset $7;
```

Four details in that statement are load-bearing:

- **`::text` on both date columns.** Belt and braces alongside the OID 1082/1184 `types` override in `src/server/db.ts`. If anyone ever "simplifies" the client construction, or the driver is swapped again, this query still returns strings — and it documents why at the point of use.
- **`count(*) over ()`** gives the page count in the same round trip. A second `count(*)` would need a duplicated WHERE clause, which is a drift surface.
- **`order by time_slot` sorts correctly as plain text** because the canonical form is zero-padded 24-hour (`'06.00 - 07.00'` … `'23.00 - 24.00'`). That is a load-bearing property of the canonical string, not a coincidence, and it means the sort needs no lookup table. Do not add one.
- **`$5 q_phone` is normalised in TypeScript, not in SQL.** Phones are stored `628xxxxxxxxx`. An admin typing `0812-3456-7890` yields digits `08123456789`, which does **not** substring-match `628123456789`. Run the query through `normalisePhone()` from `src/domain/phone.ts` first. This makes the admin the second real consumer of that module, which is exactly what put it in the byte-identical set.

**The `ORDER BY` is parameterised, from an allow-list.** The queue's column headers are sortable — `booking_date`, `team_name`, `created_at` — so the clause above is the default, not the only one. The sort key arrives in the URL and is mapped through a literal object in TypeScript before it reaches SQL:

```ts
const SORTABLE = {
  when: "b.booking_date, b.time_slot",
  who: "b.team_name",
  age: "b.created_at",
} as const;

// Direction is user input too, and it reaches the same string. A ternary
// concatenating "desc" is one refactor away from concatenating something
// else; a map cannot be talked into a third value.
const DIRECTION = { asc: "asc", desc: "desc" } as const;
```

**Never interpolate the raw parameter.** A sort key is user input arriving from a query string, and `order by` cannot be a bind parameter — an allow-list lookup is the only safe construction, and a missing key falls back to the default rather than erroring. `age` sorts on `created_at` because the displayed age _is_ `now() - created_at`; there is no age column.

**The full clause is always the lookup plus a stable tiebreaker**, `, b.created_at asc` when sorting by anything other than `age`. Without it two rows sharing a date and slot can swap places between page 1 and page 2 of the same `LIMIT`/`OFFSET` walk, and a booking silently never appears.

### The detail read

The list query answers the queue. `/bookings/[id]` needs one row and two things the list deliberately omits.

```sql
-- $1 id  uuid
select
  b.id,
  b.booking_date::text as booking_date,
  b.time_slot,
  b.team_name,
  b.phone,
  b.notes,
  b.proof_key,
  b.status,
  b.created_at::text   as created_at
from bookings b
where b.id = $1;
```

Three details are deliberate:

- **`notes` appears here and nowhere else.** Up to 500 characters wrecks row height in the list; on the detail page it is often the reason the admin is looking.
- **No status filter.** The detail page renders every state, including `expired` and `rejected` — the admin arrives here from a link or a stale tab as often as from the queue, and a 404 on a real booking is worse than showing a settled one.
- **Zero rows is a 404, not an error.** An id that does not exist is a wrong URL. An id that exists but was actioned in another tab still returns its row; the mutation guards handle staleness, not this read.

The same `::text` casts apply for the same reason as the list — belt and braces against the driver's DATE/TIMESTAMPTZ parsers, documented at the point of use.

### Rendering rules

- **`phone` renders as a `wa.me` link.** The admin's next action after reading a booking is to message that person. Highest-value affordance on the page and it costs nothing.
- **`notes` does not appear in the list.** Up to 500 characters wrecks row height. Detail page only.
- **At 375px the table is not a table.** One card per booking: date + slot as the heading, team name, status pill, age. The admin is often on a phone at the field.
- Status pills reuse the state triples from [DESIGN.md](DESIGN.md) — surface + border + ink, never a single hue.

---

## Status mutations

Never a blind update by id. The admin's screen is stale by default: two tabs, a phone and a laptop, and an expiry job all write the same rows.

```sql
-- confirm
update bookings set status = 'confirmed'
 where id = $1 and status = 'pending'
returning id, status;

-- reject
update bookings set status = 'rejected'
 where id = $1 and status in ('pending','confirmed')
returning id, status;
```

**Zero rows returned is not an error condition to swallow.** It means the row was already actioned in another tab, or the expiry job flipped it between page render and click. Respond **409** with `"Booking ini sudah diproses"` and re-render the current state. Same discipline as the booking insert in the web repo: the database decides, the application reports.

**Reject accepts `confirmed`, deliberately.** The Ketentuan grants cancellation up to 1×24h and there is no customer-facing cancel route anywhere in the system — the customer messages the admin, and this is where that ends up. Narrowing it to `pending` would silently delete the cancellation feature.

**Un-expiring is not built.** Confirming an `expired` row can collide with `uniq_active_slot` and raise `23505` — another booking may have taken the slot after it was released. Doing it properly means reusing the exact `isSlotConflict()` contract (**both** the code and the constraint name, per [database.md](database.md)) and returning a distinct 409, `"Slot ini sudah diambil booking lain"`. That would also make `isSlotConflict()` a fourth candidate for `src/domain/`. Parked, and left duplicated for now, because a half-built version of this is worse than none.

---

## The expiry job

```sql
update bookings
   set status = 'expired'
 where status = 'pending'
   and created_at < now() - interval '24 hours'
returning id, booking_date, time_slot;
```

Idempotent by construction — a second run in the same second updates zero rows. No advisory lock, no `job_runs` table, no new index. The arithmetic: 18 slots × 92 days caps active rows at 1,656, up from 126. That is the same arithmetic that reopened the index decision in the bookings-list contract above, and "no new index" here rests on it too — whoever re-examines that flag should answer for this statement at the same time rather than treating the two as separate questions.

**`POST /api/jobs/expire`** accepts either `Authorization: Bearer $CRON_SECRET` (the scheduler) or a valid session cookie (the manual "Jalankan sekarang" button). It returns `{ "expired": <count> }`. Any other caller gets 401 and nothing is mutated.

Full rationale for the scheduler choice — why not `node-cron`, why not Vercel cron, why 15 minutes — is in [PRD.md](PRD.md) Phase 3. The monitoring is the dashboard's **oldest-pending age**: over ~25h means the cron is not firing, shown on the page the admin opens daily.

### What the web repo must change as a result

This decision resolves an `UNRESOLVED` block in the other repo, so the other repo has edits to make. They are enumerated with exact locations in [tasks/3-gate-web-expiry.md](tasks/3-gate-web-expiry.md) and are **not** applied from this session. The shape of it: web's `GET /api/availability` drops its lazy-expiry step and becomes a pure read; `Cache-Control: public, s-maxage=30` stays exactly as it is, because the conflict is resolved by removing the write, not the cache.

---

## The proof read path

The bucket is private and no public URL is ever created, by either repo. The admin renders each proof through a short-lived signed URL it mints itself:

```ts
const { data, error } = await supabase.storage
  .from(process.env.SUPABASE_PROOFS_BUCKET!)
  .createSignedUrl(proofKey, 120);
```

**The contract is the `key`, not a URL.** `bookings.proof_key` stores `proofs/${bookingDate}/${uuid}.${ext}` and nothing else; the URL is minted per render, never cached, never stored, never written back to a row. Storing a key rather than a URL is what makes the storage provider an implementation detail of `src/server/storage.ts`: a provider change rewrites one file and touches no row, which is the whole reason `proof_url` was renamed before any of this.

### Read-only by policy, not by key

The bucket is **private**, and this app reads it through an RLS `select` policy on `storage.objects` scoped to the proofs bucket, signing with the **anon** key. **Never `service_role`.**

That rule carries three reasons, any one sufficient, and `service_role` throws away all three at once because it bypasses RLS entirely:

1. **An admin-side compromise must not be able to destroy payment evidence.** No `insert`, no `update`, no `delete` policy exists for this app's role, so there is no code path — intended or injected — that can overwrite or remove a proof.
2. **Web's credential reaches the client at handover.** Its uploader runs where the customer's browser can see it. One shared all-powerful key across both apps means one rotation breaks two apps, and it means the key that must never leave a server sits in the same project as one that must.
3. **This app has no legitimate reason to ever write.** It reads proofs and updates `bookings.status`. Nothing else.

The trap is that `service_role` **works**. Swap it in and every screen renders exactly as before; the only observable difference is that the three properties above are now false. That is why this is written as a rule and not as configuration advice.

> **ASSUMPTION FLAGGED FOR PHASE 5:** the anon key is publishable by design — it is the key a browser client would hold — so the read-only property is enforced by the policy, and the policy alone. What has **not** been verified here is how narrowly that policy can be scoped while `createSignedUrl` still succeeds, and therefore what a leaked anon key would let a holder do against the proofs bucket. The mitigation already in place is that `proof_key` embeds a v4 UUID, so keys are not enumerable by guessing — but "not guessable" is not "not listable". Whoever wires the project must confirm the policy grants `select` on this bucket only, must confirm no `objects`-listing path is open to the same role, and must write the confirmed policy SQL into [schema-requests/](schema-requests/) so it is reproducible rather than a click someone once made.

### TTL: 120 seconds

Not fifteen minutes. The URL is minted per page render and the image loads immediately. A signed URL is a **bearer capability for a payment document** carrying a name, an amount, and a bank transfer — and it leaks through browser history and the `Referer` header. Two minutes covers a slow Indonesian mobile connection pulling a 2MB image plus a brief tab-away.

The consequence is handled rather than ignored: an expiring URL on a page left open renders a broken image. The proof `<img>` carries an `onError` that swaps in a **"Muat ulang bukti"** button which re-fetches a fresh URL. That button is the only client component in v1.

### Server Component, not a proxy route

The Server Component mints the URL per request and hands it to a plain `<img>`. The browser fetches the bytes from Supabase directly.

The alternative — a `/api/proof/[id]` route streaming the object through the app — pushes 2MB through the same Node process that serves the bookings list and runs the expiry job, on a host where nothing about memory or bandwidth is generous. Signed URLs exist so that the storage service serves the bytes; proxying them buys nothing and spends the one resource this deployment is actually short of.

Trade-off, stated rather than hidden: the signed URL is copyable and works for anyone who has it, for its TTL. The 120s window is the mitigation, and it is acceptable because the only person who ever sees that page is the authenticated admin.

### Three implementation traps

1. **`createSignedUrl` is a network call, not local signing.** It returns `{ data, error }` over HTTP and can fail at render time — Storage unreachable, key wrong, policy wrong. Handle the `error` branch explicitly and render the reload button in it; never `data!.signedUrl`, which turns a recoverable render into a crashed page. **ASSUMPTION FLAGGED:** what this call does for a key that does not exist — error, or a URL that 404s when fetched — has not been verified here, and the orphan case in [database.md](database.md) makes it reachable. Verify against the real project and record the answer; until then, both branches must be survivable.
2. **Never `next/image` on a proof.** It proxies the signed URL through Next's optimizer, which writes the optimized output to an on-disk cache keyed by URL and serves it from a stable `/_next/image?url=…` path with a long TTL — copying a private payment document out of the private bucket and outliving the signature entirely. Hard rule 2 in [CLAUDE.md](../CLAUDE.md).
3. **`export const dynamic = 'force-dynamic'`** on the detail page. A cached RSC payload serves an expired URL.

Package: `@supabase/supabase-js`, in `src/server/storage.ts`, for Storage and nothing else. It never touches `bookings` — see [Shared in waiting](#shared-in-waiting--this-repo-resolves-them-first).

---

## The schema guard

This repo may not create tables, and application code must never `create table if not exists`. So it has to answer "is the migration applied?" at runtime, and answer it usefully.

`src/server/schema-guard.ts`:

- One `select to_regclass('public.<table>')` per feature table, memoised in module scope.
- **Positive cache only.** Cache `true` for the process lifetime; re-check on `false`. Applying a migration must not require a redeploy.
- Missing → the feature's page renders a loud error naming the exact file: _"Jalankan `db/migrations/0002_create_slot_blocks.sql` di Supabase SQL editor"_. Every mutating route for that feature returns **503** `{"error":"migration_missing","migration":"0002_create_slot_blocks"}`.
- A Postgres `42P01` (undefined_table) escaping anywhere becomes a 503 — never caught-and-return-empty, which would render "no blocks" for "no table".

**The guard never sits in front of the bookings console.** Phase 2 needs zero new migrations. A missing Phase 4 table degrades this app to its core function; it does not brick it. Someone will otherwise wrap the root layout in the guard, which is why this sentence is here.

---

## Cross-repo contracts

Three bindings to `arena-player-web`. All three fail silently if broken, which is why each has a check.

### 1. `src/domain/` is byte-identical

`src/domain/slots.ts`, `dates.ts`, `status.ts`, `phone.ts` are **copies**, not an import, not a package, not a submodule. The web repo's `architecture.md` records why: a workspace reverses the separate-repo decision, a package makes the client inherit registry credentials, and a submodule turns a plain `git clone` into an empty directory that fails confusingly.

**Byte-identical, not merely equivalent.** `uniq_active_slot` compares `time_slot` as text, so a one-character drift means this app writes rows the site cannot match and anti-double-booking silently stops working for both. Nothing throws.

**`pnpm check:domain`** diffs two things: every file under `src/domain/` byte-for-byte against `../arena-player-web/src/domain/`, **and** the version range of each shared peer dependency in both `package.json` files. The second half is not optional — `dates.ts` imports `date-fns` and `@date-fns/tz`, and v3 and v4 differ in exactly the timezone API it relies on, so two repos on different majors produce a byte-identical file computing different dates.

**Web's `src/domain/` now exists** — its Phase 1a step 06 landed, four modules plus their tests. This repo's copy therefore has a real source to be diffed against the moment it is created, and it is _this_ repo that is currently missing from the comparison: web's `check:domain` skips loudly today, naming its eight unguarded files.

**Tests are in the diff, not only the four modules.** Web decided that deliberately: this repo inherits the proof, not just the code, so the copy is verified to _behave_ identically rather than merely to look identical. The price is a third shared obligation — **vitest**, alongside `date-fns` and `@date-fns/tz`.

**Keep the skip-loudly behaviour regardless.** Whenever a side is absent, or `ARENA_WEB_PATH` points somewhere wrong, the check must print `SKIPPED`, name what it did not compare, and exit 0. Never pass silently — a check reporting success having compared nothing is worse than no check.

**Direction of repair:** web is the source. Drift is fixed by fixing web and re-copying, never by editing the copy here.

### 2. Web owns `db/migrations/`

This repo has no migrations directory and never will. A schema change is written as a request in [schema-requests/](schema-requests/), transcribed verbatim into `arena-player-web/db/migrations/`, and applied by hand in the Supabase SQL editor. Two repos migrating one database is a conflict with no owner to resolve it.

**The Supabase CLI and the Supabase MCP do not change this.** Both can apply a migration, which means both can apply one from the wrong repo, from a branch, or from an agent that never asked. The rule is about ownership, not about how hard the SQL is to run — see [database.md](database.md).

**`pnpm check:schema`** is how this repo finds out whether that happened. It asserts the table, its columns, `uniq_active_slot`, and that the `time_slot_canonical` CHECK constraint's literals are **set-equal to `TIME_SLOTS`**.

That last assertion is no longer unique, but it is still not redundant. Web's `check:docs` gained a `slot-canonical-drift` check that compares `TIME_SLOTS` against the literals in its **`db/migrations/*.sql` file** — the text of the migration, which proves only that the file is self-consistent. This one reads `pg_get_constraintdef` from the **live database**, which is the only thing that proves the migration was actually run and run unedited. Three guards, three different surfaces: `check:domain` source against source, web's `check:docs` source against the SQL file, and this one source against the database.

Deliberately **not** solved with a Postgres `DOMAIN`. That would require `alter column type` on `bookings`, a hand-run destructive change to the one table the entire race guard sits on. Duplicate the literal; detect the drift.

### 3. Deployment ordering for anything web must read

A feature here that writes rows web does not read is a silent no-op. For `slot_blocks` the order is: migration applied → web's availability read unions the table **and is deployed** → only then does the UI ship here. That is a gate file, not a step: [tasks/4-gate-blocks.md](tasks/4-gate-blocks.md).

---

## Verification practice

Four scripts. Each is a Vitest run or a Node script; none is a convention anyone has to remember.

| Script              | What it proves                                                                                    | Needs credentials |
| ------------------- | ------------------------------------------------------------------------------------------------- | ----------------- |
| `pnpm check:unit`   | `vitest run src` — colocated `*.test.ts` beside each module                                       | **No, ever**      |
| `pnpm check:domain` | `src/domain/` byte-identity + shared peer-dep ranges                                              | No                |
| `pnpm check:schema` | `vitest run scripts` — live catalog read: table, columns, indexes, CHECK literals vs `TIME_SLOTS` | Yes               |
| `pnpm check:setup`  | Live preflight: the pooler connects, a Storage signed URL round-trips                             | Yes               |

`check:unit` and `check:schema` are separate globs on purpose, so unit tests never require a database. The acceptance for that is literal: move `.env.local` aside and `check:unit` still exits 0.

**`pnpm check` runs the credential-free gate in one command** — lint, typecheck, `format:check`, `check:domain`, `check:unit` — cheapest first. The two credentialed scripts stay out of it deliberately: an umbrella that cannot run on a freshly cloned repo is one people stop running. Mirrors the same command in the web repo.

**Every check must be proven to fail before it is trusted.** Plant a violation, watch it exit non-zero, revert. A check that has only ever passed is a check nobody has tested — the web repo shipped a `Stop` hook that never fired once, for exactly that reason, and it is the single most repeated instruction across both repos.

**No `check:budget`, no `check:docs`, no `src/lib/motion.ts`.** One authenticated user on wifi; the 200KB/LCP contract has no consumer here. `check:docs` in the web repo encodes web's specific scars — a `TODO(phase2)` rename, a phase-table drift — and copying it would import checks that assert nothing about this repo.

## Folder structure

```
arena-player-admin/
├── CLAUDE.md
├── docs/
│   ├── PRODUCT.md  PRD.md  architecture.md  database.md  DESIGN.md  dev-rules.md
│   ├── PROGRESS.md            # current phase only
│   ├── tasks/                 # steps + gates
│   └── schema-requests/       # DDL requested here, applied in the web repo
├── src/
│   ├── middleware.ts          # Edge — JWT verification only, never a password
│   ├── app/                   # routes, layouts, composition
│   │   ├── login/page.tsx
│   │   ├── page.tsx           # dashboard: pending count, oldest-pending age, manual expire
│   │   ├── bookings/page.tsx
│   │   ├── bookings/[id]/page.tsx  # force-dynamic
│   │   ├── blocks/page.tsx    # Phase 4, behind the schema guard
│   │   └── api/
│   │       ├── auth/login/route.ts     # runtime = "nodejs"
│   │       ├── auth/logout/route.ts
│   │       └── jobs/expire/route.ts
│   ├── modules/               # named after SURFACES. Modules never import each other
│   │   ├── bookings/          # list, filters, detail, proof view, confirm/reject
│   │   └── blocks/            # Phase 4
│   ├── domain/                # BYTE-IDENTICAL with arena-player-web, at the SAME PATH
│   │   │                      # there. Read-only here: fix drift in web, then re-copy
│   │   ├── slots.ts           # 0 deps
│   │   ├── dates.ts           # date-fns — the only file here carrying a dependency
│   │   ├── status.ts          # 0 deps — both vocabularies and the 4→3 mapping
│   │   ├── phone.ts           # 0 deps — normalisePhone, used by the search query
│   │   └── *.test.ts          # one beside each
│   ├── server/                # every file opens with import "server-only"
│   │   ├── auth/session.ts    # jose sign/verify
│   │   ├── auth/password.ts   # hash-wasm argon2id — Node only
│   │   ├── db.ts              # postgres.js — prepare: false + OID 1082/1184 override
│   │   ├── queries.ts         # every SQL statement in this document
│   │   ├── required-schema.ts # declarative expectations for check:schema
│   │   ├── schema-guard.ts
│   │   └── storage.ts         # supabase-js — createSignedUrl, Storage only
│   ├── components/            # cross-module UI primitives only
│   ├── hooks/                 # cross-module React hooks, use-<thing>.ts. Same one-consumer
│   │                          # rule; a module's own hooks stay there as *.queries.ts
│   ├── lib/                   # polish for installed libraries, flat
│   └── utils/                 # admin-only helpers
└── scripts/
    ├── check-domain.mjs
    ├── check-schema.test.ts
    └── check-setup.test.ts
```

Nothing under `src/` imports from `src/app/`, and feature modules never import each other — same as web. `src/components/` and `src/hooks/` sit **below** modules and must not import one: a shared hook that reaches into a module is that module's hook in the wrong folder, and it drags whatever the module imports onto every surface using it. `@/` resolves to `./src/*`, with one exception: `src/domain/` imports its own siblings **relatively** (`from "./slots"`), so the byte-identical copy resolves identically in both repos regardless of either tsconfig.

Web enforces all of the above twice — ESLint zones catch the `@/` spelling, `check:docs` resolves the relative one, which no glob can express. Copy both halves when this repo writes its own config at step 03; web's own checkpoint found that three of these rules were passing lint in their relative form.
