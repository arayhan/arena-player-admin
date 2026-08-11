# 1a · step 05 — Shared copy and `check:domain`

**Depends**: 02, 03
**Blocks**: 06 (the schema check asserts against `TIME_SLOTS`), and every query that touches a slot or a date
**Agent**: `software-engineer`

## Goal

`src/domain/{slots,dates,status,phone}.ts` — byte-identical copies from `arena-player-web` — and `pnpm check:domain`, which proves they still are.

**There is now something to copy.** This step was written expecting nothing to be there — web's Phase 1a step 06 was unstarted, so the real deliverable was the skip-loudly behaviour and the copy would land later. Step 06 has since shipped: `slots.ts`, `dates.ts`, `status.ts`, `phone.ts` **and their four test files**, all inside the byte diff. Copy all eight, and install `vitest` alongside `date-fns` and `@date-fns/tz`.

Keep the skip-loudly behaviour regardless — it is what runs whenever a side is absent or `ARENA_ADMIN_PATH` points somewhere wrong.

## Why byte-identical, and why nothing catches this by itself

`uniq_active_slot` compares `time_slot` as **text**. `'06.00 - 08.00'` and `'06.00-08.00'` are two different slots as far as the index is concerned. A one-character drift between the repos means this app writes rows the public site cannot match, and **anti-double-booking silently stops working for both**. Nothing throws. No test fails. The first symptom is two teams arriving at the same field.

The copy also carries its dependencies. `dates.ts` imports `date-fns` and `@date-fns/tz`, and v3 and v4 differ in exactly the timezone API it relies on — so two repos on different majors produce a **byte-identical file computing different dates**, which a naive byte diff would happily approve.

That is why `check:domain` diffs two things, not one.

## Deliverables

- `src/domain/slots.ts`, `dates.ts`, `status.ts`, `phone.ts` — copied verbatim from `../arena-player-web/src/domain/`, with their colocated `*.test.ts` files, **when they exist there**
- **`scripts/check-domain.mjs`**, wired as `pnpm check:domain` and run as part of `check:unit`, which:
  1. Compares every file under `src/domain/` byte-for-byte against `../arena-player-web/src/domain/`
  2. Compares the version **range string** of each shared peer dependency (`date-fns`, `@date-fns/tz`, and anything else `src/domain/` imports) in both `package.json` files
  3. Fails on any difference in either, printing the offending file or package and both values
  4. Fails if a file exists in one repo's `src/domain/` and not the other's — an added file is drift too
- A one-line note in `src/domain/README.md`: **this directory is read-only in this repo.** Drift is repaired by fixing the web repo and re-copying, never by editing here

## The skip-loudly requirement

When `../arena-player-web/src/domain/` does not exist, `check:domain` must print something impossible to miss and exit **0**:

```
SKIPPED: arena-player-web has not built src/domain/ yet — this check proved nothing.
         Re-run after web's Phase 1a step 06 lands. Until then, TIME_SLOTS here is unverified.
```

Exit 0, because failing would block a repo that has done nothing wrong. Loud, because a silent skip is indistinguishable from a pass, and this is the one check in the project where a false pass is expensive. Web's own `1a-step-06-primitives.md:58` carries the mirror-image instruction, written before this repo existed.

**A skip is not a pass, and the output must make that unmistakable.** If the message can be mistaken for success at a glance in CI output, it is not loud enough.

## Acceptance

```bash
# --- while web's src/domain/ does not exist ---
pnpm check:domain ; echo "expect 0: $?"
pnpm check:domain 2>&1 | grep -qi "SKIPPED" && echo "OK: skip is visible"
pnpm check:domain 2>&1 | grep -qi "proved nothing" && echo "OK: skip is honest"

# --- once web has built it: copy, then prove the check fails ---
cp ../arena-player-web/src/domain/*.ts src/domain/
pnpm check:domain ; echo "expect 0: $?"

# 1. plant a one-character drift in the file bytes
sed -i 's/06\.00 - 08\.00/06.00 -08.00/' src/domain/slots.ts
pnpm check:domain ; echo "expect non-zero: $?"
cp ../arena-player-web/src/domain/slots.ts src/domain/slots.ts

# 2. plant a peer-dependency drift — the half a byte diff cannot see
node -e "const f='package.json',p=require('./'+f);p.dependencies['date-fns']='^3.6.0';require('fs').writeFileSync(f,JSON.stringify(p,null,2))"
pnpm check:domain ; echo "expect non-zero: $?"
git checkout package.json

# 3. plant an extra file — an addition is drift too
echo "export const x = 1" > src/domain/_probe.ts
pnpm check:domain ; echo "expect non-zero: $?"
rm src/domain/_probe.ts

pnpm check:domain ; echo "expect 0: $?"

# check:domain runs as part of check:unit, so nobody has to remember it
grep -n '"check:unit"' package.json   # expect: it invokes check:domain
```

**Not done until** `check:domain` has been seen failing on **all three** planted violations — the byte drift, the peer-dependency drift, and the extra file. The second one is the whole reason this check is not just `diff -r`: a byte-identical `dates.ts` on `date-fns` v3 computes different dates than the same file on v4, and every naive version of this check misses it.

If web's `src/domain/` still does not exist, the first block above is the completion condition, and **this step is re-opened the day web lands it**. Note that in `docs/PROGRESS.md` so it is not lost.

handoff: `software-engineer` for step 06
