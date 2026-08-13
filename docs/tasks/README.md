# docs/tasks/

Work orders, one file per unit of work. Two kinds live here and they are not interchangeable:
a **step** is something an agent does, a **gate** is something a human decides.

Format inherited verbatim from [`arena-player-web/docs/tasks/README.md`](../../../arena-player-web/docs/tasks/README.md). Read a step file there for a worked example — `1a-step-02-scaffold.md` is the best one.

## Naming

`<phase>-<kind>-<slug>.md`

```
1a-step-01-architecture.md
1a-step-02-scaffold.md
…
3-gate-web-expiry.md
4-gate-blocks.md
```

The folder sorts into build order on its own, so no index needs maintaining, and the filename says who acts before anyone opens it.

**Step files land when their phase's build actually starts**, not during planning. Gates land as soon as the questions exist, because a gate whose questions are written late is a gate that gets held late — and here, three of the four gates are blocked on people outside the build (the client, the host, the other repo), which is the longest lead item in this project.

That is why this folder held eight Phase 1a steps and four gates for as long as Phase 1a was the current build, and no step file for Phases 2–5. **Phase 2's six steps and two gates landed on 2026-08-13**, when its build started. Phases 3–5 are still specified only in [PRD.md](../PRD.md); their steps get written when their build starts.

## Steps

State a goal, a concrete deliverables list, and **acceptance criteria written as runnable checks** — grep patterns, commands, assertions — not vague prose. Include `**Depends**:` / `**Blocks**:` lines and end with a `handoff:` line naming the next agent.

Every step also carries a **`Not done until`** line: one hard completion condition, separate from the checklist, with the reason it exists. A checklist can be ticked by someone who did the motions; that line is what they cannot fake.

Before writing a step file, **check whether its work is already done**. In this repo the specific hazard is the opposite of the web repo's: work that _looks_ done because it is documented. The API contract, the SQL, and the auth design are all written in [architecture.md](../architecture.md) — none of it is code.

## Gates

A gate names **who decides**, **what it unblocks**, the questions that must not be left unasked, and a sign-off block with room for the outcome. It carries a `**Blocks**:` line like a step.

It deliberately does **not** carry runnable acceptance criteria or a `handoff:` agent line. Its acceptance criterion is a human signature and no agent picks it up; forcing it into the step shape would mean writing checks that cannot be run.

Fill a gate in **during or immediately after** the decision, not from memory afterwards. The outcome is the durable half — a gate with blank answers is a decision that has not happened yet, whatever anyone remembers agreeing.

### Gates in this repo are unusually load-bearing

In the web repo a gate is mostly a client conversation. Here, three of the four gate a **silent failure** rather than a preference:

- `3-gate-web-expiry` — until it is applied, two repos hold contradictory descriptions of where expiry runs, and a future agent will build against whichever it reads first.
- `4-gate-blocks` — shipping the block UI before web reads `slot_blocks` produces a feature that appears to work and does nothing.
- `5-gate-cron-owner` — a scheduler nobody owns is a scheduler that stops firing and is noticed by a customer.

None of those errors throws. That is why each is a signature and not a checklist item inside a step.

## The one rule both kinds share

**A check must be proven to fail before it is trusted.** Plant a violation, watch the exit code, revert. Repeated in nearly every step file here on purpose: the web repo shipped a `Stop` hook that never fired once, and a check that has only ever passed is a check nobody has tested.
