import "server-only";

/**
 * In-memory, per-IP, on the login route only: 5 attempts per 15 minutes,
 * then 429. Deliberately not Redis and not a database table — one admin,
 * one password, and a process restart clearing the counter is an acceptable
 * weakness against an argon2id hash. It exists to make online brute force
 * pointless, not to be a security product. See docs/architecture.md, "Login
 * rate limiting".
 *
 * State lives for the process lifetime and is shared across requests within
 * it — a Sumopod redeploy clears it, which is fine.
 */
export const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * PINNED TO `globalThis`, NOT A PLAIN MODULE-SCOPE `const`, AND THIS WAS FOUND
 * BY WATCHING IT FAIL. Next bundles the route-handler layer and the React
 * Server Component layer separately, so a module imported by both is
 * INSTANTIATED TWICE in one process — two `Map`s, each invisible to the other.
 * Measured against a production build: the login route refused a sixth attempt
 * with 429 while `/login`, rendering in the same process microseconds later,
 * found no bucket at all for the same IP.
 *
 * Nothing throws when that happens. The limiter keeps working (the route only
 * ever talks to its own copy) and the page silently loses the countdown,
 * falling back to the vague sentence forever. `globalThis` is the one scope
 * both layers share.
 *
 * This does NOT make the counter durable, and it must not be read as doing so:
 * it is still per-process and still cleared by a redeploy, which the paragraph
 * above accepts on purpose.
 */
declare global {
  // `var` is required here: `let`/`const` in a global declaration do not
  // attach to `globalThis`, which is the whole point of this block.
  var __arenaLoginRateLimitBuckets: Map<string, Bucket> | undefined;
}

const buckets = (globalThis.__arenaLoginRateLimitBuckets ??= new Map<string, Bucket>());

/**
 * Records one attempt for `ip` and reports whether it is still within the
 * allowance. Call this once per POST to the login route, before verifying
 * the password — a limited IP must not reach `verifyPassword()` at all, so
 * the 429 path costs nothing on the argon2 side either.
 */
export function checkRateLimit(ip: string): "ok" | "limited" {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return "ok";
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    return "limited";
  }

  bucket.count += 1;
  return "ok";
}

/**
 * Milliseconds left on `ip`'s lockout, or `null` if it is not currently
 * limited. For the login page, which renders the wait the admin reads.
 *
 * THE WINDOW IS ANCHORED TO THE FIRST ATTEMPT AND IS NEVER EXTENDED, which is
 * exactly why this function has to exist. `WINDOW_MS` is the length of the
 * window, not the length of the wait: five attempts spread over fourteen
 * minutes leave one minute on the clock when the sixth is refused. The page
 * used to print the window length and overstate the wait by up to the whole
 * fifteen — and the admin is standing at the field with a customer waiting, so
 * a wait stated wrongly is worse than one not stated at all.
 *
 * PURELY READ-ONLY, BECAUSE IT RUNS ON A GET. It never creates a bucket, never
 * bumps a count, and never evicts an expired one — an expired bucket is left
 * exactly where it is for the next `checkRateLimit()` to overwrite. A peek that
 * mutated would let a page render change what the next POST is allowed to do.
 *
 * Both boundaries below are `checkRateLimit()`'s, character for character. If
 * the two ever disagree by one instant, the page and the route contradict each
 * other on the screen the admin is reading.
 */
export function peekRateLimit(ip: string): number | null {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    return null;
  }
  if (bucket.count < MAX_ATTEMPTS) {
    return null;
  }
  return bucket.resetAt - now;
}

/** A successful login clears the IP's counter — failed guesses should not count against the admin's own next login. */
export function clearRateLimit(ip: string): void {
  buckets.delete(ip);
}

/** Test-only: clears all state between test cases. */
export function resetRateLimit(): void {
  buckets.clear();
}
