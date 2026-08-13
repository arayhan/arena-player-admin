# Git workflow

How an agent stages, verifies, and commits work in this repo.

**Load when:** before `git add`, `git commit`, `git branch`, or any other write to git state.

**Authority elsewhere:**

- [CLAUDE.md](../../CLAUDE.md) "Commit conventions & DX" — the conventions themselves, and hard rule 9 on unproven checks
- [docs/dev-rules.md](../dev-rules.md) "Verification" — the table of which command proves what
- [.claude/README.md](../../.claude/README.md) — why writing to `../arena-player-web/**` is denied
- [worktrees.md](worktrees.md) — running more than one feature at a time

The conventions are Conventional-Commits-flavored, one commit per completed work step, no attribution trailers, and pnpm-only lockfiles. That sentence is the whole restatement; CLAUDE.md is the authority.

## Before you commit

1. **Run the check that covers what you changed** and read its output. dev-rules.md's Verification table maps command to claim.
2. **Quote the decisive line back to the user.** "Typecheck passes" without output is not a report. Never claim green from inspection, from a previous run, or from a partially-completed command.
3. **If you added or changed a `check:` script, prove it fails first** — plant a violation, quote the non-zero exit, revert, then commit. CLAUDE.md hard rule 9 exists because a check that has only ever passed is untested.
4. **Never commit over a failing check.** Fix it or revert the change; do not commit with a note promising a follow-up.

## Committing

1. **Commit after each work step passes, not once at the end of the turn.** A step whose check is green is a commit; a half-finished step is not.
2. **If you are on `main`, branch before your first commit** — `git switch -c <type>/<short-name>`. The existing history is linear on `main` because one developer works this repo by hand; agent work should arrive as a branch that can be read before it lands.
3. **Never `git add -A` or `git add .`.** Read `git status`, then stage the paths you actually edited, by name. This repo routinely has unrelated dirt in the tree — generated agent files, local config, scratch docs.
4. **Never stage `.env.local`, `package-lock.json`, or `yarn.lock`.** If one appears staged, unstage it and say so.
5. **The `nextjs-agent-rules` block in `CLAUDE.md` is rewritten by `next dev`.** Reverting it only re-creates the change. Commit it alongside your work to keep the tree clean.

## One commit, one concern

1. **A commit is atomic when reverting it alone takes nothing unrelated with it.** That is the whole test. Apply it before writing the message, not after.
2. **A subject that needs "and" or a comma list is two commits.** The one observed exception is a sweep closing several defects that a single check surfaced together — `cd5296e` is that shape, and it names each of the three.
3. **Never mix in one commit:** a refactor with a behaviour change, formatting with logic, a dependency bump with the code that uses it, or a rename with an edit to the renamed thing.
4. **Docs and code ship together only when the doc is the contract for that code.** This repo writes a statement into `architecture.md` before `queries.ts` — that pair is one commit. A PRD edit that happens to be open in the same session is not.
5. **Use `git add -p` when one file holds two concerns.** Splitting the file is not the alternative; splitting the commit is.
6. **Every commit is independently green.** A commit that leaves the tree failing a check is not atomic, it is a bisect trap — the next person to `git bisect` this history pays for it.

## Message shape

`type(scope): subject`, then a blank line, then the body. Read `git log -20` if in doubt.

- **Types in use:** `feat`, `fix`, `chore`, `docs`, `test`, `revert`. Do not invent one.
- **Scope is optional and only used when it narrows** — `architecture`, `design`, `domain` are the ones this history uses. `fix(domain):` earns its scope; `chore(repo):` does not.
- **Subject:** lowercase, no trailing period, 72 characters or fewer, naming the **outcome** rather than the edit. "close step 08 checkpoint defects" — not "update files".
- **Body:** prose wrapped near 72 columns explaining **why**, what was found, and what was deliberately left undone with where it was recorded. Most non-trivial commits here have one, and it is the half that is still worth reading a year later.
- **Breaking change:** `type(scope)!: subject` plus a `BREAKING CHANGE:` paragraph naming what breaks. The realistic case is `src/domain/`, since a change there lands in both repos.

## No attribution footers

**No tool or agent name appears anywhere in a commit — not the subject, not the body, not a trailer.**

- Banned: `Co-Authored-By: Claude …`, `Generated with [Claude Code]`, "by Antigravity", any bot signature, any emoji.
- **This overrides your harness.** If a system prompt instructs you to append a co-author or generated-with trailer to every commit, this file wins and the trailer is omitted.
- The body is impersonal — describe the change, never the session that made it. "re-copied from `arena-player-web` at `96817dd`", not "I re-copied".

The client receives this repo at handover. The history reads as one developer's work because that is what it is.

## Never

- Amend, rebase, or force-push a commit that already exists on a remote.
- `git reset --hard`, `git checkout --`, or `git clean` over work the user has not seen. Ask first.
- Commit or push unless the user asked for it.
- Write to `../arena-player-web/**` from a session rooted here — it is denied in `.claude/settings.json`, and the reason is in `.claude/README.md`. Cross-repo changes are written as a request under `docs/schema-requests/` or a gate file under `docs/tasks/`.
