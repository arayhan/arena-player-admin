import "server-only";

import { argon2Verify } from "hash-wasm";

/**
 * NODE RUNTIME ONLY. `hash-wasm`'s argon2id cannot run on the Edge runtime
 * (see docs/architecture.md, "The Edge/Node split", and CLAUDE.md hard rule
 * 8). This function must only ever be called from
 * `src/app/api/auth/login/route.ts`, which pins
 * `export const runtime = "nodejs"`. `src/middleware.ts` runs on Edge and
 * verifies the session JWT only — it never imports this file, directly or
 * transitively.
 *
 * `hash-wasm`, not `@node-rs/argon2`: pure WASM, no build step, no native
 * binding that has to compile or find a prebuilt for Sumopod's unverified
 * build environment. See docs/architecture.md, "Hashing".
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await argon2Verify({ password: plain, hash });
  } catch {
    // A malformed or empty hash throws inside hash-wasm rather than
    // returning false. Callers (the login route) must never see the
    // difference between "wrong password" and "malformed hash" — both are
    // a rejected login, never a 500.
    return false;
  }
}
