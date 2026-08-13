# API & route handler conventions

The operational shape of a route handler and a Server Action in this repo: when each is the right tool, what it declares, what it accepts, and what it is allowed to say back.

**Load when:** adding or changing anything under `src/app/api/`, writing a `<module>.actions.ts`, or touching `src/middleware.ts`.

**Authority elsewhere:**

- Routes, runtimes and auth per route — [architecture.md § Route map](../architecture.md#route-map)
- Mutations are Server Actions, not client-fetched handlers — [dev-rules.md § Data fetching and mutations](../dev-rules.md#data-fetching-and-mutations)
- The Edge/Node split — [CLAUDE.md](../../CLAUDE.md) hard rule 8, [architecture.md § Auth](../architecture.md#auth)
- 409 on a stale mutation — [CLAUDE.md](../../CLAUDE.md) hard rule 5, [architecture.md § Status mutations](../architecture.md#status-mutations)
- Indonesian UI copy, English code — [CLAUDE.md](../../CLAUDE.md) hard rule 10
- Swallowed errors, 42P01 → 503 — [dev-rules.md § Error handling](../dev-rules.md#error-handling)

## When a route handler is the right tool

1. **The default is a Server Action.** Mutations live in `<module>.actions.ts`, are followed by `revalidatePath`, and are never reached by a client-side `fetch`.
2. **A route handler is correct only when the caller is not a React tree this app renders.** Across every phase, that is three callers and no more:
   - `POST /api/auth/login` — a plain `<form>` posting before a session exists, and the only place a password is compared.
   - `POST /api/auth/logout` — a plain `<form>` post that clears the cookie and redirects.
   - `POST /api/jobs/expire` (Phase 3) — an external scheduler holding a bearer token, plus the dashboard's manual button.
3. **A fourth route handler is a decision, not a detail.** It belongs in architecture.md's route map before it exists in `src/app/api/`. A new screen, filter, or status change is a Server Component read or a Server Action.

## Runtime declaration

- `export const runtime = "nodejs"` is required in any handler that calls `verifyPassword()`. Gist of hard rule 8: argon2 cannot run on Edge, and getting it wrong fails at deploy rather than at author time.
- Route handlers already default to Node, so the pin is redundant as configuration and load-bearing as a tripwire. In `src/app/api/auth/login/route.ts` it sits above the imports with a comment saying so — keep that placement, and keep the comment.
- **Do not pin `runtime` on a handler that does not need it.** An unexplained pin is one the next agent copies to a handler where it means something different.
- `src/middleware.ts` is Edge and cannot be pinned otherwise. Nothing it imports may reach `src/server/auth/password.ts`.

## Request validation

- Parse at the boundary with zod, once, and let the parsed type flow inward. The handler owns `NextRequest`; nothing downstream re-reads the request.
- Page `searchParams` are parsed in the page component through a `<module>.schema.ts`, not inside the query helper.
- **Reading a body must not become a 500.** The login route uses `await request.formData().catch(() => null)` and treats a malformed body as an empty credential, so a garbage POST takes the same path as a wrong password.
- A value that reaches SQL as an _identifier_ — a sort key, a sort direction — is never merely validated. It is looked up in a literal allow-list; see architecture.md's bookings-list section for the constructed form.

## Response shape

1. **Negotiate on `Accept` where both callers are real.** The login route returns a `303` redirect to `/login?error=…` for a browser navigation and JSON for anything that did not ask for HTML. Same rate limit, same password check, same cookie — only the shape differs.
2. **Status codes in use:** `303` after a successful form post, `401` for an invalid credential, `409` for a mutation that matched zero rows, `429` for rate limiting, `503` for a missing migration. Handlers do not invent others.
3. **Error bodies are a stable machine key**, not a sentence — `{ "error": "invalid_credentials" }`, `{ "error": "migration_missing", "migration": "…" }`. English and snake_case, because a program reads them. Indonesian strings are UI copy and belong to the rendered page (hard rule 10).
4. **Never in a response body:** an exception message, a stack, SQL text, a Postgres error code, a column or env-var name, or _which_ precondition failed. The login route answers `invalid_credentials` for a wrong password and for an unset `ADMIN_PASSWORD_HASH` deliberately.
5. **Timing is part of the response where auth is involved.** The login route always awaits the argon2 verify, against a fallback hash if it has to, so a misconfigured server and a wrong password are indistinguishable.

## The 409 contract, as a response concern

- Every status mutation guards itself and 409s on zero rows — hard rule 5.
- The 409 body is `"Booking ini sudah diproses"` and the current, re-rendered state; the exact statements are in [architecture.md § Status mutations](../architecture.md#status-mutations). Do not restate the SQL anywhere but `src/server/queries.ts`.
- A 409 is a result to render, never an error to log and hide. Move focus to the message — dev-rules.md's accessibility baseline.

## Auth per surface

- `src/middleware.ts` verifies the `admin_session` JWT and does nothing else. A missing cookie and a forged one take the identical path.
- Its matcher deliberately excludes `/login`, `POST /api/auth/login` (excluding either would loop), static assets, and `POST /api/jobs/expire`.
- **A handler outside the matcher gets no ambient protection and re-checks auth itself.** `POST /api/jobs/expire` accepts bearer _or_ session inside the handler for exactly this reason; the scheduler would otherwise collect a redirect to `/login`.
- Middleware also stamps `Cache-Control: private, no-store` on every response it produces. A route outside the matcher sets that header itself.
- A valid session proves the caller is the admin. It proves nothing about row state or table presence — those are re-checked in the query, every time.
