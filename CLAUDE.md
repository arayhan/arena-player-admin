# Arena Player — Admin

Back-office for the mini soccer field. The field admin logs in, works the pending queue, opens the payment proof, and confirms or rejects. Same Neon database and same R2 bucket as [`arena-player-web`](../arena-player-web/); different repo, different deploy, different rules. Paid freelance project, tight budget — ship the current phase's Definition of Done, don't explore alternatives.

**The structural difference from the web repo, stated first because it changes every instinct carried over:** web built three phases of UI against an MSW mock before its backend existed. This repo is the inverse. It is useless without real data, it starts after web's Phase 4 has landed the schema, and **there is no mock layer here**. Every screen reads live Neon from a Server Component.

## Docs (read in this order)

| Doc                                            | Content                                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [docs/PRODUCT.md](docs/PRODUCT.md)             | Who the admin is, the job to be done, what must not be fabricated, open client decisions                               |
| [docs/PRD.md](docs/PRD.md)                     | Phases, screens, Definition of Done, what was descoped and why                                                         |
| [docs/architecture.md](docs/architecture.md)   | Route map, auth, every SQL contract, the R2 read path, cross-repo contracts                                            |
| [docs/database.md](docs/database.md)           | The **inherited** schema and the gotchas that arrive with it. This repo reads; it never migrates                       |
| [docs/DESIGN.md](docs/DESIGN.md)               | Token frontmatter + measured contrast. Same palette as web, none of the motion. **Normative**                          |
| [docs/DESIGN.html](docs/DESIGN.html)           | Rendered specimens + the clickable `Alur` walkthrough. Reference only — if it disagrees with DESIGN.md, that file wins |
| [docs/schema-requests/](docs/schema-requests/) | How a schema change gets from here into web's `db/migrations/`                                                         |
| [docs/rules/](docs/rules/)                     | Coding rules, one file per surface. Load the one matching what you are about to edit — index in its README             |

Source of truth for anything shared: the web repo's own docs. This repo points at them rather than restating them — a copied rule is a rule that drifts, and this project has already paid for that three times.

## When to update this file

This file is **what an agent must know before touching code and cannot discover from the code itself** — a pointer document plus hard rules, not a spec. Length is a real cost: at ~95 lines it gets read, at 300 it gets skimmed.

**Update it when:** a phase is added, removed, or renumbered · a hard rule changes · a library is swapped in or out · the folder structure changes · a cross-cutting convention every agent must follow appears · install/run commands change · the boundary with `arena-player-web` moves.

**Do NOT update it for:** task-level detail inside a phase, Definition-of-Done checkbox changes, rationale prose, or anything an agent can look up in the PRD at the moment they need it.

## Phases

| Phase | Scope                                                                                          | Status                |
| ----- | ---------------------------------------------------------------------------------------------- | --------------------- |
| 1a    | Foundation — architecture, scaffold, DX, dev rules, shared copy, db client, auth, verification | Build now             |
| 2     | Bookings console — list, filters, detail, proof view, confirm/reject                           | After 1a              |
| 3     | Expiry job — `POST /api/jobs/expire`, external cron, dashboard staleness indicator             | After 2               |
| 4     | Slot blocking — needs a migration web must own and apply first                                 | After the blocks gate |
| 5     | Deploy + handover — `admin.arena-player.com`, admin user guide, credential handover            | After 4               |

**This app is a launch dependency of the public site.** Phase 3 owns expiry: pending bookings older than 24h only become `expired` because a cron here says so. Until Phase 3 ships and its scheduler is wired, abandoned slots on the public site are never freed. Launch order is web Phase 4 → admin 1a–3 → public launch → admin 4–5.

**Repo scope:** back-office only. No public route, no unauthenticated page other than `/login`, no customer-facing copy. The booking form and availability API belong to `arena-player-web` and never appear here.

## Install & run

```bash
pnpm install
cp .env.local.example .env.local   # 7 vars — see the file's comments, especially the R2 key
pnpm dev                           # http://localhost:3001
```

Port **3001**, not 3000, so both repos run side by side during development.

Schema changes are **requested here and applied in the web repo**, by hand, in the Neon SQL editor. Never assume a migration is applied — `pnpm check:schema` is how you find out.

## Folder structure

