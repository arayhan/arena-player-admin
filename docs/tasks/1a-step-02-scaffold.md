# 1a · step 02 — Scaffold

**Depends**: 01 (installs what it resolved)
**Blocks**: 03, 04, 05, 06, 07, 08 — everything downstream needs a repo that runs
**Agent**: `software-engineer`

## Goal

Next 16 App Router + TypeScript + Tailwind v4, installed with pnpm, serving at `localhost:3001`. Nothing product-shaped ships here — no page beyond what the scaffold generates, no auth, no database client.

## Port 3001, not 3000

Both repos get developed in the same session, side by side, and the web repo owns 3000. A collision here shows up as "the admin app is serving the public site", which is confusing for exactly as long as it takes to notice the wrong page. Pin it in the `dev` script rather than relying on Next's auto-increment, which picks a different port depending on what else is running.

## Two things to get right

**Every shared package installs at the version step 01 resolved, not at `latest`.** `pnpm add date-fns` today may resolve a different major than `arena-player-web/package.json` pins, and the failure that produces is a byte-identical `src/domain/dates.ts` computing different dates in the two apps, with `check:domain` passing. Install explicitly; verify against web's `package.json` afterwards.

**The web repo learned five install-time traps the hard way** (`arena-player-web/docs/PROGRESS.md`, step 02 entry). Three apply here directly: `pnpm view <pkg> version` returns the `latest` **dist-tag**, which is not always the highest version and not always the supported one — TypeScript's `latest` is a major `create-next-app` does not pin; pnpm's `minimumReleaseAge` policy silently rejects very recently published versions, and editing `package.json` is not enough because the lockfile keeps the old resolution until it is cleared; and App Router treats a leading underscore as a private folder, so `src/app/_anything/` is excluded from routing entirely and any probe placed there measures nothing while appearing to succeed.

## Deliverables

- `pnpm create next-app` — App Router, TypeScript, Tailwind, **with** a `src/` directory (matching web's layout so the two repos read the same)
- Every package from step 01's resolved list, installed at that exact version. `packageManager` pinned to the resolved pnpm version
- **`server-only` installed.** Not decorative: importing it at the top of every file in `src/server/` later makes the **build fail** if a client component reaches a secret, which is how hard rule 3 stops being honour-system
- `dev` script pinned to port 3001
- Folder skeleton matching the tree in [architecture.md](../architecture.md) — `src/{app,modules,domain,server,components,lib,utils}/`, `src/server/auth/`, and `scripts/`
- `.env.local` created from `.env.local.example` and confirmed gitignored
- `pnpm-workspace.yaml` **only if pnpm demands one** for build-approval flags, as web's does. This is not a monorepo and must not acquire a `packages:` key

## Acceptance

```bash
pnpm install                       # completes clean
pnpm dev                           # serves http://localhost:3001
curl -sI localhost:3001 | head -1  # expect: HTTP/1.1 200

# the port is pinned, not incidental
grep -n '"dev"' package.json       # expect: the port 3001 flag present

# shared majors match the web repo exactly — this is the one that matters
node -e "
const a=require('./package.json'), w=require('../arena-player-web/package.json');
const all=o=>({...o.dependencies,...o.devDependencies});
const A=all(a), W=all(w);
for (const k of ['next','react','react-dom','typescript','tailwindcss','date-fns','@date-fns/tz','zod','vitest'])
  console.log(k.padEnd(22), (A[k]||'-').padEnd(12), W[k]||'-');
"
# expect: every row's two columns identical, or an explicit written reason in architecture.md

# no extras crept in
node -e "const d=require('./package.json');console.log(Object.keys({...d.dependencies,...d.devDependencies}).sort().join('\n'))"
# cross-check against step 01's list; expect NO gsap, msw, zustand, @tanstack/*, axios, react-hook-form

# server-only is present, because hard rule 3 depends on it
node -e "require.resolve('server-only')" && echo "server-only OK"

# secrets cannot be committed
git check-ignore -v .env.local     # expect: matched by .gitignore
grep -c "packageManager" package.json   # expect: 1

# this is not a monorepo
test -f pnpm-workspace.yaml && grep -c "packages:" pnpm-workspace.yaml || echo "no workspace file — fine"
# expect: 0 matches for packages:, or no file at all
```

**Not done until** `pnpm dev` serves a page on 3001 **and** the shared-majors comparison above has been run and its output read. Installing at `latest` and discovering the mismatch in step 05 means re-resolving a lockfile with code already written against it.

## First look at the bundle, and why there is no budget

The web repo carries a measured KB budget and a `check:budget` script because its landing page loads on a mid-range Android inside an in-app browser. **This repo has neither, deliberately** — one authenticated user, on wifi, who came to do a task.

Run `pnpm build` once anyway and note the number. Not to enforce anything, but because a first-load figure wildly above web's `/` would mean something unintended got installed, and that is worth catching now rather than at deploy.

```bash
pnpm build   # note the output size; no threshold, no gate
```

handoff: `software-engineer` for step 03
