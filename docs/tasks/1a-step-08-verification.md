# 1a · step 08 — Verification

**Depends**: 01–07
**Blocks**: Phase 2, and the Phase 1a Definition of Done in [PRD.md](../PRD.md)
**Agent**: `code-reviewer`, then `software-engineer` for anything it finds

## Goal

Close Phase 1a by proving the foundation actually holds. Not "run the checks" — **run each check against a planted violation and watch it fail**, then revert.

Nothing new is built here. If this step finds work, it goes back to the step that owns it.

## Why this step exists at all

A check that has only ever passed is a check nobody has tested. The web repo shipped a `Stop` hook that never fired once — it looked correct, it was wired correctly, and it was inert for weeks because nothing had ever made it fire.

Four checks land in Phase 1a, and **three of them guard failures that raise nothing**: a slot-string drift that silently disables anti-double-booking, a peer-dependency drift that produces byte-identical code computing different dates, and a schema that no longer matches the source. Those are exactly the checks most likely to be quietly broken, because nothing else in the system would notice.

## Deliverables

- Every check in the matrix below **observed exiting non-zero** on its planted violation, then observed exiting zero after revert
- A short verification record appended to `docs/PROGRESS.md`: which violations were planted, which checks caught them, and anything that did not fail when it should have
- Any check that could not be made to fail is a **defect in the check**, filed back to its owning step — not waived

## The matrix

| Check | Planted violation | Owning step |
|---|---|---|
| `check:unit` | A failing assertion in a colocated test | 03 |
| `check:unit` (no credentials) | `.env.local` moved away — must still exit 0 | 03 |
| `check:domain` | One character changed in `src/domain/slots.ts` | 05 |
| `check:domain` | `date-fns` range changed to a different major in `package.json` | 05 |
| `check:domain` | An extra file added under `src/domain/` | 05 |
| `check:domain` (skip) | Web's `src/domain/` absent — must exit 0 **and say it proved nothing** | 05 |
| `check:schema` | No `bookings` table in the target database | 06 |
| `check:schema` | A slot string in `src/domain/slots.ts` drifted from the CHECK constraint | 06 |
| `check:setup` | Wrong R2 credential | 06 |
| middleware | A forged session token | 07 |
| middleware bundle | argon2 reachable from the Edge bundle | 07 |

## Acceptance

```bash
# 1. everything green from a clean tree
pnpm install && pnpm lint && pnpm typecheck && pnpm check:unit
pnpm check:domain ; echo "shared: $?"     # 0, or a LOUD skip
pnpm check:schema ; echo "schema: $?"     # 0 once web's migration is applied

# 2. the credential boundary is real, not assumed
mv .env.local .env.local.bak
pnpm check:unit    ; echo "expect 0: $?"
pnpm check:schema ; echo "expect non-zero — it needs credentials: $?"
mv .env.local.bak .env.local

# 3. the secret boundary — nothing server-only reaches the client bundle
pnpm build
grep -rlE "DATABASE_URL|R2_SECRET_ACCESS_KEY|ADMIN_PASSWORD_HASH|SESSION_SECRET" .next/static/
# expect: no match. `server-only` should make this impossible; confirm rather than trust

# 4. no NEXT_PUBLIC_ leak of anything sensitive
grep -rn "NEXT_PUBLIC_" src/ 2>/dev/null
# expect: no match at all — this repo has no legitimate public env var

# 5. the repo is what it claims to be
grep -rniE "\bgsap\b|\bmsw\b|zustand|@tanstack|\baxios\b|react-hook-form" package.json
# expect: no match

test -d db/migrations && echo "FAIL: this repo must not own migrations" || echo "OK: no migrations here"
grep -rniE "create table|alter table|drop table" src/ scripts/
# expect: no match outside a comment

# 6. the planted-violation matrix — each block from its owning step, run and observed
#    (see steps 03, 05, 06, 07 for the exact commands)
```

**Not done until** every row in the matrix has been observed failing, and the record of which violations were planted is written into `docs/PROGRESS.md`. "The checks pass" is not the completion condition and never has been — a repo where all four checks are inert passes that sentence perfectly.

## What this step does not close

Two Phase 1a items may legitimately remain open, and both belong in the PROGRESS entry rather than being quietly ticked:

- **`check:domain` may still be skipping**, if web's `src/domain/` has not landed. Phase 1a can close with a loud skip; **Phase 2 cannot**, because by then this app is writing slot strings into a shared table.
- **`check:schema` may still be failing correctly**, if web's Phase 4 migration has not been applied. That is a blocker on Phase 2, not on Phase 1a — this repo's foundation is done when it can *detect* the missing schema, not when the schema exists.

handoff: `project-manager` — Phase 1a Definition of Done in [PRD.md](../PRD.md)
