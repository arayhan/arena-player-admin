# 1a · step 07 — Auth

**Depends**: 02, 03
**Blocks**: Phase 2 — every screen except `/login` sits behind it
**Agent**: `software-engineer`

## Goal

One account, one password, one session. `/login`, a rate-limited login route, a `jose` session cookie, and Edge middleware that guards everything else.

No user table, no session table, no password reset, no vendor. All four of those would mean a schema change to a database this repo may not migrate, for an app with exactly one user whose credential rotation is a redeploy.

## The trap: argon2 cannot run on the Edge runtime

Next middleware runs on Edge. `jose` works there — it uses Web Crypto. argon2 does not, whether via WASM instantiation or native bindings.

So the split is not stylistic:

- **`middleware.ts` (Edge)** verifies the JWT signature and expiry, redirects to `/login` on failure, and never sees a password.
- **`src/app/api/auth/login/route.ts`** carries `export const runtime = 'nodejs'` and is the only place `verifyPassword()` is called.

Getting this backwards builds clean, runs clean under `pnpm dev`, and fails on Sumopod. The acceptance below greps the built middleware bundle rather than trusting the source, because the import can arrive transitively through a barrel file.

## `hash-wasm`, not `@node-rs/argon2`

argon2id either way. `hash-wasm` is pure WASM with no build step; `@node-rs/argon2` is faster and ships native bindings that must compile or find a prebuilt for the host. **Sumopod's build environment is unverified** — only Node capability was confirmed — and a native-binding failure surfaces at deploy, on a login that happens twice a day and does not need the speed.

## Deliverables

- **`src/server/auth/password.ts`** — `verifyPassword(plain, hash)` over `hash-wasm` argon2id, reading `ADMIN_PASSWORD_HASH`. Node runtime only, and it says so in a comment
- **A hash-generation script**, documented in [architecture.md](../architecture.md), that prints an encoded `$argon2id$…` string. **It must never write the plaintext anywhere** — not to a file, not to a log, not to a comment
- **`src/server/auth/session.ts`** — `jose` HS256 sign and verify over `SESSION_SECRET`. Payload is `{ sub: 'admin', iat, exp }` and nothing else
- **`src/app/api/auth/login/route.ts`** — `export const runtime = 'nodejs'`, in-memory per-IP rate limit (5 attempts / 15 min → 429), constant response shape and timing for wrong-password vs unknown-state so the endpoint reveals nothing
- **`src/app/api/auth/logout/route.ts`** — clears the cookie
- **`src/app/login/page.tsx`** — Indonesian copy, a labelled password field, an error region tied via `aria-describedby`, focus moving to the error on failure
- **`middleware.ts`** — Edge, verifies the JWT, redirects to `/login`, and **excludes `/login` and `/api/auth/login` from the matcher** or the redirect loops
- Cookie: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`

## Two decisions to write down rather than rediscover

**`SameSite=Lax` is the CSRF defence.** Single user, no cross-site form posts, `Lax` cookies. A CSRF token here would be machinery nobody maintains protecting against nothing. Write that in the file, so the next reviewer does not add one — and so that if a cross-origin embed is ever introduced, the decision is visibly reopened rather than silently invalidated.

**Rotating `SESSION_SECRET` logs the admin out.** With no session table there is nothing to delete from, so that rotation _is_ the emergency revocation. It goes in the handover guide as a feature, not discovered as a surprise.

## Acceptance

```bash
# the runtime pin is explicit, not inherited
grep -n "runtime = 'nodejs'" src/app/api/auth/login/route.ts   # expect: 1

# argon2 must not reach the Edge bundle — grep the BUILD, not the source
pnpm build
grep -rl "argon2\|hash-wasm" .next/server/middleware* 2>/dev/null && echo "FAIL: argon2 in middleware" || echo "OK: middleware is argon2-free"

# middleware guards everything except the login surface
grep -n "matcher" src/middleware.ts     # expect: /login and /api/auth/login excluded

# --- behaviour ---
pnpm dev &
curl -si localhost:3001/bookings | head -1                       # expect: 307/302 to /login
curl -si -X POST localhost:3001/api/auth/login -d 'password=wrong'   | head -1   # expect: 401
curl -si -X POST localhost:3001/api/auth/login -d 'password=<real>' | grep -i set-cookie
# expect: admin_session=...; HttpOnly; Secure; SameSite=Lax; Path=/

# rate limit fires, and is distinguishable from a wrong password
for i in $(seq 1 6); do curl -so /dev/null -w "%{http_code} " -X POST localhost:3001/api/auth/login -d 'password=wrong'; done
echo   # expect: 401 401 401 401 401 429

# a tampered token is rejected, not merely a missing one
curl -si -H 'Cookie: admin_session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.forged' localhost:3001/bookings | head -1
# expect: 307/302 to /login

# the plaintext password exists nowhere in the repo
grep -rniE "password\s*=\s*['\"][^'\"]{6,}" . --exclude-dir=node_modules --exclude-dir=.next
# expect: no match outside .env.local (which is gitignored) and the acceptance line above
```

**Not done until** the built middleware bundle has been grepped and confirmed free of argon2, **and** a forged token has been seen rejected. Both are things that pass in development and fail in production: the first at deploy, the second never — a middleware that checks only for a cookie's _presence_ works perfectly in every manual test anyone will run.

handoff: `code-reviewer` — checkpoint before step 08
