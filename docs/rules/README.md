# docs/rules/ — coding rules

One file per surface. Load the one matching what you are about to edit; you are not expected to read them all.

| File                                         | Load when                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [code-style.md](code-style.md)               | Writing or editing any `.ts` / `.tsx` under `src/` or `scripts/`                                       |
| [ui-and-design.md](ui-and-design.md)         | Writing `.tsx` that renders markup, or any rule in `src/app/globals.css`                               |
| [api-conventions.md](api-conventions.md)     | Anything under `src/app/api/`, a `<module>.actions.ts`, or `src/middleware.ts`                         |
| [sql-and-data.md](sql-and-data.md)           | A query, a screen that reads Neon, or `required-schema.ts` / `schema-guard.ts` / `schema-diff.ts`      |
| [security.md](security.md)                   | Anything under `src/server/`, the login route, middleware, the proof view, or a file naming an env var |
| [testing.md](testing.md)                     | Writing a test, adding a `check:` script, or reporting that a change is verified                       |
| [git-workflow.md](git-workflow.md)           | Before `git add`, `git commit`, `git branch`, or any other write to git state                          |
| [worktrees.md](worktrees.md)                 | Before `git worktree add`, or before starting a second concurrent feature                              |
| [tooling-placement.md](tooling-placement.md) | Adding any script, check, or helper that is not application code — `scripts/` vs `.claude/commands/`   |

## The one rule these files follow

**A rules file never restates a rule that lives elsewhere.** Where the authority is another document it is linked, never copied — and a concrete value (a colour, a TTL, a SQL fragment, a route table, a contrast ratio) is never copied at all.

This is not tidiness. The sibling repo lost a day to a single value that had moved, held stale in three places at once — the skills, the agents, and the hooks. `docs/` and `CLAUDE.md` already carry that risk; a seventh copy of the same rule in here would be the fourth stale one waiting to happen.

So each file holds two things and nothing else:

1. A short **Authority elsewhere** list — links out, one line of gist each.
2. The rules that are **genuinely not written down anywhere yet**: the honour-system conventions, the observed-in-the-code style, and the agent-behaviour rules that no document owns.

Where these files and `docs/` disagree, `docs/` wins and the rules file gets corrected. Where a rules file and the code disagree, read the file the code lives in — several rules here are explicitly "not settled, follow the file you are editing."

## Adding or changing a rule

1. **Check the authority first.** If the rule belongs in `docs/dev-rules.md`, `docs/architecture.md`, `docs/DESIGN.md`, or a `CLAUDE.md` hard rule, put it there and link it from here.
2. **Ground it.** A rule asserted from habit rather than observed in this repo's code is how a convention nobody follows gets enforced in review. If you cannot point at the file it came from, drop it.
3. **Keep each file under ~90 lines.** At that length it gets read. At 300 it gets skimmed, which is the same as not having it.
4. **Update the table above** when a file is added or its trigger changes.
