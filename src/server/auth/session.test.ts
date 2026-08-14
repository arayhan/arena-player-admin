import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SESSION_COOKIE_NAME, signSession, verifySession } from "./session";

const ORIGINAL_SECRET = process.env.SESSION_SECRET;

describe("session (jose HS256)", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "unit-test-secret-at-least-32-bytes-long";
  });

  afterEach(() => {
    process.env.SESSION_SECRET = ORIGINAL_SECRET;
  });

  it("signs a token that verifies back to sub: admin", async () => {
    const token = await signSession();
    const payload = await verifySession(token);

    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("admin");
    expect(typeof payload?.iat).toBe("number");
    expect(typeof payload?.exp).toBe("number");
  });

  it("carries no field beyond sub, iat, exp", async () => {
    const token = await signSession();
    const payload = await verifySession(token);

    expect(Object.keys(payload ?? {}).sort()).toEqual(["exp", "iat", "sub"]);
  });

  it("rejects a token signed with a different secret", async () => {
    const forgedToken = await new SignJWT({ sub: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode("a-completely-different-secret-value"));

    await expect(verifySession(forgedToken)).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = await new SignJWT({ sub: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 1000)
      .setExpirationTime(now - 500)
      .sign(secret);

    await expect(verifySession(expiredToken)).resolves.toBeNull();
  });

  it("rejects a tampered/forged token string outright", async () => {
    await expect(
      verifySession("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.forged"),
    ).resolves.toBeNull();
  });

  it("rejects garbage input without throwing", async () => {
    await expect(verifySession("not-a-jwt-at-all")).resolves.toBeNull();
    await expect(verifySession("")).resolves.toBeNull();
  });

  it("exports the cookie name used by middleware, login and logout", () => {
    expect(SESSION_COOKIE_NAME).toBe("admin_session");
  });
});

/**
 * `getSecret()` has a development-only fallback so `next dev` can mint a
 * session with an empty `.env.local`. This suite is the fence around it.
 *
 * Vitest runs with `NODE_ENV=test`, so the fallback must not apply here — and
 * it would apply if the gate were ever loosened from `=== "development"` to
 * `!== "production"`, which is the exact mistake this catches.
 */
describe("session — the dev fallback secret is gated to `next dev`", () => {
  const ORIGINAL = process.env.SESSION_SECRET;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = ORIGINAL;
  });

  it("still throws with SESSION_SECRET unset, because NODE_ENV is not development", async () => {
    delete process.env.SESSION_SECRET;
    expect(process.env.NODE_ENV).not.toBe("development");

    await expect(signSession()).rejects.toThrow(/SESSION_SECRET is not set/);
  });
});
