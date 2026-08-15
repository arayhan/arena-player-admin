# 6 · step 01 — The reset: direction, and what it is allowed to change

**Depends**: nothing buildable. It reads [DESIGN.md](../DESIGN.md), [PRODUCT.md](../PRODUCT.md) principle 5, and the shell that already shipped (`8f8dcc7`)
**Blocks**: [6-step-02](6-step-02-shell-and-dashboard.md), [6-step-03](6-step-03-export-csv.md), and it **constrains** Phase 2 steps 02–05 — those screens are unbuilt, so they are built in this direction rather than restyled after
**Agent**: `uix-designer`

## Goal

Turn a confirmed verbal brief into the normative record, before anyone builds against a remembered version of it. The app is being reset into a professional minimalist dashboard: **layout and components replaced, palette and Indonesian copy kept.** This step writes that into [DESIGN.md](../DESIGN.md), which is the file every later step is checked against.

It writes no feature code. It changes the token layer, the shell's own rules, and the states inventory — and it records what is buildable now versus what is waiting on a person.

## Read this before planning a "restyle": most of it does not exist yet

`find src -type f`, 2026-08-15:

```
src/modules/.gitkeep          ← the entire bookings module is unbuilt
src/app/(dashboard)/          layout.tsx, page.tsx, _components/{brand-mark,sidebar-nav}.tsx
src/components/               breadcrumbs, button, empty-state, field, nav-drawer, panel,
                              status-pill, theme-toggle
src/app/login/page.tsx, src/app/api/auth/*, src/server/*, src/domain/*
```

There is **no table, no queue, no detail page, no proof panel, no settings screen and no chart.** Phase 2's six step files are written and none of them has been executed. So:

- "Restyle the datatable, don't re-architect it" is a rule about the **server-resolved, URL-state design already specified in [2-step-01](2-step-01-queries.md) and [2-step-02](2-step-02-list.md)** — that architecture stands and is not reopened. There is no client-side table to salvage and none to introduce.
- The reset **does not produce a second version** of the queue. It produces the direction 2-step-02 builds it in, once. Anyone who writes a Phase 6 step that "restyles the bookings table" has scheduled the work twice.
- What is genuinely being **replaced** is the nine files that exist: the shell, the nav, the dashboard placeholder, and the eight primitives.

> **Flagged, and it is a real defect today:** `sidebar-nav.tsx` links to `/stats`, `/export` and `/settings`. None of the three has a route, a page, or a row in [architecture.md](../architecture.md)'s route map — the nav promises six destinations and three of them 404. The reset either builds them or stops promising them; it must not ship a fourth version of the same nav that still points at nothing.

## Why this is numbered 6

[6-gate-settings-and-expiry](6-gate-settings-and-expiry.md) already put the settings / statistics / export cluster at Phase 6 in this folder, and the reset's blocked half is exactly that cluster plus the walk-in create and soft delete. Numbering it 2b would mean reopening a phase whose Definition of Done is written and whose entry gate has not cleared.

> **RESOLVED 2026-08-15:** [PRD.md](../PRD.md) now carries a Phase 6, so this numbering is the PRD's and not this folder's invention. Its **Definition of Done is a draft awaiting the user's sign-off** — those lines are a contract once agreed, and no step file here should be executed against them until they are approved or corrected.

## Who this is for

One field admin. Phone as often as laptop, standing at the field, mid-task, with a customer waiting on WhatsApp for a slot to be released or confirmed. Visitor mode is **Operate**: they arrived to do a known task, not to browse, not to be persuaded, not to explore. Every second between page load and the first actionable row is a second the customer is waiting.

## The line that matters most

**"Minimalist" here means _fewer things competing_, not _airy_.**

[PRODUCT.md](../PRODUCT.md) principle 5 is _dense, boring, fast_, and principle 5 wins every time the two readings disagree. A dashboard with generous whitespace, a big greeting, four hero metric cards and the queue starting below the fold **fails this product** however well it photographs. Reduce the number of elements asking for attention; do not reduce the amount of work visible per screen.

The test, and it is the one to apply to every layout decision in this phase: **did the change remove something that was competing, or did it just push the work further down?**

## Direction — replaced and kept

