import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/server/auth/session";

/**
 * Clears the cookie. No user table and no session table means there is
 * nothing server-side to invalidate beyond this — see docs/architecture.md,
 * "Session cookie", on why `SESSION_SECRET` rotation is the emergency
 * revocation path instead.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
