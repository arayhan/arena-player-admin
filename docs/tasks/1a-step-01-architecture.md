# 1a · step 01 — Architecture

**Depends**: nothing — this is the first file in the repo after the docs
**Blocks**: 02 (it installs what this decides), and every step after it
**Agent**: `engineering-lead`

## Goal

Confirm the route map, the server/client boundary, and the exact dependency set — then write anything this step *changes* back into [architecture.md](../architecture.md). Nothing product-shaped ships here and no package is installed.

**Most of this work is already written.** [architecture.md](../architecture.md) carries the route map, the auth split, every SQL statement, the R2 read path, and the cross-repo contracts. This step is a verification pass with one genuinely open decision in it, not a design exercise. Do not re-derive a decision that is already recorded — extend it or dispute it in writing.

## Why it is first

The dependency list here is not a preference: `src/domain/dates.ts` imports `date-fns` and `@date-fns/tz`, and `pnpm check:domain` diffs the **version range of every shared peer dependency** in both `package.json` files as well as the file bytes. Pick a different major here and the copied file passes the byte diff, then computes different dates. Getting the list wrong in step 02 means re-resolving a lockfile after code exists against it.

## The one open decision

**Tailwind v4 tokens: hand-authored `@theme` block, or generated from `docs/DESIGN.md`'s frontmatter?** The web repo hand-authors. Generating would keep the two palettes in lockstep automatically, but adds a build step and a generator to a repo whose whole stated posture is "less machinery than web".

Decide it here, write the answer into `architecture.md`, and say why. Do **not** put `docs/DESIGN.md` under `check:domain` either way — that check covers `src/domain/*.ts` only, and the reasoning is in [DESIGN.md](../DESIGN.md) itself.

## Deliverables

- **Route map confirmed** against `architecture.md` — including which routes need `export const runtime = 'nodejs'` (the login route, because argon2 cannot run on Edge) and which need `export const dynamic = 'force-dynamic'` (the booking detail page, because a cached RSC payload serves an expired presigned URL)
- **Dependency list, resolved not recalled** — every package with the version it will actually install, split into: shared-with-web (must match majors), admin-only, and dev. Cross-check the shared half against `arena-player-web/package.json` line by line
- **Server/client boundary written down** — Server Components by default; the only permitted client component in v1 is the proof-image reload button. Any second one needs a stated reason, because each is a decision the repo's "no client data-fetching" posture has to survive
- **Confirmation that nothing web-shaped leaks in** — no GSAP, no MSW, no zustand, no TanStack Query, no axios, no react-hook-form, no `src/lib/motion.ts`, no `check:budget`. Each of those is absent for a reason recorded in `architecture.md`; adding one back is a decision, not an oversight
- **The four `check:` scripts named and scoped** — `check:unit`, `check:domain`, `check:schema`, `check:setup` — with which need credentials and which must never need them

## The dependency set to verify

Shared with `arena-player-web`, majors must match:

| Package | Web has | Why this repo needs it |
|---|---|---|
| `next` | 16.3.0 | Same framework, same App Router semantics |
| `react` / `react-dom` | 19.2.8 | — |
| `typescript` | 5.9.3 | `src/domain/*.ts` is TypeScript |
| `tailwindcss` + `@tailwindcss/postcss` | 4.3.3 | Same token layer |
| `date-fns` | 4.4.0 | **Imported by `src/domain/dates.ts`** — `check:domain` asserts the range |
| `@date-fns/tz` | 1.5.0 | Same |
| `zod` | 4.4.3 | Filter/param parsing. Cheap here — no route-split budget rule in this repo |
| `vitest` | 4.1.10 | `check:unit` and `check:schema` |
| `@neondatabase/serverless` | *not yet installed in web* | Resolve at install; note the version so web matches when its Phase 4 lands |
| `@aws-sdk/client-s3` | *not yet installed in web* | Same |

Admin-only, no web equivalent: `jose`, `hash-wasm`, `@aws-sdk/s3-request-presigner`.

**Correction from the step-01 pass:** `server-only` is **not** admin-only — web carries it at `0.0.1`, so it is a shared line whose version has to match like any other. Resolved list, with the two unpinned rows and web's dependencies/devDependencies placement, is now in [architecture.md](../architecture.md#dependencies).

**Note the two "not yet installed in web" rows.** This repo will reach Neon and R2 before web does. Whatever version it resolves becomes the de-facto standard, so record it in `architecture.md` — otherwise web resolves independently later and the two clients diverge for no reason.

## Acceptance

```bash
# every route needing a runtime pin is named in the doc
grep -n "runtime = 'nodejs'"   docs/architecture.md   # expect: the login route
grep -n "force-dynamic"        docs/architecture.md   # expect: the booking detail page

# nothing web-shaped has crept into the plan
grep -inE "gsap|msw|zustand|tanstack|axios|react-hook-form|check:budget" docs/architecture.md
# expect: only lines explaining why each is ABSENT

# the shared peer-dependency majors are stated and match web
grep -n "date-fns" docs/architecture.md
node -e "const w=require('../arena-player-web/package.json');console.log(w.dependencies['date-fns'], w.dependencies['@date-fns/tz'])"
# expect: 4.4.0 1.5.0 — and the same majors written in the doc

# the token decision was actually made, not deferred
grep -n "@theme" docs/architecture.md   # expect: a decision, with its reason

# no package installed yet
test -f package.json && echo "FAIL: step 02 has already run" || echo "OK: nothing installed"
```

**Not done until** the resolved dependency list is written into `architecture.md` with the shared majors quoted from `arena-player-web/package.json` rather than recalled. A list assembled from memory is the failure this whole step exists to prevent — a byte-identical file computing different dates raises nothing anywhere.

handoff: `software-engineer` for step 02