| Replaced                                             | Kept, and not open for discussion                                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The app shell and its grid                           | Navy `#011A43` and blue `#2563EB` — **sampled from the client's logo**, not a design choice available here |
| The nav: six items, three of them dead links         | The other 16 palette primitives and both status triples                                                    |
| The dashboard placeholder page                       | Every semantic token name (`ground`, `surface`, `ink`, `ink-muted`, `border`, `accent`, `scrim`, …)        |
| Density, type scale, spacing rhythm                  | Dark mode as a semantic tier — no `dark:` prefix per element                                               |
| The eight primitives in `src/components/`, as needed | **Indonesian UI copy**, and the existing strings verbatim where they already exist                         |
| Table and card presentation                          | Computed-contrast discipline: every new pair measured and written into the table, never asserted           |
|                                                      | The motion ceiling: `background-color` / `border-color` only, ≤160ms, `prefers-reduced-motion` honoured    |

**Contrast is the rule with a history.** DESIGN.md records an earlier draft claiming 7.4:1 for a pair that measures 6.49, and the web repo shipped two overstated ratios. A plausible number is the easiest kind to not check. Any colour this reset introduces arrives with its computed ratio in the measured tables — light **and** dark, sixteen pairs each — or it does not arrive.

## Layout law

1. **Queue first at every viewport.** On `/` and on `/bookings`, the first actionable row is above the fold at 375px and at 1280px. Revenue and counts are a **supporting band**, not a hero. If the band cannot fit above the queue without pushing it down, the band moves below the queue — the band is the thing that yields.
2. **At 375px the table is cards, not a horizontal scroll.** `scrollWidth === clientWidth`. A horizontally scrolling table on a phone is an unusable table.
3. **Focus moves to the result after every mutation.** Confirm, reject, create, delete: after the Server Action and `revalidatePath`, focus lands on the thing that changed or on the message explaining why it did not. The admin is often one-handed on a phone; a mutation that leaves focus at the top of the document costs them the scroll back.
4. **One primary action per surface.** Everything else is quiet. This is where "fewer things competing" is actually spent.

## Surfaces

| Surface          | Route              | Built by                                                          | Phase state                                                        |
| ---------------- | ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| Dashboard        | `/`                | [6-step-02](6-step-02-shell-and-dashboard.md)                     | buildable now                                                      |
| Queue            | `/bookings`        | [2-step-02](2-step-02-list.md), in this direction                 | buildable now                                                      |
| Detail + proof   | `/bookings/[id]`   | [2-step-03](2-step-03-detail.md), [2-step-05](2-step-05-proof.md) | buildable now                                                      |
| Export           | `/bookings` action | [6-step-03](6-step-03-export-csv.md)                              | CSV buildable now; PDF undecided                                   |
| Settings         | `/settings`        | not yet a step file                                               | blocked — [003](../schema-requests/003-site-settings.md) unapplied |
| Create (walk-in) | `/bookings/new`    | not yet a step file                                               | blocked — [005](../schema-requests/005-admin-writes-bookings.md)   |
| Soft delete      | on the detail page | not yet a step file                                               | blocked — [005](../schema-requests/005-admin-writes-bookings.md)   |

> **Route naming, DECIDED 2026-08-15: paths are English, labels are Indonesian.** `/settings`, `/export`, `/stats`, `/bookings/new` — matching `/bookings` and `/blocks`, and matching what `sidebar-nav.tsx` already links, so nothing needs renaming. Hard rule 10 governs UI copy, and a URL path is code: the admin reads **Pengaturan** in the nav and never types the path. The screen names stay Indonesian throughout — this decides the path only.

## States that must be designed, not discovered

Every one of these is a state the admin will actually see. None of them is an edge case, and each is currently un-designed.

