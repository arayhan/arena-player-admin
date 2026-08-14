---
description: Run the pre-commit check chain and report the first real failure
argument-hint: "[lint|typecheck|format|unit|domain] — optional, runs one stage instead of all"
allowed-tools: Read, Grep, Glob, Bash(pnpm *), PowerShell(pnpm *)
---

Run this repo's verification chain and report the result honestly.

**Arguments:** `$ARGUMENTS`

## What to run

With no argument, run the whole chain in one command:

```
pnpm check
```

That is `lint` → `typecheck` → `format:check` → `check:unit`, cheapest first, and it stops at the first failure. `check:unit` itself runs `check:domain` (the `src/domain/` byte-identical diff against `arena-player-web`) and then the unit tests under `src/`.

With an argument, run only that stage:

| Argument    | Command             |
| ----------- | ------------------- |
| `lint`      | `pnpm lint`         |
| `typecheck` | `pnpm typecheck`    |
| `format`    | `pnpm format:check` |
| `unit`      | `pnpm check:unit`   |
| `domain`    | `pnpm check:domain` |

**Do not run `check:schema` or `check:setup` here.** Both hit live Supabase Postgres and live Supabase Storage with real credentials. They are a separate class and the human asks for them explicitly.

## How to report

1. **Quote the decisive line, not the log.** One or two lines of real output — the assertion, the type error, the rule name and the `file:line`. Never paste the whole run.
2. **Say what stage failed and what still has not run.** A `lint` failure means `typecheck`, `format:check`, and the tests never executed; report that as unknown, not as passing.
3. **Never claim a pass you did not observe.** If the command did not complete, say so.

## After a failure

- **`format:check`** — the fix is `pnpm format`. Run it, then re-run the chain.
- **`check:domain`** — `src/domain/` has drifted from the web repo. Do **not** edit `src/domain/` here to make the diff go away; see hard rule 4 in [`../../CLAUDE.md`](../../CLAUDE.md). Report the drift and stop.
- **Anything else** — diagnose before editing. Do not loop on re-running the same failing command.

Everything else about verification, including the full table of what each check proves, lives in [`../../docs/dev-rules.md`](../../docs/dev-rules.md) under "Verification".
