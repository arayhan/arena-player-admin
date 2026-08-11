import "server-only";

/**
 * In-memory, per-IP, on the login route only: 5 attempts per 15 minutes,
 * then 429. Deliberately not Redis and not a database table — one admin,
 * one password, and a process restart clearing the counter is an acceptable
 * weakness against an argon2id hash. It exists to make online brute force
 * pointless, not to be a security product. See docs/architecture.md, "Login
 * rate limiting".
 *
 * Module-scope `Map`, so state lives for the process lifetime and is shared
 * across requests within it — a Sumopod redeploy clears it, which is fine.
 */
export const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

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

/** A successful login clears the IP's counter — failed guesses should not count against the admin's own next login. */
export function clearRateLimit(ip: string): void {
  buckets.delete(ip);
}

/** Test-only: clears all state between test cases. */
export function resetRateLimit(): void {
  buckets.clear();
}
