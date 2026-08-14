/**
 * The runtime pin is explicit, not inherited: Next route handlers default to
 * Node, but this file is the ONE place in the whole app `verifyPassword()`
 * (hash-wasm argon2id) is ever called, so the pin stays here as a tripwire —
 * removing it, or someone adding a second call site elsewhere, is the exact
 * mistake that builds clean and fails on Sumopod. See docs/architecture.md,
 * "The Edge/Node split".
 */
export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { checkRateLimit, clearRateLimit } from "@/server/auth/rate-limit";
import { verifyPassword } from "@/server/auth/password";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, signSession } from "@/server/auth/session";

/**
 * Precomputed argon2id hash of a fixed placeholder, same cost parameters as
 * the real hash (m=65536, t=3, p=1 — docs/architecture.md's generation
 * script). Used only when `ADMIN_PASSWORD_HASH` is unset, so a misconfigured
 * deployment runs the same argon2 computation, in the same wall-clock time,
 * as a wrong password checked against a real hash. This is the "unknown
 * state" half of "constant response shape and timing for wrong-password vs
 * unknown-state" (docs/tasks/1a-step-07-auth.md). Not a secret — nothing in
 * production is ever meant to match it.
 */
const FALLBACK_HASH =
  "$argon2id$v=19$m=65536,t=3,p=1$AQEBAQEBAQEBAQEBAQEBAQ$Vc0T4HeLi1jJ4wIYOCfGofeE5jXn0TKV6rd5TvOLUL8";

/**
 * DEV ONLY. Accepts any password so `next dev` reaches the dashboard with an
 * empty `.env.local`.
 *
 * The gate is `NODE_ENV === "development"` and nothing else: exactly
 * `next dev`. `next build`/`next start` set `production`, vitest sets `test`.
 * Next folds `process.env.NODE_ENV` at build time, so a production bundle
 * evaluates this to `false` and drops the branch entirely — it is absent from
 * the output, not merely unreachable.
 *
 * `route.test.ts` runs under `test` and therefore keeps asserting the real
 * behaviour, including that an unset `ADMIN_PASSWORD_HASH` rejects every
 * password. Those tests fail if this is ever loosened to `!== "production"`.
 */
const DEV_LOGIN_BYPASS = process.env.NODE_ENV === "development";

/**
 * Takes the RIGHTMOST `X-Forwarded-For` entry, not the leftmost. Every hop
 * a request passes through APPENDS its own view of the client to this
 * header — the leftmost entry is whatever the original caller claimed to
 * be, which is attacker-controlled and free to rotate on every request,
 * defeating the rate limiter entirely (or, run in reverse, letting an
 * attacker spoof the real admin's IP to lock them out for 15 minutes). The
 * rightmost entry is the one hop closest to this process, appended by
 * infrastructure this app trusts (its own reverse proxy), not by the
 * client.
 *
 * ASSUMPTION FLAGGED FOR PHASE 5: this repo has no documented Sumopod
 * deployment notes confirming what header its edge/proxy layer sets or
 * whether it appends to `X-Forwarded-For` at all (a platform-provided
 * header, if one exists, would be a stronger signal than any hop count in
 * a client-supplied header). Rightmost-XFF is the safer default absent
 * that confirmation. Whoever runs step 08 / Phase 5 against the real
 * platform must verify this against an actual multi-hop request and
 * correct it here if Sumopod's proxy behaves differently.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",");
    return hops[hops.length - 1]!.trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * The login page posts a plain `<form>` (no client component involved) and
 * a real browser sends `Accept: text/html,...` on that navigation, so a
 * failure can redirect back to `/login?error=1` for the no-JS flow. A
 * caller that wants a JSON contract — curl, this step's own acceptance
 * checks, a future integration test — never sends that header and gets a
 * bare status code and JSON body instead. Same rate limit, same password
 * check, same cookie; only the response shape differs.
 */
function wantsHtml(request: NextRequest): boolean {
  return (request.headers.get("accept") ?? "").includes("text/html");
}

function withSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const html = wantsHtml(request);

  if (checkRateLimit(ip) === "limited") {
    if (html) {
      return NextResponse.redirect(new URL("/login?error=rate_limited", request.url), 303);
    }
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const formData = await request.formData().catch(() => null);
  const rawPassword = formData?.get("password");
  const candidate = typeof rawPassword === "string" ? rawPassword : "";

  const configuredHash = process.env.ADMIN_PASSWORD_HASH;
  const hashToCheck = configuredHash && configuredHash.length > 0 ? configuredHash : FALLBACK_HASH;

  // Always awaited, regardless of whether ADMIN_PASSWORD_HASH is set — the
  // argon2 cost is paid on every request so a misconfigured server and a
  // wrong password are not distinguishable by timing.
  const candidateMatchesHash = await verifyPassword(candidate, hashToCheck);
  const realCredentialValid = candidateMatchesHash && Boolean(configuredHash);
  const valid = DEV_LOGIN_BYPASS || realCredentialValid;

  if (DEV_LOGIN_BYPASS && !realCredentialValid) {
    console.warn(
      "[dev] login bypass granted a session — any password is accepted under `next dev`. See DEV_LOGIN_BYPASS in this file.",
    );
  }

  if (!valid) {
    if (html) {
      return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
    }
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  clearRateLimit(ip);
  const token = await signSession();

  if (html) {
    return withSessionCookie(NextResponse.redirect(new URL("/", request.url), 303), token);
  }
  return withSessionCookie(NextResponse.json({ ok: true }), token);
}
