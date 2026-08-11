import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// STUB — step 02 (scaffold) only. Real behaviour lands in
// 1a-step-07-auth.md: verify the `admin_session` JWT with `jose` and redirect
// to /login on failure. Nothing more.
//
// This file runs on the Edge runtime, always. That is the reason password
// comparison must never move here — argon2 (via hash-wasm) cannot run on
// Edge. See docs/architecture.md, "The Edge/Node split", and CLAUDE.md hard
// rule 8. Middleware verifies a JWT and nothing else; the login route
// (`export const runtime = "nodejs"`) is the only place a password is ever
// compared.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}
