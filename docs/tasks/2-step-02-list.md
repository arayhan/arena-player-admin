# 2 · step 02 — `/bookings`, the queue

**Depends**: 01 (`listBookings` and the `searchParams` parser)
**Blocks**: 04 (the actions render on these rows), 06
**Agent**: `software-engineer`

## Goal

The screen the admin opens to do work. Server Component, live Neon, every piece of filter state in the URL, and the naked `/bookings` URL is **already** the pending-from-today queue.

The app shell, the primitives (`Button`, `StatusPill`, `Panel`, `Field`, `EmptyState`, `Breadcrumbs`) and the token layer all exist. This step builds the queue inside them and adds nothing to `src/components/`.

## "Zero clicks" means the defaults, not a redirect

The Phase 2 DoD line _"Default view is the pending queue from today forward, and reaching it requires zero clicks"_ is about the query defaults from step 01 — `status=pending`, `from=today`, sorted soonest-game-first — not about the landing route. `/` stays the dashboard per architecture.md's route map and gets its content in Phase 3. **Do not add a `/` → `/bookings` redirect**; the sidebar already links here, and a redirect would make the Beranda nav item bounce off itself the moment Phase 3 fills it.

## Two dependencies deliberately not added

The design mockup drove its queue with `@tanstack/table-core` in manual mode and its charts with Chart.js. **Neither is in [architecture.md](../architecture.md)'s resolved dependency table, and neither is added here.**

- **`@tanstack/table-core`** — with `manualPagination`, `manualSorting` and `manualFiltering` all true and only the core row model, it re-emits the fifty rows the server already filtered, sorted and sliced. What it buys is a client component wrapping a table that has no client state. What it costs is the boundary rule in architecture.md and a package both repos must then carry at a matching major. Sortable headers are `<Link>`s that rewrite the query string; column visibility is not in Phase 2 at all.
- **Chart.js** — the trend chart and the statistics screen are not Phase 2 scope, and both need `booking_events` ([schema-request 002](../schema-requests/002-booking-events.md)), which is written and unapplied.

Deliverable: add both to architecture.md's **Deliberately absent** table with those reasons, so the next agent reads an omission as a decision. Adding either later is a change to that table plus the user's approval, not an import.

## Deliverables

- **`src/app/(dashboard)/bookings/page.tsx`** — Server Component. `export const dynamic = "force-dynamic"`. `searchParams` is a **Promise in Next 16 and must be awaited**; parse it through step 01's schema, call `listBookings`, render.
- **`src/modules/bookings/bookings-table.tsx`** — the table at desktop widths. Columns: Jadwal (date + slot), Pemesan (team name + `wa.me` link), Status (`StatusPill`), Umur, Tindakan (step 04 fills this; leave the cell and its header).
- **`src/modules/bookings/booking-card.tsx`** — below ~640px the table is not a table. One card per booking: date + slot as the heading, team name, status pill, age. The admin is at the field, on a phone.
- **`src/modules/bookings/bookings-filters.tsx`** — a plain `<form method="GET" action="/bookings">`. Status as checkboxes styled as pills (all four, plus the "Semua" case that submits all four), `from`/`to` as date inputs with a "Semua tanggal" control that clears `from`, and the search field. No JavaScript: a GET form _is_ URL state.
- **`src/modules/bookings/bookings-pager.tsx`** — 50 per page, page number in the URL, first/prev/next/last as links, and the "Menampilkan X–Y dari Z booking" line.
- **Sortable headers** — `<Link>`s to the same path with `sort` and `dir` rewritten. Clicking the active column flips `dir`.
- **Empty states**, two of them, using `EmptyState`, with the mockup's copy verbatim because the distinction is the point:
  - filters at their defaults and nothing found → **"Antrean kosong"** / _"Semua booking sudah ditindak. Tidak ada yang menunggu konfirmasi."_ — this is success, not a failed lookup.
  - any filter or search applied → **"Tidak ada yang cocok"** / _"Tidak ada booking dengan filter ini. Ubah kata kunci, status, atau matikan filter tanggal."_
