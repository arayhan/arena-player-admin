# 6 · step 02 — The shell, the nav, and a dashboard that leads with the queue

**Depends**: [6-step-01](6-step-01-direction.md) (DESIGN.md is normative before anything is built against it). The queue rows it renders need [2-step-01](2-step-01-queries.md)'s `listBookings`
**Blocks**: [6-step-03](6-step-03-export-csv.md). Constrains every later surface — this is where density, grid and nav are decided in code
**Agent**: `software-engineer`

## Goal

Replace the nine files that exist with the shell the reset describes, and turn `/` from a scaffold placeholder into the screen the admin actually lands on: **the queue first, the numbers under it.**

This is the step where "minimalist" is either spent on removing competition or spent on whitespace. [6-step-01](6-step-01-direction.md) has the test; apply it to every decision here.

## What is being replaced

| File                                              | What changes                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/app/(dashboard)/layout.tsx`                  | grid, density, max width, where the page title and breadcrumbs sit               |
| `src/app/(dashboard)/_components/sidebar-nav.tsx` | the item list, and the three dead links                                          |
| `src/app/(dashboard)/_components/brand-mark.tsx`  | kept as brand; restyled to the new scale only if it competes                     |
| `src/app/(dashboard)/page.tsx`                    | placeholder → the real dashboard                                                 |
| `src/components/*`                                | the eight primitives, restyled to the new density. Same exports, same file paths |
| `src/app/globals.css`                             | already updated at step 01; this step consumes it and adds no colour of its own  |

**Primitive APIs do not change in this step.** `Button`, `StatusPill`, `Panel`, `Field`, `EmptyState`, `Breadcrumbs` keep their props, because [2-step-02](2-step-02-list.md) through 05 are written against them and a prop rename here silently invalidates four step files. Restyle the inside; leave the seam.

## The nav, and the three links that go nowhere

Today it offers **Beranda, Booking, Statistik, Blokir Slot, Ekspor, Pengaturan**. `/stats`, `/export` and `/settings` have no route and no page: three of six items 404.

Fix it in one of two directions, and record which in [architecture.md](../architecture.md)'s route map:

1. **Preferred** — the nav lists what exists, and a blocked destination is either absent or visibly disabled with the reason ("menunggu migrasi 003"), never a live link into a 404.
2. If a route is added as a stub, it renders its blocked state properly — the schema-guard 503 or the missing-rate-card state from step 01's inventory — and is reachable, not a 404 with a nav item on top of it.

**Ekspor is not a nav destination in this phase.** [6-step-03](6-step-03-export-csv.md) makes it an action on the queue carrying the current filters, which is where the admin is when they want it. A separate export screen would have to rebuild the filter UI to be useful, and would then disagree with the queue's.

**Blokir Slot stays in the nav only if `/blocks` renders its guard state** rather than 404ing. Phase 4 owns the feature; hard rule 6 owns the failure mode.

## The dashboard

**Queue first.** `/` renders the pending queue — the same row and card components `/bookings` uses, capped at the first N rows, sorted soonest-game-first — above the supporting band, with a **"Lihat semua booking"** link into `/bookings` carrying the same defaults.

- **Do not redirect `/` → `/bookings`.** [2-step-02](2-step-02-list.md) says so and the reason still holds: the Beranda nav item would bounce off itself. Rendering the top of the queue on `/` is the shape that satisfies both.
- The row and card components are **imported from `src/modules/bookings/`**, not copied. `src/app/` may import a module; a module may not import `src/app/` and may not import another module.
- If [2-step-01](2-step-01-queries.md) has not landed when this step runs, build the shell and the band, leave the queue region mounted against the real query signature, and say so in the handoff. Do **not** stub rows — this repo has no mock layer on purpose.

**The supporting band**, under the queue, quiet, one row of small figures rather than four hero cards:

| Figure                 | Source                                                                        | State when unavailable                                    |
| ---------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| Pending count          | the same query as the queue                                                   | `0` is a real answer here, and it is the good one         |
| Oldest pending age     | the same query                                                                | absent when the queue is empty                            |
| Confirmed today        | `booking_events` — [002](../schema-requests/002-booking-events.md)            | schema-guard state naming 002. **Not** a zero             |
| Revenue (DP collected) | rate card in `site_settings` — [003](../schema-requests/003-site-settings.md) | **hidden**, with the missing-rate-card copy. Never `Rp 0` |

**The distinction that matters:** a count of zero is a fact; a figure derived from a table that does not exist is not, and rendering it as `0` or `Rp 0` fabricates it. Two visually different treatments, and the second one names what is missing.

**The manual expiry button** stays on this screen per architecture.md's route map, and belongs to Phase 3. Leave its place; do not wire it here.

## Rules this shell must not break

- **The schema guard never wraps the layout.** Hard rule 6. The band's confirmed-today and revenue cells each carry their own guard; the queue and the shell render regardless. A guard in `layout.tsx` takes the whole console down for a missing Phase 6 table, which is the exact inversion of the rule.
- **`"use client"` stays countable.** `theme-toggle.tsx` and `nav-drawer.tsx` are the two that exist. This step adds none; if it must, the file and its reason go into architecture.md's boundary section, which [2-step-05](2-step-05-proof.md) already requires be restated as a named list rather than a count.
- **`export const dynamic = "force-dynamic"` stays on `/`**, with the comment already in the file. A session-gated page must never be render-once-serve-many.
- **Never `next/image`.** Nothing here is an image. The brand mark is inline SVG or a plain `<img>`, and the trap is that this is the file where someone reaches for the optimizer first.
- **No new colour.** Every value comes from the `@theme` block step 01 authored.

## Acceptance

```bash
pnpm dev        # then, with a valid session cookie in $C:

# 1. no nav item points at a 404
for u in $(grep -oE 'href: "[^"]+"' "src/app/(dashboard)/_components/sidebar-nav.tsx" \
           | grep -oE '"/[^"]*"' | tr -d '"'); do
  echo "$u -> $(curl -s -o /dev/null -w '%{http_code}' -b "$C" "localhost:3001$u")"
done
# expect: 200 for every one. A 404 here is the defect this step exists to clear

# 2. the guard is scoped, not global
grep -rn "schema-guard\|schemaGuard" "src/app/(dashboard)/layout.tsx"   # expect: no match

# 3. nothing fabricated, and no colour invented
grep -rnE "Rp ?[0-9]" src/                                              # expect: no match
comm -23 <(grep -oE '#[0-9A-Fa-f]{6}' src/components src/app -r | grep -oE '#[0-9A-Fa-f]{6}' \
           | tr 'a-f' 'A-F' | sort -u) \
         <(grep -oE '#[0-9A-Fa-f]{6}' docs/DESIGN.md | tr 'a-f' 'A-F' | sort -u)
# expect: empty

# 4. the boundary rules
grep -rn "use client" src/                    # expect: exactly the files named in architecture.md
grep -rn "next/image" src/                    # expect: no match
grep -rn "@/app/" src/modules src/components  # expect: no match
grep -n "force-dynamic" "src/app/(dashboard)/page.tsx"
curl -sI -b "$C" localhost:3001/ | grep -i cache-control     # expect: private, no-store

pnpm check && pnpm build
```

**Measured in a browser, at two viewports, not inferred from a breakpoint:**

- **375px** — the first queue row is visible without scrolling; `document.documentElement.scrollWidth === clientWidth`; the nav is the drawer, not a squeezed sidebar; every tap target the admin uses one-handed is reachable.
- **1280px** — the first queue row is visible without scrolling, and so is the second. If the supporting band pushed the queue down, the band moves below it. That is the rule, and this is the measurement that enforces it.

Record both numbers — the y-offset of the first row at each width — in the handoff. "It looks fine" is what this step is designed to stop.

**Not done until** the dashboard has been loaded at 375px with the queue **empty** and with the queue **populated**, and both read correctly: empty is the success state, populated puts a real row above the fold. Reason: the empty case is the state this app spends most of its life in and the only one available before [2-gate-migration](2-gate-migration.md) clears — so it is the one that ships un-reviewed if nobody looks at it on a phone. If the database still has no rows, say exactly that in the handoff rather than claiming the populated case was verified.

handoff: `software-engineer` for [6-step-03](6-step-03-export-csv.md)
