# Arena Player Admin — Development rules

The conventions an agent cannot infer from the code. Getting one wrong here costs a review
comment; getting a [CLAUDE.md](../CLAUDE.md) hard rule wrong costs rework.

**This file never restates a rule that lives elsewhere.** Where the authority is another
document, it is linked and not copied. A copied rule is one that drifts — the web repo lost a
day to exactly that, three separate ways: the skills, the agents, and the hooks each held a
stale copy of a value that had moved.

| If you need                                         | Read                                 |
| --------------------------------------------------- | ------------------------------------ |
| The rules whose violation means rework              | [CLAUDE.md](../CLAUDE.md) hard rules |
| Every SQL statement, the route map, the proof path  | [architecture.md](architecture.md)   |
| Colour, type, spacing, contrast ratios              | [DESIGN.md](DESIGN.md) — normative   |
| The inherited schema and its gotchas                | [database.md](database.md)           |
| Who the admin is, what must not be fabricated       | [PRODUCT.md](PRODUCT.md)             |
| The per-surface rules an agent loads before editing | [rules/README.md](rules/README.md)   |

This repo mirrors `arena-player-web`'s conventions rather than inventing parallel ones —
one developer moves between the two repos, and a second naming scheme is a second thing to
remember for no product reason.

---

## Naming and file layout

| Kind          | Convention                                                             | Example                                         |
| ------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| Module file   | `<module>.<role>.ts`                                                   | `bookings.queries.ts`, `bookings.actions.ts`    |
| Component     | kebab-case file, PascalCase export                                     | `proof-image.tsx` → `ProofImage`                |
| Hook          | `use-<thing>.ts` in `src/hooks/`, or `<module>.queries.ts` in a module | `use-media-query.ts`, `bookings.queries.ts`     |
| Test          | colocated `<file>.test.ts`, beside what it covers                      | `slots.ts` → `slots.test.ts`                    |
| Route handler | `route.ts` under its path segment                                      | `src/app/api/jobs/expire/route.ts`              |
| Server Action | `<module>.actions.ts`, one file per module                             | `bookings.actions.ts`                           |
| Domain module | plain noun, no suffix — this half is frozen, see architecture.md       | `slots.ts`, `dates.ts`, `status.ts`, `phone.ts` |

