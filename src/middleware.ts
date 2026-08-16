import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, verifySession } from "@/server/auth/session";

/**
 * architecture.md:55 — "Every admin response carries `Cache-Control:
 * private, no-store`." Set centrally, here, rather than per-route: a route
 * that forgets its own `export const dynamic = 'force-dynamic'` (or gets
 * statically prerendered by accident, as `/` was) must still never leak a
 * cacheable response, because nothing else in the request pipeline would
 * catch that silently. Applied to every response this middleware produces,
 * redirect or pass-through — this function is the one place shared by every
 * matched route.
 */
const NO_STORE = "private, no-store";

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
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const redirect = NextResponse.redirect(loginUrl);
    redirect.headers.set("Cache-Control", NO_STORE);
    return redirect;
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}

/**
 * Guards everything except: the login surface (`/login`, `/api/auth/login`
 * — excluding either one turns this into a redirect loop), static assets
 * (no session-worthy content, and Edge is on the hot path for every
 * request that matches), and `POST /api/jobs/expire`. That last one takes
 * Bearer-or-session auth (architecture.md:302) and does its own check
 * inside the route handler — if the matcher covered it, a scheduler
 * calling with only a bearer token would collect this middleware's 307 to
 * `/login` instead of ever reaching the handler, and nothing would expire.
 *
 * `logo.jpeg` IS NAMED HERE BECAUSE `/login` RENDERS IT AND HAS NO SESSION.
 * "Static assets" above meant `_next/*`, and files in `public/` are not
 * served from there — they sit at the root, so `GET /logo.jpeg` matched this
 * guard and came back as a 307 to `/login`. The failure was silent in the
 * worst way: the `<img>` is in the served HTML, the page looks correct in
 * `curl`, and only a real browser shows the broken chip — on the one screen
 * the client sees first, and for every visitor who is not already logged in,
 * which is all of them at that point.
 *
 * NAMED, NOT WILDCARDED. A blanket "anything with a file extension" escape
 * would also unguard `/api/exports/bookings` and any future download route —
 * customer names and phone numbers behind a pattern nobody would re-read.
 * One public file, one entry; add the next one by name too.
 */
export const config = {
  matcher: [
    "/((?!login|api/auth/login|api/jobs/expire|_next/static|_next/image|favicon.ico|logo.jpeg).*)",
  ],
};
