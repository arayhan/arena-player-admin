# Testing

How tests are run, located, and scoped here, and what an agent must do before claiming a test proves anything.

**Load when:** writing or changing a test, adding a `check:` script, or reporting that a change is verified.

**Authority elsewhere:**

- [CLAUDE.md](../../CLAUDE.md) — hard rule 7 (no MSW, no mock layer) and hard rule 9 (every check must be proven to fail) govern this file.
- [docs/dev-rules.md](../dev-rules.md#verification) — the Verification table: every `check:` command and what it proves. Read it there; it is not reproduced here.
- [docs/dev-rules.md](../dev-rules.md#naming-and-file-layout) — the Test row of the naming table.
- [vitest.config.ts](../../vitest.config.ts) — the runner config, commented in place with the reason for each setting.

## Runner and layout

1. Vitest, Node environment. There is no jsdom, no Testing Library, no browser runner — nothing in this repo renders a component inside a test.
2. Tests are colocated beside the file they cover, named after it. The only tests that are not colocated are the two credentialed scripts, which are a separate class (below).
3. Test names, `describe` blocks, and comments are English. Hard rule 10 makes Indonesian the language of UI copy only; a test name is code.
4. The config pins a fixed test timezone instead of inheriting the machine's, so a date test cannot pass merely by agreeing with the developer's clock. Never override it per test or per script.
5. Zero matched test files is a failure, not a pass. If a run reports no tests, the run target or the include glob has broken — fix that, never re-enable a pass-with-no-tests escape.
6. The config aliases `server-only` to a no-op **inside the test runtime only**, so colocated tests can import server modules. That alias never touches the build-time guarantee; do not reach for it as a way to relax an import rule.

## What gets a test

7. Every module under `src/domain/` has one. These are the frozen, cross-repo files — assert the exact shape a value must have, not just that a function returns something.
8. Server helpers with logic get one: the password compare, session sign/verify, the rate limiter, the database driver's type override, schema-definition diffing.
9. Route handlers are tested in-process — import the exported handler, build a request by hand, assert status, body, and headers. No dev server, no network, no port.
10. Server Components and presentational components do **not** get tests. Nothing under `src/components/` or any `.tsx` is covered, on purpose: a component that only composes markup is covered by lint, types, and looking at it. Adding a component test means adding a DOM environment and a rendering library this repo has deliberately avoided — do not.

## Mocking policy

11. **Never mock the thing under test.** The password test generates a real argon2id hash and runs the real verifier. The login route test calls the real handler through the real rate limiter.
12. Fake only the edges: a hand-constructed request object, `process.env` values set in the test and restored in `afterEach`, and an explicit reset of any module-scope state the tests share.
13. There is no mock layer and no MSW (hard rule 7). Live infrastructure is never stubbed — it is moved into the credentialed suite instead.
14. **Unit tests must run with no credentials and no `.env.local` present at all.** That is a contract, not a coincidence.
15. Which means: a new module under `src/server/` must import cleanly with nothing set. Read and validate an env var at first use, not at module scope — the lazy client construction in `src/server/db.ts` and `src/server/storage.ts` exists for exactly this, and an eager `process.env.X!` at the top of one of those files breaks it silently.
16. Any value a test needs must be obviously fake — a documentation-range IP, a self-describing placeholder, a hash the test generated itself. Never a real credential, even a stale one.

## The credentialed checks

17. `check:schema` and `check:setup` are a different class: they hit live Supabase Postgres and live Supabase Storage and fail without real credentials. They live outside the unit run by construction, not by an exclude someone has to remember to maintain.
18. Run them only when the task is actually about live infrastructure — verifying that a migration was applied by hand, or diagnosing a connection. They are not part of routine verification of a code change; see the Verification table.
19. Both are read-only probes. Never extend either into something that writes, inserts, or migrates.
20. `check:schema` asserts against the live database rather than a source file, which is the only way a hand-applied migration can be proven applied. Do not "speed it up" by comparing source to source; that check already exists separately.

## Prove it fails

21. A new test must be **observed failing** before the implementation makes it pass — the same discipline hard rule 9 imposes on `check:` scripts. Write the assertion, run it red, then implement. A test written after the code, never seen red, has proven nothing about the code.
22. The same applies to changing an existing test: if you weaken an assertion, break the implementation once to confirm the weakened test still catches what it claims to.
23. When reporting, quote the decisive line of the run. "Tests pass" with no output is a claim, not a verification.
