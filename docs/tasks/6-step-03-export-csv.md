# 6 · step 03 — Bookings CSV, honouring the filters on screen

**Depends**: [6-step-01](6-step-01-direction.md) (direction), [2-step-01](2-step-01-queries.md) (**the same** `searchParams` parser and `listBookings`), [6-step-02](6-step-02-shell-and-dashboard.md) (where the control lives)
**Blocks**: nothing. It is the last piece of the reset that needs no migration and no client decision
**Agent**: `software-engineer`

## Goal

The admin filters the queue, gets the rows they were looking at, and opens them in a spreadsheet. One dataset — **bookings** — and it is the only one of the three the Ekspor screen was going to sell that can be built today.

The other two are named here so nobody builds them by accident:

- **Log aktivitas** needs `booking_events` — [002](../schema-requests/002-booking-events.md), written and unapplied. An export offering a file it cannot produce is the defect this repo already caught once.
- **Rekap pendapatan / rate card** needs the rate card in `site_settings` — [003](../schema-requests/003-site-settings.md) plus the client's figures ([6-gate-settings-and-expiry](6-gate-settings-and-expiry.md) question 3).

## The rule the whole step turns on

**One parser, one query, two renderers.** The export route parses `searchParams` with [2-step-01](2-step-01-queries.md)'s **existing** schema and calls its **existing** `listBookings`. It does not re-derive the filters, re-order the SQL, or maintain its own copy of the direction allow-list.

A second parser is how an export silently disagrees with the screen that launched it: the admin sees "Menampilkan 1–50 dari 63 booking", exports, gets 41 rows, and has no way to tell which set is the wrong one. Nothing throws, both files look plausible, and the number that reaches the client is whichever they opened.

The **only** deliberate difference: the export ignores `page` and returns the whole filtered set. Sort, status, date range and search all apply exactly as they do on screen.

## Deliverables

- **`src/app/api/exports/bookings/route.ts`** — `GET`, session-authenticated by the same middleware as every other page. Node runtime. Responds `text/csv; charset=utf-8` with `Content-Disposition: attachment; filename="booking-YYYY-MM-DD.csv"` and `Cache-Control: private, no-store`.
- **`src/modules/bookings/bookings-export-link.tsx`** — a plain `<a href>` on the queue, labelled **"Ekspor CSV"**, whose href is the current path's query string forwarded to the export route. No JavaScript, no client component: the filters are already in the URL, which is the entire benefit of having put them there.
- **A row in [architecture.md](../architecture.md)'s route map**, with its auth and runtime, and a line in the SQL-contracts section saying it issues no new statement — it reuses the list query.

## CSV correctness, which is where this fails quietly

The file is opened by one person, in a spreadsheet, in Indonesia. Each of these is a real corruption that looks like a working file:

| Trap                          | What happens                                                                   | What to do                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Phone becomes a number**    | `628123456789` renders as `6.28123E+11`, and the admin cannot dial it          | Quote it, and prefix or format so the spreadsheet keeps it as text. **Verify in the real spreadsheet app, not in a terminal** |
| **UTF-8 without a BOM**       | Excel reads the file as ANSI and mangles every accented or non-ASCII character | Emit a UTF-8 BOM                                                                                                              |
| **Team names contain commas** | column shift, silently, for that row only                                      | RFC 4180 quoting, doubled `"` inside quoted fields                                                                            |
| **`notes` contains newlines** | up to 500 characters, and a raw newline splits one row into two                | Quoted field, newlines preserved inside quotes or normalised — pick one and say which                                         |
| **`time_slot` reformatted**   | the nine canonical strings are what `uniq_active_slot` compares as text        | Emit verbatim from the row. Never re-render from a Date                                                                       |
| **Dates re-formatted**        | a locale-formatted date is ambiguous and unsortable                            | `YYYY-MM-DD`, from the DATE value, no timezone arithmetic on the way out                                                      |

**Never export `proof_key`, and never a signed URL.** The key is a path into a private bucket and a signed URL is a **bearer capability** — anyone holding it fetches a customer's payment document. A CSV is the single most forwardable artefact this app produces. Hard rule 2's family, one file further out.

**Never silently truncate.** The queue is bounded at 126 active rows, but `rejected` and `expired` accumulate forever, so this is the one surface with an unbounded count. Set an explicit ceiling, and when a filter exceeds it **fail loudly with a message telling the admin to narrow the date range** — a file that is quietly short is worse than a file that was refused, because it is indistinguishable from a quiet period.

## Acceptance

```bash
pnpm dev        # with a valid session cookie in $C

# 1. unauthenticated is refused. This route hands out the whole customer list
curl -s -o /dev/null -w "%{http_code}\n" "localhost:3001/api/exports/bookings"
# expect: NOT 200 — the middleware redirect or a 401

# 2. the export agrees with the screen, filter for filter
Q="?status=confirmed&from=2026-01-01&to=2026-12-31"
curl -s -b "$C" "localhost:3001/bookings$Q" | grep -oE "dari [0-9]+ booking"
curl -s -b "$C" "localhost:3001/api/exports/bookings$Q" | tail -n +2 | wc -l
# expect: the same number. Repeat with ?q=, with a sort, and with no filters at all

# 3. page is ignored, filters are not
diff <(curl -s -b "$C" "localhost:3001/api/exports/bookings$Q") \
     <(curl -s -b "$C" "localhost:3001/api/exports/bookings$Q&page=3")
# expect: identical

# 4. a hand-edited query string does not 500
curl -s -o /dev/null -w "%{http_code}\n" -b "$C" \
  "localhost:3001/api/exports/bookings?sort=DROP&dir=;--&status=nonsense"
# expect: 200, the default set — same tolerance as the screen

# 5. nothing private leaves the building
curl -s -b "$C" "localhost:3001/api/exports/bookings" | grep -ic "proof_key\|token=\|storage/v1"
# expect: 0

# 6. headers
curl -sI -b "$C" "localhost:3001/api/exports/bookings" | grep -iE "content-type|content-disposition|cache-control"
# expect: text/csv; charset=utf-8 · attachment; filename=… · private, no-store

# 7. one parser, not two
grep -rn "z.object\|searchParams" src/app/api/exports/bookings/route.ts
# expect: it imports the schema from src/modules/bookings/, and defines none

pnpm check && pnpm build
```

**Prove the ceiling refuses rather than truncates.** Lower it temporarily to a number below the current row count, request the export, watch it fail with the narrow-your-range message, restore it. A limit that has only ever been under-run is a limit nobody has tested — hard rule 9, applied to a constant instead of a script.

**Not done until** the file has been **opened in a real spreadsheet application** with (a) a row whose team name contains a comma, (b) a row whose `notes` contains a newline, and (c) a phone number starting `628` — and the phone is still text, the columns still line up, and the Indonesian characters are intact. Reason: every failure in the table above produces a file that downloads successfully, opens successfully, and is wrong. The first person to notice is the client, holding a spreadsheet of phone numbers in scientific notation.

If the database has no rows with those properties yet, say so in the handoff and record the three cases as unverified rather than ticking them — [2-gate-migration](2-gate-migration.md) row 4 is the blocker and it is named there.

handoff: `uix-designer` — the blocked half of this phase resumes at [6-gate-settings-and-expiry](6-gate-settings-and-expiry.md) and [6-gate-web-settings-and-status](6-gate-web-settings-and-status.md), neither of which an agent can clear