| State                       | Where it renders                | Must read as                                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Empty queue**             | `/` and `/bookings` defaults    | **Success.** "Antrean kosong" — everything is actioned. Not a failed lookup, not an error tone, not an illustration of emptiness. This is the state the app spends most of its life in, and it is the one that ships first                                                                         |
| **No results for a filter** | `/bookings` with any filter set | A different thing entirely from the above, with the escape route in the copy ([2-step-02](2-step-02-list.md) carries both strings verbatim)                                                                                                                                                        |
| **Booking with no proof**   | `/bookings/[id]`                | A **real, ordinary state** once walk-ins exist — "dibuat oleh admin, tanpa bukti transfer" — never the failed-load treatment. This is the reversal of a defect already fixed once: the mockup rendered "Belum ada" for a case that could not exist, and now the case exists for a different reason |
| **Proof fails to sign**     | `/bookings/[id]`                | Distinct from the expired link. "Muat ulang" is misleading advice for a misconfigured bucket and produces the identical failure forever ([2-step-05](2-step-05-proof.md))                                                                                                                          |
| **Expired signed URL**      | `/bookings/[id]`                | The recovery block plus **"Muat ulang bukti"**, never a broken-image icon                                                                                                                                                                                                                          |
| **409, already actioned**   | after confirm / reject / delete | Someone else's tab, or the expiry job, moved the row between render and click. Say what it is now, not "gagal". The admin's next action depends on the new state, so show it                                                                                                                       |
| **Schema guard 503**        | settings, stats, export only    | Names the schema request that is missing. **Scoped** — hard rule 6: it gates its own feature and never the shell, and the bookings console keeps working with every Phase 4/6 table absent                                                                                                         |
| **Missing rate card**       | the revenue band, everywhere    | **Hidden, not zero, not estimated.** A number on a dashboard is read as a fact; `Rp 0` is a fabricated figure with extra steps                                                                                                                                                                     |

## Ranges — design against the real numbers

- **126 active bookings maximum**: 9 slots × 14 days. Pagination exists for comfort at 50/page, not for scale, and no virtualisation, no infinite scroll and no index is justified by this volume ([architecture.md](../architecture.md) already decided "None added").
- Historical rows accumulate — `rejected` and `expired` do not disappear — so the **export** is the surface with an unbounded row count, not the queue. See [6-step-03](6-step-03-export-csv.md).
- One user. One session. No concurrency to design for except the two-tabs case, which is what the 409 state is.

## Anti-goals

- **No client-side table library.** [2-step-02](2-step-02-list.md) rejected `@tanstack/table-core` with reasons that still hold, and [architecture.md](../architecture.md)'s **Deliberately absent** table names it. Filters are a GET form, sort headers are links, the pager is links.
- **No motion beyond the ceiling.** No entrance animations, no skeleton shimmer, no chart draw-in, no page transitions. Hard rule 7.
- **No fabricated figure anywhere** — no placeholder rupiah, no sample chart data, no lorem row. PRODUCT.md forbids it by name and a screenshot of a fake number is indistinguishable from a real one.
- **No new dependency** as a side effect of the visual reset. Icons, class-merging helpers and chart libraries are each a decision recorded in architecture.md's dependency table, not an import.

## Phasing — the part that decides what happens this week

**Buildable now, no migration, no client decision:**

- the whole visual reset — shell, grid, nav, density, type scale, spacing, primitives
- the queue itself: server-resolved, URL state for filter / search / sort / page, cards at 375px
- breadcrumbs, mounted on every surface
- **every** empty and error state above, including the ones whose feature is blocked — a state can be designed and built before the flow that produces it exists
- bookings **CSV** export honouring the active filters ([6-step-03](6-step-03-export-csv.md))

**Blocked on the rate card** (client content — [6-gate-settings-and-expiry](6-gate-settings-and-expiry.md) question 3): every revenue chart and every rupiah figure. Revenue basis is confirmed: **DP actually collected — `confirmed` bookings only, at the `dp_percent` in `site_settings`** (the Ketentuan says 50 and that is the only place the number lives). The rate itself is a **table, not a value** — it varies by time and by day type, and [003](../schema-requests/003-site-settings.md) gives it its own `rate_card` table keyed `(time_slot, day_type)`, not a pair of settings keys. Until the client supplies the figures the band renders its missing-rate-card state; it does not interpolate, average, or default.

**Blocked on migrations:**

| Feature             | Needs                                                       | Request                                                                     |
| ------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| Settings screen     | `site_settings`, `bank_accounts`, `site_rules`, `rate_card` | [003](../schema-requests/003-site-settings.md) — written, unapplied         |
| Walk-in create      | `bookings.proof_key` **nullable**                           | [005](../schema-requests/005-admin-writes-bookings.md) — written, unapplied |
| Soft delete         | `deleted` accepted by `status_valid`                        | [005](../schema-requests/005-admin-writes-bookings.md) — same transaction   |
| Activity-log export | `booking_events`                                            | [002](../schema-requests/002-booking-events.md) — written, unapplied        |