```
arena-player-admin/
├── CLAUDE.md
├── docs/            # PRODUCT, PRD, architecture, database, DESIGN, dev-rules, PROGRESS.md,
│                    # rules/ (coding rules), tasks/, schema-requests/
├── .claude/         # agents, skills, commands/ (agent-only slash commands), settings
├── src/
│   ├── app/         # App Router — login/, bookings/, blocks/, api/jobs/expire/
│   ├── modules/     # named after SURFACES: bookings/, blocks/. Never import each other
│   ├── domain/      # BYTE-IDENTICAL copy from arena-player-web, at the SAME PATH there —
│   │                # slots, dates, status, phone. Read-only in this repo
│   ├── server/      # import "server-only" — auth.ts (jose + argon2id, Node runtime only),
│   │                # db.ts (Neon + OID override), required-schema.ts, schema-guard.ts,
│   │                # storage.ts (R2 S3Client + presigned GET)
│   ├── components/  # cross-module UI primitives only
│   ├── hooks/       # cross-module React hooks, use-<thing>.ts. Same one-consumer rule as
│   │                # components/. A module's own hooks stay there as *.queries.ts
│   ├── lib/         # polish for installed libraries, flat
│   ├── utils/       # admin-only helpers
│   └── middleware.ts # Edge — verifies the JWT and nothing else
└── scripts/         # check-domain.mjs, check-schema.test.ts
```

Full detail: [docs/architecture.md](docs/architecture.md).

## Commit conventions & DX

- Conventional-Commits-flavored: `feat:`, `fix:`, `chore:`, `docs:`, `revert:`. Commit after each work step passes, not one giant commit.
- pnpm only — never commit `package-lock.json` or `yarn.lock`. Never commit `.env.local`.
- **Start Claude sessions inside `arena-player-admin/`** — hooks and settings load from session root.
- Nothing under `src/` imports from `src/app/`, and feature modules never import each other. `src/domain/` imports its own siblings **relatively** (`./slots`) so the byte-identical copy resolves the same in both repos. Parallel sessions get their own worktree under `.worktrees/`, one writing session each — [docs/rules/worktrees.md](docs/rules/worktrees.md) carries the setup, including the `ARENA_WEB_PATH` a worktree needs before `check:domain` proves anything.
- **Tooling splits by who runs it.** `scripts/` is for what a human or CI runs and is wired into `package.json`. A helper only an agent will ever run is a slash command in `.claude/commands/` and gets no `package.json` entry — a `pnpm run` script is a public interface, and an agent-only helper has none of that contract. See [docs/rules/tooling-placement.md](docs/rules/tooling-placement.md).
- No attribution trailers on commits. Questions to the user go through `AskUserQuestion`.

## Hard rules (violations = rework)

1. **This repo never owns a migration.** `db/migrations/` lives in `arena-player-web` and nowhere else. A schema change is written as a request in `docs/schema-requests/`, transcribed verbatim into web's migrations folder, and applied by hand in the Neon SQL editor. Two repos migrating one database is a conflict with no owner to resolve it.
2. **Never `next/image` on a payment proof.** Next's optimizer caches the decoded image at a stable `/_next/image?url=…` path with a long TTL — that copies a private payment document out of a private bucket and outlives the presigned URL entirely. Plain `<img>`. This is the single worst mistake available in this repo.
3. **`DATABASE_URL` and the R2 secrets never reach the client.** Never `NEXT_PUBLIC_*`. `import "server-only"` at the top of every file in `src/server/` so the build fails instead of the review catching it.
4. **`src/domain/**` is byte-identical with the web repo and read-only here.** `uniq_active_slot` compares `time_slot` as text, so a one-character drift in `TIME_SLOTS` means this app writes rows the site cannot match and anti-double-booking silently stops working **for both**. Nothing throws. Fix drift by fixing the web repo, then re-copying.
5. **Never blind-update a booking by id.** Every status mutation carries its own `where status in (…)` guard and returns 409 on zero rows — the row may have been actioned in another tab, or flipped by the expiry job between render and click.
6. **A missing migration fails loudly and _scoped_.** The schema guard gates the one feature that needs the table; it never wraps the root layout. The bookings console needs zero new migrations and must keep working when a Phase 4 table is absent. Never `create table if not exists`.
7. **No GSAP, no `src/lib/motion.ts`, no performance budget, no MSW.** One authenticated user on wifi, on purpose. Dense, boring, fast. Importing web's motion and budget machinery creates ceremony nobody here will enforce.
8. **argon2 cannot run on the Edge runtime.** Middleware verifies the `jose` JWT only; the password comparison lives in the login route handler with `export const runtime = 'nodejs'`. Putting the hash check in middleware fails at deploy, not at author time.
9. **Every `check:` script must be proven to fail before it is trusted.** A check that has only ever passed is a check nobody has tested. The web repo shipped a `Stop` hook that never fired once, for exactly that reason.
10. **UI copy is Indonesian; code and comments are English.** Same rule as the web repo, and the admin user guide at handover is Indonesian too.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