Roles in use in this repo: `queries` (a module's own data-reading helpers, never a data-fetching
library — see [Data fetching](#data-fetching-and-mutations)), `actions` (Server Actions), `schema`
(zod parsing of `searchParams`).

**Indonesian in UI strings, English everywhere else.** Inside one component the seam falls
between the identifier and the literal:

```tsx
// English: identifier, comment, prop name
// Indonesian: only what the admin reads
export function StatusPill({ status }: StatusPillProps) {
  // "Ditolak" covers both an admin rejection and the 1x24h cancellation path — see
  // architecture.md's status-mutations section for why reject also accepts `confirmed`.
  const label = STATUS_LABEL_ID[status];
  return <span aria-label={`Status: ${label}`}>{label}</span>;
}
```

An `aria-label` is UI copy — it is read by the admin (via a screen reader or otherwise), so it
is Indonesian. The 409 body ("Booking ini sudah diproses") and every schema-guard message are
Indonesian for the same reason: the person reading them is the admin, not a developer.

---

## Where a thing goes

| Order | Ask                                                                                                                                        | Settles                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| **1** | **Is this a file under `src/domain/`?** It is frozen and copied from web — see architecture.md                                             | `domain/` vs everything else                         |
| **2** | **Does this file exist because of a package in `package.json`?** Yes → `lib/`. No → `utils/`                                               | `src/lib/` vs `src/utils/`                           |
| **3** | **Does more than one module use it?** One consumer means it belongs to that module. Promote later, when a second consumer actually appears | `src/components/` and `src/hooks/` vs a module's own |

`src/hooks/` and `src/components/` sit **below** modules in the import graph and never import
one — a shared hook that reaches into `@/modules/bookings` is a bookings hook in the wrong
folder, and it drags whatever that module imports onto every surface using it. Both folders stay
small on purpose: growth past a handful of files means the one-consumer rule stopped being
applied, not that the folder needed subfolders.

`src/lib/` stays flat. Nesting it is the first sign it has started collecting features rather
than polishing libraries.

---

## What never goes in `src/app/`

`src/app/` holds routes, layouts, and composition. It wires modules together and owns nothing
else — no business logic, no data shaping, no reusable UI.

Three import rules, matching web's:

1. **Nothing under `src/` imports from `src/app/`.** The extraction boundary.
2. **Feature modules never import each other.** `src/modules/bookings/` and `src/modules/blocks/`
   share vocabulary through `src/domain/` only. A `bookings` → `blocks` import is how a later
   change to one module quietly reaches the other with nothing failing at review.
3. **`src/domain/` never imports from the rest of `src/`**, and imports its own siblings
   **relatively** (`./slots`, never `@/domain/slots`) so the byte-identical copy resolves the
   same in both repos — see architecture.md's cross-repo contracts.

The same corollary as web: **`src/components/` and `src/hooks/` never import a module.**

Both halves of every rule above are enforced by ESLint zones (the `@/` form) — see
[architecture.md](architecture.md#folder-structure) for the zone list.

---

## Server Component by default

`"use client"` is a decision with a stated reason in a comment, not a reflex. **v1 has exactly
one legitimate client component**: the proof-image reload button, because a 120-second presigned
URL can expire on a page left open, and recovering from that needs an `onError` handler — a
browser event with no server equivalent.

```tsx
// "use client": onError recovery for an expired 120s presigned URL. See architecture.md
// "The proof read path" — this is the one stated exception in v1.
"use client";
```

A second `"use client"` needs the same kind of comment, and it is a decision for this file to
carry forward, not a convenience to reach for mid-task. "It felt easier" is not a reason. Push
the boundary as far down the tree as it will go — one interactive control does not make its
page a client component.

---

## Every SQL statement lives in `src/server/queries.ts`

No exceptions. A statement inline in a page or a route is a statement nobody re-reads before
changing, and the ones in [architecture.md](architecture.md) are a contract, not a draft — copy
them verbatim, including the `::text` casts and the guard clauses. If a screen needs a query
that is not already in architecture.md, the query is written there first and copied here second,
never invented in `queries.ts` directly.

---

## Data fetching and mutations

Server Components read Supabase directly, through `src/server/queries.ts`. No client-side fetch of
application data, no TanStack Query, no axios, no zustand — see architecture.md's dependency
table for why each is absent.

**Filters and pagination live in the URL**, parsed with zod in the page component, never held
in component state. A module's `<module>.queries.ts` is where that parsing and the call into
`src/server/queries.ts` meet — it is not a data-fetching hook, since there is no client cache to
manage.

**Mutations are Server Actions**, in `<module>.actions.ts`, followed by `revalidatePath`. Never
a route handler called by client-side `fetch`. Every mutating action:

1. Carries its own status guard (`where status in (…)`) — never `update … where id = $1` alone.
   See CLAUDE.md hard rule 5 and architecture.md's "Status mutations" for the exact statements.
2. Returns a typed result the caller can render, not a thrown exception the caller must catch to
   find out what happened. Zero rows updated is a **409** result, not an error.
3. Calls `revalidatePath` so the re-rendered row is what the admin sees next — not a client-side
   optimistic update, since there is no client cache to keep consistent.

---

## Accessibility baseline

Every item below is checkable against code, because nothing fails to build when it is skipped.

**Labels**

- Every input has a real `<label>` associated by `htmlFor`/`id`. A placeholder is not a label.

**Errors**

- Every error message is tied to its field with `aria-describedby`, and the field carries
  `aria-invalid`. The reject-with-reason form is the one place this repo has a field-level error
  to show.
- The error text is the message itself, not a colour change alone — see the status-pill triple
  (surface + border + ink) in [DESIGN.md](DESIGN.md).

**Focus**

- Focus moves to the result after a mutation, never left on a dead button. A confirm/reject
  click that returns 409 must move focus to the "Booking ini sudah diproses" message, or a
  screen-reader user sees a page that appears to have done nothing.
- Focus rings are restyled to meet DESIGN.md's contrast bar, never removed with `outline: none`
  and nothing put back.

**Keyboard**

- The queue is operable entirely from the keyboard — filters, pagination, confirm, reject, the
  "Muat ulang bukti" reload button. A `<div>` with an `onClick` is not reachable, not announced,
  and not activated by Enter or Space; use real `<button>`/`<a>` elements throughout.

**Targets**

- Touch targets ≥ 44px. The admin is frequently on a phone at the field, not at a desk.

---

## Error handling

A failed mutation renders a visible state. A swallowed error — a caught exception that falls
back to an empty list or a blank field — is a defect, not a graceful degradation, because it
tells the admin nothing went wrong when something did.

**Postgres `42P01` (undefined_table) becomes a 503** naming the exact missing migration file,
never caught-and-return-empty. See architecture.md's "The schema guard" for the full contract
and CLAUDE.md hard rule 6 for why the guard is scoped to the one feature that needs the table,
never the root layout.

**The 409 from a status mutation is a result to render, not an error to log and hide.** It means
another tab or the expiry job already acted on the row — the current state, re-rendered, is the
correct response. See architecture.md's "Status mutations."

**Never `next/image` on a payment proof** — CLAUDE.md hard rule 2 and architecture.md's "The proof
read path" carry the full reasoning; this file only points at it.

---

## Commit conventions

Pointer only — see [CLAUDE.md](../CLAUDE.md) "Commit conventions & DX." Conventional-Commits
flavored, one commit per completed work step, no attribution trailers, never `package-lock.json`
or `.env.local`.

---

## Verification

Never claim something works without running the check and quoting the decisive line.

| Command             | Proves                                                                         |
| ------------------- | ------------------------------------------------------------------------------ |
| `pnpm lint`         | banned imports, the import-zone rules, the `@/` form of every rule above       |
| `pnpm typecheck`    | types resolve                                                                  |
| `pnpm check`        | lint, typecheck, `format:check`, `check:domain`, `check:unit` — cheapest first |
| `pnpm check:unit`   | logic gives the right answers — no credentials, ever                           |
| `pnpm check:domain` | `src/domain/` has not drifted from the web repo's copy                         |
| `pnpm check:schema` | the migration this feature needs is actually applied, live                     |
| `pnpm check:setup`  | Supabase Postgres reachable, proof URL signing round-trips                     |
| `pnpm format:check` | formatting is settled, not argued                                              |

**Every check must be proven to fail before it is trusted.** Plant a violation, watch it exit
non-zero, revert — see CLAUDE.md hard rule 9. A check that has only ever passed is a check
nobody has tested.
