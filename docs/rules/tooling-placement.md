# Tooling placement

Where a new script, check, or helper goes: `scripts/` or `.claude/commands/`.

**Load when:** adding any script, check, or helper that is not application code.

**Authority elsewhere:**

- [CLAUDE.md](../../CLAUDE.md) "Commit conventions & DX" — the one-line version of this rule
- [docs/dev-rules.md](../dev-rules.md#verification) — the Verification table, which is the contract the `scripts/` half serves

**`.claude/commands/` holds command files and nothing else** — Claude Code turns every `.md` under it into a slash command, so a README dropped there registers as `/README` in the menu. Documentation about commands lives here in `docs/rules/`; the folder itself stays clean.

## The boundary

Tooling in this project splits two ways, and the split is by **who runs it**, not by what it does.

| Goes in             | When                                                                                 | Examples                                                                               |
| ------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `scripts/` (repo)   | A human or CI runs it. It is wired into `package.json` and survives without an agent | `check-domain.mjs`, `check-schema.test.ts`, `check-setup.test.ts`, `hash-password.mjs` |
| `.claude/commands/` | Only an agent in a Claude Code session ever runs it                                  | `/check`                                                                               |

**A helper that exists to drive an agent does not belong in `scripts/`, and does not get a `package.json` entry.** A `pnpm run` script is a public interface: it implies a human can type it, that it works without a session, and that removing it is a breaking change. An agent-only helper has none of those properties, and putting it there means the repo carries a script nobody outside a session ever calls.

The four files in `scripts/` stay where they are. Three are wired into `pnpm check` and belong to CI, and `hash-password.mjs` is an operator tool you run by hand at setup.

## Writing a command

A command file is a prompt, not a program. Optional YAML frontmatter, then the instructions the agent receives.

```markdown
---
description: One line — this is what shows in the /-menu
argument-hint: [optional] what arguments look like
allowed-tools: Read, Grep, Bash(pnpm *)
---

The prompt. `$ARGUMENTS` interpolates what the user typed after the command name.
```

Rules for this repo:

1. **Narrow `allowed-tools`.** A command that only reads and runs checks does not need `Write`. The repo-wide `deny` list in [`.claude/settings.json`](../../.claude/settings.json) still applies on top and cannot be widened from a command file.
2. **Never inline a credential, a connection string, or a live value.** Commands are committed.
3. **Do not restate a rule that lives in [this folder](README.md) or `docs/`.** Link it. A copied rule is a rule that drifts — the same reason the rest of this repo points instead of copying.
4. **A command that mutates anything says so in its `description`.** The `/`-menu line is the only warning the human gets before it runs.
5. **Prove it.** Run a new command once before committing it, and note in the commit what it printed.
