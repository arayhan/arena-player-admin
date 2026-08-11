# 1a · step 04 — Development rules

**Depends**: 02, 03
**Blocks**: 05, 06, 07 — the conventions they are written against
**Agent**: `engineering-lead`

## Goal

`docs/dev-rules.md` — the conventions every agent follows, at the level of detail that would bloat [CLAUDE.md](../../CLAUDE.md) and get skimmed.

## Why it is separate from CLAUDE.md

CLAUDE.md is a pointer document plus hard rules, and it states its own length budget: at ~95 lines it gets read, at 300 it gets skimmed, and a CLAUDE.md nobody reads is worse than a short one. Every rule that is _specific_ rather than _load-bearing_ belongs here instead — read at the moment it is needed, not on every session.

The test for which file a rule goes in: **does violating it cause rework, or just inconsistency?** Rework rules go in CLAUDE.md. Everything else goes here.

## Deliverables

`docs/dev-rules.md`, covering:

- **Naming and file layout** — component files, route files, query functions, test colocation. Match the web repo's conventions rather than inventing parallel ones; one developer moves between the repos
- **What never goes in `src/app/`** — business logic, data shaping, reusable UI. `src/app/` holds routes, layouts and composition. Nothing under `src/` imports from `src/app/`, and feature modules never import each other
- **Server Component by default.** A `"use client"` needs a stated reason in a comment. In v1 there is exactly one legitimate client component (the proof-image reload button); a second is a decision, not a convenience
- **Every SQL statement lives in `src/server/queries.ts`**, never inline in a page or route. Two reasons: the statements in [architecture.md](../architecture.md) are a contract, and a query written inline is a query nobody re-reads before changing
- **Data fetching** — Server Components read Neon directly. No client-side fetch of application data, no data-fetching library. Filters and pagination live in the URL, parsed with zod, never in component state
- **Mutations** are Server Actions followed by `revalidatePath`, and every one of them carries a status guard. Never `update … where id = $1` alone
- **Accessibility baseline** — every input has an associated label; errors tie to their field via `aria-describedby`; focus moves to the result after a mutation rather than staying on a dead button; focus rings restyled, never removed; the queue is operable entirely from the keyboard, because that is how the admin will actually work it
- **Indonesian UI copy, English code and comments.** Error strings the admin reads are Indonesian — including the 409 "Booking ini sudah diproses" and the migration-missing message
- **Error handling** — a failed mutation renders a visible state; a swallowed error is a defect. Postgres `42P01` becomes a 503 naming a migration, never a caught-and-return-empty
- **Commit conventions** pointer to CLAUDE.md rather than a copy

## What not to write in it

Do not restate the hard rules from CLAUDE.md, the SQL from architecture.md, or the gotchas from database.md. Three documents saying the same thing is three documents that drift, and the web repo lost a day to exactly that — a value copied out of a source doc with nothing checking the copy, three separate times, in the skills, the agents, and the hooks.

Where a rule here depends on one of those, **link to it**.

## Acceptance

```bash
test -f docs/dev-rules.md && echo "exists"

# it covers the six areas that would otherwise be invented per-file
for t in "use client" "queries.ts" "aria-describedby" "revalidatePath" "Indonesian" "never imports from"; do
  grep -qi "$t" docs/dev-rules.md && echo "OK  $t" || echo "MISSING  $t"
done
# expect: six OK lines

# it does not duplicate the hard rules — a copy is a drift surface
grep -c "next/image" docs/dev-rules.md      # expect: 0 or 1 (a link, not a restatement)
grep -c "^select\|^update\|^insert" docs/dev-rules.md   # expect: 0 — SQL lives in architecture.md

# CLAUDE.md stayed inside its budget
wc -l CLAUDE.md   # expect: under 130
```

**Not done until** someone can point at a rule in `dev-rules.md` and a rule in `CLAUDE.md` and say why each is where it is. If that distinction cannot be articulated, the split has not been made — the content has just been moved.

handoff: `software-engineer` for step 05
