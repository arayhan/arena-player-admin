/**
 * Vitest — unlike `next dev` / `next build` — does not load `.env.local`
 * automatically; Next's env loading lives inside its own dev/build process,
 * which a bare `vitest` invocation never goes through. Without this,
 * `DATABASE_URL` and the R2 vars are always unset under `check:schema` /
 * `check:setup`, even with a fully filled-in `.env.local` on disk — the
 * failure would look exactly like a credentials problem while actually
 * being a "nothing loaded them" problem.
 *
 * `.env.local` may legitimately not exist — a fresh clone, or
 * `check:unit`'s own "still exits 0 with `.env.local` moved away" contract
 * (docs/architecture.md). `loadEnvFile` throws ENOENT in that case, and
 * that must never fail a credential-free test, so it is swallowed here;
 * `check:schema` / `check:setup` fail on their own, loudly, when a var they
 * actually need is missing.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local absent — fine. See comment above.
}
