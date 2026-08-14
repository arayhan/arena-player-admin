import "server-only";

import { jwtVerify, SignJWT, type JWTPayload } from "jose";

/**
 * `jose` is the half of auth that runs on the Edge runtime — Web Crypto
 * only, no argon2. `src/middleware.ts` imports `verifySession` and
 * `SESSION_COOKIE_NAME` from this file directly; it never imports
 * `./password`. See docs/architecture.md, "The Edge/Node split".
 */
const ALG = "HS256";

/** 7 days, matching the cookie's Max-Age (docs/architecture.md, "Session cookie"). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const SESSION_COOKIE_NAME = "admin_session";

export interface SessionPayload extends JWTPayload {
  sub: "admin";
  iat: number;
  exp: number;
}

/**
 * Not a credential. It exists so `next dev` can mint a session with an empty
 * `.env.local`, which is what makes the dev login bypass in
 * `src/app/api/auth/login/route.ts` usable at all — without it the bypass
 * would 500 instead of logging anyone in. The name is deliberately not
 * secret-shaped: anything signed with it is worthless.
 */
const DEV_FALLBACK_SECRET = "development-only-session-secret-not-a-real-key";

let warnedAboutDevSecret = false;

/**
 * The dev fallback is gated on `NODE_ENV === "development"` — exactly
 * `next dev`, never `next build`/`next start` (`production`) and never
 * vitest (`test`). Next folds `process.env.NODE_ENV` at build time, so in a
 * production bundle this comparison is `false` and the branch is eliminated
 * from the output rather than merely unreached. `session.test.ts` asserts the
 * throw still happens outside development, and fails if the gate is ever
 * loosened to `!== "production"`.
 */
function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      if (!warnedAboutDevSecret) {
        warnedAboutDevSecret = true;
        console.warn(
          "[dev] SESSION_SECRET is unset — signing sessions with the development fallback key. Never reachable outside `next dev`.",
        );
      }
      return new TextEncoder().encode(DEV_FALLBACK_SECRET);
    }
    throw new Error(
      "SESSION_SECRET is not set. Copy .env.local.example to .env.local and fill in >= 32 random bytes, base64 (docs/architecture.md).",
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Payload is `{ sub: 'admin', iat, exp }` and nothing else — there is no
 * second subject, so anything more is a field to keep in sync for no
 * reason. See docs/architecture.md, "Session cookie".
 */
export async function signSession(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: "admin" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE_SECONDS)
    .sign(getSecret());
}

/**
 * Verifies signature and expiry. Returns `null` on any failure — expired,
 * forged, wrong algorithm, garbage input, or a missing `SESSION_SECRET` —
 * never throws. Callers (middleware, and any route reading the cookie)
 * treat `null` as "no session", the same as a missing cookie.
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (payload.sub !== "admin") return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