> **005 is the only `alter table bookings` in the project**, which [schema-requests/README.md](../schema-requests/README.md) singles out as the thing never to do casually — that table is where `uniq_active_slot` sits. It batches both changes into one transaction on purpose. Neither half is authored here: this repo never owns a migration (hard rule 1), the `src/domain/status.ts` change is authored in web and re-copied (hard rule 4), and the cross-repo sequence is [6-gate-web-settings-and-status](6-gate-web-settings-and-status.md).

> **The settings screen is not uniformly editable on day one.** 003 records which of its five web reads are order-critical: the WhatsApp number and the Ketentuan are **hardcoded and plausible** on the public site, so an admin edit web has not yet read leaves customers messaging the old number and agreeing to superseded terms, with a save confirmation on this side. Those two fields render **read-only, with the reason on screen**, until web deploys their reads. The other three degrade to a visible _"menyusul"_ and need no ordering. Do not flatten the two cases into one screen state.

**Undecided — a scope call, not an engineering one:** **PDF export.** This repo carries no PDF dependency and CSV needs none. Adding one means a new row in architecture.md's resolved-dependency table with a reason that survives review, in a repo whose dependency list is short on purpose and whose one user opens files in a spreadsheet. The two honest options are (a) add the row and justify it, or (b) **CSV ships alone and PDF defers**. Do not resolve this by importing something.

## Deliverables

- **[DESIGN.md](../DESIGN.md)** — normative, and the only place this direction is allowed to live:
  - a **Direction** section carrying the "fewer things competing, not airy" paragraph and its test, in the same voice as the existing "same palette, none of the motion"
  - the **density and type scale** for a data surface: row height, cell padding, the spacing rhythm, and the type steps actually used by a table (the frontmatter's 24/18/16/14/12 already exists — say which does what, and whether the reset changes any value)
  - the **states inventory** above, as a table, with the copy for each state written in Indonesian
  - any new semantic token, **with its measured ratio in both the light and the dark tables**
  - the layout law, stated as rules a reviewer can hold a screenshot against
- **`src/app/globals.css`** — the `@theme` block updated to match, hand-authored, transcribed from the frontmatter. No generator; architecture.md settled that.
- **[architecture.md](../architecture.md)** — route-map rows for the surfaces this phase names (`/settings`, `/export`, `/stats`, `/bookings/new`), each marked with what blocks it. A nav item with no row here is how the current three dead links happened.
- **No new `check:` script.** Nothing in this step is machine-checkable in a way the existing four do not already cover, and hard rule 9 means a new check must be proven to fail before it is trusted — that cost is not paid for a design record. An agent-only helper, if one is wanted, is a slash command per [tooling-placement.md](../rules/tooling-placement.md).

## Acceptance

```bash
# 1. the brand primitives did not move. The reset is structural
git diff docs/DESIGN.md | grep -E '^[-+]\s+(navy|blue|grey|amber|red|green|white)-[0-9]+:'
# expect: no output. #011A43 and #2563EB are sampled from the logo, not chosen

# 2. every hex in the token layer is declared in DESIGN.md
comm -23 <(grep -oE '#[0-9A-Fa-f]{6}' src/app/globals.css | tr 'a-f' 'A-F' | sort -u) \
         <(grep -oE '#[0-9A-Fa-f]{6}' docs/DESIGN.md      | tr 'a-f' 'A-F' | sort -u)
# expect: empty. A colour in the CSS and not in DESIGN.md is an unmeasured colour

# 3. the motion ceiling
grep -rn "transition\|animation\|@keyframes" src/app/globals.css src/components src/app
# expect: background-color / border-color only, every duration <= 160ms
grep -rn "prefers-reduced-motion" src/app/globals.css        # expect: present

# 4. no dependency crept in with the reset
git diff package.json                                        # expect: no change

# 5. nothing fabricated
grep -rnE "Rp ?[0-9]" src/                                   # expect: no match

pnpm check
```

**Contrast is recomputed, not carried forward.** For every pair added or changed, compute the sRGB ratio and put the figure in the table. Both themes. The instruction is literal because this file already records what happens when it is not followed.

**Not done until** a reviewer can take a screenshot of any screen in this phase and decide, from DESIGN.md alone, whether it complies — including the density question. Reason: this direction arrived as a conversation, and the failure mode of a conversation is that the next agent builds a spacious dashboard, calls it minimalist, and is not wrong by anything written down. The one line that must survive is the one that is easiest to lose: **fewer things competing, not airy.**

handoff: `software-engineer` for [6-step-02](6-step-02-shell-and-dashboard.md)
