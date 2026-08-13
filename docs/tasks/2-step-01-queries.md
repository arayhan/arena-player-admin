# 2 · step 01 — The data layer: `queries.ts` and the URL→SQL boundary

**Depends**: [2-gate-migration](2-gate-migration.md) — every acceptance line below that touches Neon is unrunnable until it clears
**Blocks**: 02, 03, 04, 05, 06 — every screen in Phase 2 reads through this file
**Agent**: `software-engineer`

## Goal

Turn the SQL that is currently **prose in [architecture.md](../architecture.md)** into code in `src/server/queries.ts`, and build the one piece that connects a URL to it: zod parsing of `searchParams` into bound parameters.

No page, no component, no action. This step is the seam where user input becomes SQL parameters, which is the only place in Phase 2 where a mistake is an injection rather than a rendering bug.

## Read this before writing a line

**Every SQL statement lives in `src/server/queries.ts`** ([dev-rules.md](../dev-rules.md)) and the statements in architecture.md are **a contract, not a draft** — copy them verbatim, including the `::text` casts, `count(*) over ()`, and the guard clauses. If a screen needs a query architecture.md does not have, **the query is written into architecture.md first and copied here second.**

That applies immediately: **`getBookingById` does not exist in architecture.md.** Do not invent it in `queries.ts`. Write it into architecture.md — a short "The detail read" section next to the list query — then copy it.

## Deliverables

### `src/server/queries.ts`

Four statements, `import "server-only"` at the top like every file in `src/server/`:

| Export           | Statement source                                                    |
| ---------------- | ------------------------------------------------------------------- |
| `listBookings`   | architecture.md, "The query" — verbatim, all seven parameters       |
| `getBookingById` | **write into architecture.md first**, then copy                     |
| `confirmBooking` | architecture.md, "Status mutations" — the `pending` guard           |
| `rejectBooking`  | architecture.md, "Status mutations" — the `pending,confirmed` guard |

`getBookingById` selects the same columns as the list **plus `notes`**, with the same `::text` casts on `booking_date` and `created_at`, `where id = $1`. No status filter — the detail page renders every state.

Row types are exported and typed against the frozen domain: `status: BookingStatus` and `time_slot: TimeSlot` from `src/domain/`, never `string`.

### The `ORDER BY` allow-list, extended

architecture.md's `SORTABLE` object is the column half. The queue's headers sort **both ways**, so direction needs its own allow-list — a two-key literal map, not a template string, not `dir === "desc" ? "desc" : "asc"` concatenated into the SQL by hand:

```ts
const SORT_DIR = { asc: "asc", desc: "desc" } as const;
```

Add the direction half to architecture.md alongside `SORTABLE`, for the same reason the column half is written there.

### `src/modules/bookings/bookings.schema.ts`

zod parsing of `searchParams` → a typed filter object → bound parameters. Per [dev-rules.md](../dev-rules.md) the `schema` role is exactly this.

| Param    | Parsed to                                       | Default          |
| -------- | ----------------------------------------------- | ---------------- |
| `status` | subset of `BOOKING_STATUSES`, order-insensitive | `["pending"]`    |
| `from`   | `YYYY-MM-DD`, via `isBookingDateString`         | `todayAtField()` |
| `to`     | `YYYY-MM-DD`                                    | none             |
| `q`      | trimmed text                                    | none             |
| `sort`   | key of `SORTABLE`                               | `when`           |
| `dir`    | key of `SORT_DIR`                               | `asc`            |
| `page`   | positive int                                    | `1`              |

**Invalid input falls back to the default and never throws.** A hand-edited URL, a stale bookmark, or a crawler must produce the default queue, not a 500. That is stated in architecture.md for the sort key already; it applies to all seven.

Also here: `q` → `{ q_text, q_phone }`, where `q_phone` is `normalisePhone(q)` from `src/domain/phone.ts` and is `null` when the input carries no digits. This makes the admin the second real consumer of that module, which is why it is in the byte-identical set.

