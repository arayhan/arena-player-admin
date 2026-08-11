import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, verifySession } from "@/server/auth/session";

/**
 * Edge runtime, always. Verifies the `admin_session` JWT with `jose` and
 * redirects to `/login` on failure — nothing more. It never sees a
 * password: argon2 (via hash-wasm) cannot run on Edge, so the password
 * comparison lives in `src/app/api/auth/login/route.ts`, which pins
 * `export const runtime = "nodejs"`. See docs/architecture.md, "The
 * Edge/Node split", and CLAUDE.md hard rule 8.
 *
 * A missing cookie and a tampered/forged/expired one are handled
 * identically — both come back `null` from `verifySession` and both
 * redirect. Checking only for the cookie's presence would pass a forged
 * token in every manual test anyone runs and fail the one that matters.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/**
 * Guards everything except the login surface: `/login` (the page) and
 * `/api/auth/login` (the route that issues the cookie) — excluding either
 * one turns this into a redirect loop. Static assets are excluded too;
 * they carry no session-worthy content and Edge is on the hot path for
 * every request that matches.
 */
export const config = {
  matcher: ["/((?!login|api/auth/login|_next/static|_next/image|favicon.ico).*)"],
};
