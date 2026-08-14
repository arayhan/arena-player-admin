# Worktrees

Running more than one feature at a time, without two sessions writing the same tree.

**Load when:** before `git worktree add`, or before starting a second concurrent feature.

**Authority elsewhere:**

- [CLAUDE.md](../../CLAUDE.md) "Commit conventions & DX" — `claude --worktree <branch-name>` for parallel sessions
- [.claude/README.md](../../.claude/README.md) — why the sibling repo is deny-listed for writes
- [git-workflow.md](git-workflow.md) — staging, atomic commits, message shape
- [architecture.md](../architecture.md#status-mutations) and [architecture.md](../architecture.md#the-expiry-job) — what already protects concurrent writers

## The rule the rest of this file serves

**One writing session per worktree.** Two concurrent sessions in one tree shipped two defects in a single day, neither able to see the other. [PROGRESS.md](../PROGRESS.md) records a `src/domain/` re-copy that a concurrent session reverted mid-flight — the rule demonstrating itself in real time.

A second feature means a second worktree, not a second session in this one.

## Creating one

```sh
git worktree add .worktrees/<short-name> -b <type>/<short-name>
```

`.worktrees/` is gitignored, and both `.prettierignore` and `eslint.config.mjs` skip it — otherwise every worktree's copy of a file gets linted and format-checked a second time from this tree. `tsc` needs no equivalent: its wildcard include already skips dot-directories.

## `ARENA_WEB_PATH` is mandatory in a worktree

`check:domain` finds the sibling repo at `<cwd>/../arena-player-web`. From `.worktrees/<name>` that resolves to `.worktrees/arena-player-web`, which will never exist — and **a not-found sibling is a skip, not a failure**:

```
SKIPPED: could not find arena-player-web's src/domain/ — this check proved nothing.
exit=0
```

`check:unit` chains on `check:domain`, and `check` chains on that, so `pnpm check` goes green having proved nothing about the one thing that fails silently in production. Export the absolute path before running any check:

```sh
export ARENA_WEB_PATH="…/arena-player/arena-player-web"   # real shell env var
```

It must be a shell variable. Putting it in `.env.local` does nothing — `check:domain` is a plain `node` script and only vitest loads that file.

**Read the line, do not read the exit code.** `check:domain — 8 file(s) identical` is a pass. `SKIPPED` is not, and it exits 0 either way.

## What does not travel into a worktree

- **`.env.local`** — gitignored, so a fresh worktree has none. Copy it by hand. Until you do: `check:unit` and `check:domain` stay green by design, `check:schema` and `check:setup` fail loudly, and the dev server's login is dead because `SESSION_SECRET` is unset.
- **`node_modules/`** — run `pnpm install`. It hardlinks from the global store, so it is cheap. Tests cannot borrow this tree's copy; vitest resolves its `server-only` alias relative to its own config file.
- **Anything untracked** — `git worktree add` materialises tracked files only.

## Two dev servers

`pnpm dev` and `pnpm start` pin port 3001 as a CLI flag, so `PORT` does not override them. A second `pnpm dev` fails with `EADDRINUSE`. Run `pnpm exec next dev -p 3002` in the worktree instead — **never edit `package.json` to work around it**, since that change would follow the branch into a merge.

Both servers then point at **one** Supabase database and **one** Supabase Storage bucket. Guarded status mutations and the 409 contract already cover two writers on the same row, and the expiry job is idempotent by construction — but two dev servers on live booking data is a decision, not a side effect. Know you are doing it.

## Finishing

```sh
git worktree remove .worktrees/<short-name>
git worktree prune
```

Never `rm -rf` the directory — that leaves the worktree registered and git refuses to reuse the path until pruned. Remove it when the branch lands; a stale worktree is a tree someone will eventually edit by accident.
