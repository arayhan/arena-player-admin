# .claude/ — agent configuration

Five agents, one skill, the agent-only slash commands, and a permissions file. Adapted from `arena-player-web/.claude/`, not copied — the scope, the traps, and the checklist are different here.

## What is here

| Path                                 | Purpose                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `agents/project-manager.md`          | Owns `docs/PRD.md`, the scope boundary, the four gates                     |
| `agents/engineering-lead.md`         | Architecture, task breakdowns, the boundary with `arena-player-web`        |
| `agents/software-engineer.md`        | All build work                                                             |
| `agents/code-reviewer.md`            | Read-only by design. Verdict `APPROVE` / `FIX-FIRST`                       |
| `agents/uix-designer.md`             | Owns `docs/DESIGN.md` and every visual and interaction decision            |
| `skills/arena-player-admin-gotchas/` | The condensed trap list. Every agent loads it once per session             |
| `commands/`                          | Slash commands — tooling only an agent ever runs. Never `scripts/`         |
| `settings.json`                      | Permissions. Note the two deny entries writing to `../arena-player-web/**` |

The skill points at `docs/` for values and holds only rules. That is deliberate: the sibling repo lost time three separate ways to a value copied out of a source document with nothing checking the copy — it hit the skills, the agents, and the hooks.

The coding rules are **not** here. They live in [`../docs/rules/`](../docs/rules/README.md), beside the documents they point at — this folder is agent _configuration_, and a rules file is project documentation that happens to be written for an agent. They follow the same discipline as the skill: the authority for a rule stays in `docs/` and `CLAUDE.md`, and a rules file links it rather than restating it.

`commands/` exists to keep agent-only tooling out of `scripts/` and out of `package.json`. The boundary and the reason are in [`../docs/rules/tooling-placement.md`](../docs/rules/tooling-placement.md). **Keep this folder to command files only** — every `.md` under it becomes a slash command, so a README here would register as `/README`.

## Two deny rules worth explaining

`Edit(../arena-player-web/**)` and `Write(../arena-player-web/**)` are not paranoia. This repo reads the sibling repo constantly — `src/domain/` for the byte-identical copy, `package.json` for peer-dependency majors, its docs for the inherited contracts — so the path is always right there. Writing to it from an admin session would violate the other repo's own hard rule 10 (one writing session per worktree), which exists because two concurrent sessions shipped two defects in a single day.

Anything the web repo must change is written as a **gate file** in `docs/tasks/` and applied in a session held there.

## Hooks — deliberately not wired yet

The web repo runs four PowerShell hooks: a `SessionStart` gotcha injector, a `Stop` CLAUDE.md-drift nudge, and two notification hooks. None is copied here, and half-wiring them would be worse than not having them.

Two are worth adding once Phase 1a has code in it:

- **`SessionStart` → inject `arena-player-admin-gotchas`.** Turns "every agent must load this once per session" from honour-system into guaranteed. The highest-value of the four.
- **`Stop` → CLAUDE.md drift nudge.** If it is added, copy web's `stop_hook_active` guard verbatim. A `Stop` hook must exit 2 for its message to reach Claude, exit 2 blocks the turn from ending, and bailing on `stop_hook_active` is the **only** thing preventing infinite recursion.

If either is added, it must be **proven to fire** before it is trusted. Web's `Stop` hook was wired correctly and inert for weeks because nothing had ever made it fire — which is the origin of the "prove every check fails" rule that appears in every step file in this repo.