### Colocated tests, credential-free

`bookings.schema.test.ts` under `check:unit`. Real assertions, not shape checks: every default, every fallback, the phone normalisation (`0812-3456-7890` must reach SQL as something that substring-matches `628123456789`), and the wildcard escaping below.

## Five traps in this step, each silent

**1. `count(*) over ()` comes back as a string.** It is a `bigint` (oid 20) and neither the OID override nor the `::text` casts touch it. `totalCount` typed `number` with an explicit `Number()` — otherwise `Math.ceil(total / 50)` and every "Menampilkan X dari Y" line quietly does string arithmetic.

**2. `count(*) over ()` returns nothing at all on an empty result set.** There is no row to carry it. `totalCount` must default to `0` at the boundary, not read `rows[0].total_count` and get `undefined`. The empty queue is the product's _success_ condition and it is the case that renders `NaN`.

**3. An empty status array selects nothing.** `status = any(ARRAY[]::text[])` matches zero rows. "Semua" expands to all four members of `BOOKING_STATUSES`; it never becomes an empty array, and the parser must not let an unrecognised `?status=` value produce one.

**4. `ilike '%' || $4 || '%'` treats `%` and `_` as wildcards.** An admin searching for a team name containing `_` silently matches more than they typed, and a bare `%` matches everything. Escape `\`, `%` and `_` in TypeScript before binding, and put the `escape` clause in the statement to match.

**5. `todayInJakarta()` no longer exists.** The domain copy was corrected to WITA (`Asia/Makassar`) — the function is `todayAtField()`. Grep for the old name before assuming; the default `from` is the one place it matters.

## Acceptance

```bash
# --- the gate's own criterion, re-run here because everything below assumes it ---
pnpm check:schema                        # expect: exit 0, 10/10

# --- every statement is traceable to architecture.md ---
grep -n "getBookingById\|detail read" docs/architecture.md    # expect: present BEFORE it exists in code
grep -c "count(\*) over ()" src/server/queries.ts             # expect: 1
grep -n "::text" src/server/queries.ts                        # expect: booking_date and created_at in BOTH reads

# --- guards: no blind update anywhere ---
grep -nE "update bookings set status" -A 2 src/server/queries.ts
# expect: every one followed by `where id = $1 and status ...` — never `where id = $1` alone
grep -c "returning id, status" src/server/queries.ts          # expect: 2

# --- the sort key is never interpolated ---
grep -nE '\$\{[^}]*(sort|dir|order)' src/server/queries.ts    # expect: NO match
grep -n "SORTABLE\|SORT_DIR" src/server/queries.ts            # expect: both, as `as const` lookups

# --- hard rules ---
grep -n 'server-only' src/server/queries.ts                   # expect: line 1
grep -rniE "create table|alter table|drop table|insert into bookings|delete from bookings" src/ scripts/
# expect: no match — this repo selects and updates status, nothing else

# --- credential-free proof of the URL boundary ---
pnpm check:unit                                                # schema tests pass with .env.local moved aside
mv .env.local .env.local.bak && pnpm check:unit ; mv .env.local.bak .env.local
```

**Prove the parser fails before trusting it.** Plant each of these and watch a test go red, then revert: `status` defaulting to `[]` instead of `["pending"]`; `totalCount` read without `Number()`; `q` bound without wildcard escaping; the `dir` value concatenated rather than looked up.

**Not done until** `getBookingById` and the `SORT_DIR` allow-list are in **architecture.md** before they are in `queries.ts`, and `pnpm check:schema` has been seen exiting 0 against the live database. The first because a query invented directly in `queries.ts` is a contract change made in the one file nobody reviews as a contract — and this repo has four statements total, so the discipline costs nothing now and everything later. The second because Phase 2 has been blocked on a schema nobody applied since it was written, and "the code compiles" has never once been evidence about that.

handoff: `software-engineer` for step 02