- **Urgent treatment** for a `pending` row whose age is ≥ 21 hours — it is within three hours of the expiry job taking the slot back off a customer who has already paid a deposit. Surface + ink from DESIGN.md's amber triple; never colour alone.
- **Update architecture.md's folder tree** — it still shows `src/app/bookings/page.tsx`; the `(dashboard)` route group landed with the shell.

## Rules this screen must not break

- **No `notes` in the list.** Up to 500 characters wrecks row height; detail page only. It is a DoD line and it is one careless `select *` away from being wrong.
- **No proof column.** The mockup had a "Lihat bukti" button per row; that would mint fifty presigned bearer URLs — one per row, per render — to look at one. The row links to `/bookings/[id]`, where exactly one is minted. Record that reason in the component.
- **No `"use client"` in this step.** The filters are a GET form, the sort headers are links, the pager is links. If something here seems to need client state, it is a sign the state belongs in the URL.
- **`phone` renders as a working `wa.me` link** — `https://wa.me/628…` from the stored normalised value, with an accessible label naming the person.
- **Never `next/image`.** Nothing on this page is an image, and that is the point at which someone adds one.

## Two rendering traps

**Page clamping.** Changing sort or filter while on page 7 of a 3-page result must not render an empty page. Clamp the requested page to the last available page **server-side**, from `totalCount`, and reset to page 1 whenever a filter or sort param changes.

**`total_count` on an empty page.** Covered at step 01, visible here: "Menampilkan 0 dari 0 booking", never `NaN`, and it is the empty queue — the case that ships — that shows it.

## Acceptance

```bash
pnpm dev        # then, with a valid session cookie in $C:

# defaults: the naked URL is the pending queue from today, zero clicks
curl -s -b "$C" localhost:3001/bookings | grep -c "Pending"
# round-trip: every filter survives a reload and a shared link
for u in "?status=all" "?status=confirmed&status=rejected" "?q=628" "?sort=who&dir=desc" \
         "?page=2" "?from=2026-01-01&to=2026-12-31"; do
  echo "$u -> $(curl -s -o /dev/null -w '%{http_code}' -b "$C" "localhost:3001/bookings$u")"
done                                    # expect: 200 for every one

# a hand-edited URL must not 500
curl -s -o /dev/null -w "%{http_code}\n" -b "$C" "localhost:3001/bookings?sort=DROP&dir=;--&page=-4&status=nonsense"
# expect: 200, rendering the DEFAULT queue

# no client component crept in
grep -rn "use client" src/modules/bookings src/app/\(dashboard\)/bookings   # expect: no match
# notes never reach the list
grep -rn "notes" src/modules/bookings/bookings-table.tsx src/modules/bookings/booking-card.tsx  # expect: no match
# the two rules that fail silently
grep -rn "next/image" src/                                   # expect: no match
grep -n "force-dynamic" "src/app/(dashboard)/bookings/page.tsx"
grep -rn "wa.me" src/modules/bookings                        # expect: present

# response is never cacheable
curl -sI -b "$C" localhost:3001/bookings | grep -i cache-control   # expect: private, no-store

pnpm check && pnpm build
```

**375px is measured, not inferred.** Load `/bookings` at a 375px viewport in a real browser: cards not a table, `scrollWidth === clientWidth` (no horizontal overflow), and the `wa.me` link tappable. A breakpoint in the CSS is not evidence.

**Prove the empty states are reachable.** `?q=zzzzzzzz` gives "Tidak ada yang cocok"; the default view with no pending rows gives "Antrean kosong". If the database has no rows yet, the second one is the only state this screen renders — say so in the handoff rather than claiming the first was verified.

**Not done until** the list has rendered **real rows from Neon** and both empty states have been seen. Reason: this repo has no mock layer on purpose, so a bookings list that has only ever rendered zero rows has never exercised the date casts, the status typing, `count(*) over ()`, or the phone link — the four things that go wrong quietly. If the table is still empty, [2-gate-migration](2-gate-migration.md) row 4 is the blocker, and it is named there.

handoff: `software-engineer` for step 03
