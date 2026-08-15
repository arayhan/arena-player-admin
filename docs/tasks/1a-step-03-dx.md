# 1a · step 03 — Developer experience harness

**Depends**: 02
**Blocks**: 05, 06, 07 (their checks need a runner), and every later claim of "done"
**Agent**: `software-engineer`

## Goal

The commands that let anyone — human or agent — prove a claim instead of asserting it. Lint, typecheck, and `check:unit`.

**`check:domain`, `check:schema`, and `check:setup` are not built here.** Each belongs to the step that gives it something to assert: 05, 06, and 06 respectively. Writing them now produces scripts that can only pass vacuously, which is the exact failure mode this repo keeps warning about.

## Deliverables

- Lint and typecheck scripts, both running clean on the scaffold
- **Vitest** wired as `pnpm check:unit` → `vitest run src`. Tests are colocated `*.test.ts` beside the module they cover. The glob is `src/` and not `lib/`: after the src/ restructure there is no root `lib/`, so a `lib` target would run zero tests and pass
- **`check:unit` must never need credentials.** That is why the live checks live under a separate `scripts` glob. Vitest is used rather than plain Node scripts specifically because it resolves the `@/` alias, so tests import the way production code imports instead of bending the import style to suit the harness
- Editor config
- Optionally commit hooks, if they earn their keep

## What this repo deliberately does not build

**No `check:docs`.** The web repo's version asserts things that are true of the web repo — that no `TODO(phase2)` survives, that `TODO(content)` finds exactly six categories, that no bare "Phase 1" reference exists. Those rules encode its specific scars. Copying them here imports checks that assert nothing about this codebase, and a check that cannot fail trains people to ignore the ones that can.

**No `check:budget`, no `src/lib/motion.ts`.** One authenticated user on wifi. The KB and LCP contract has no consumer here.

If a doc check ever earns its place in this repo, the candidate is a real one: assert that no file under `docs/` other than `schema-requests/` contains a full eighteen-element list of canonical slot strings. That is this repo's actual drift surface. Do not build it speculatively — build it the first time a copy appears.

## Acceptance

```bash
pnpm lint && pnpm typecheck        # both exit 0 on the scaffold
pnpm check:unit                     # runs; passes trivially until step 05 adds real tests

# check:unit must not require credentials — the acceptance is literal, not assumed
mv .env.local .env.local.bak && pnpm check:unit ; echo "expect 0: $?" ; mv .env.local.bak .env.local

# prove the runner actually fails rather than always passing
cat > src/_probe.test.ts <<'EOF'
import { expect, test } from 'vitest'
test('planted failure', () => { expect(1).toBe(2) })
EOF
pnpm check:unit ; echo "expect non-zero: $?"
rm src/_probe.test.ts
pnpm check:unit ; echo "expect 0: $?"

# the globs are genuinely separate — scripts/ must not run under check:unit
grep -n '"check:unit"' package.json   # expect: the run target is `src`, not the repo root
```

**Not done until** `check:unit` has been observed exiting non-zero on the planted test above, and observed exiting zero with `.env.local` moved away. A check that has only ever passed is a check nobody has tested — the web repo shipped a `Stop` hook that never fired once, for exactly that reason, and that sentence appears in five step files across the two repos because it is the most expensive lesson either has learned.

handoff: `software-engineer` for step 04
