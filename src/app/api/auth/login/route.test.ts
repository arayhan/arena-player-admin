import { argon2id } from "hash-wasm";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetRateLimit, MAX_ATTEMPTS } from "@/server/auth/rate-limit";
import { SESSION_COOKIE_NAME } from "@/server/auth/session";

import { POST } from "./route";

/**
 * Exercises the login route directly, in-process — no server, no network.
 * Covers the three things password.test.ts's comment claimed were covered
 * here and, until this file existed, were not: the
 * `candidateMatchesHash && Boolean(configuredHash)` wiring (a valid
 * password against an UNSET hash must still fail — the "unknown state" is
 * not silently treated as "no password required"), the `wantsHtml`
 * content-negotiation branch, and the session cookie's flags.
 */

const REAL_PASSWORD = "correct horse battery staple";
let REAL_HASH: string;

beforeAll(async () => {
  REAL_HASH = await argon2id({
    password: REAL_PASSWORD,
    salt: Buffer.alloc(16, 7),
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: "encoded",
  });
});

function makeRequest(opts: {
  password?: string;
  accept?: string;
  ip?: string;
  xff?: string;
}): NextRequest {
  const form = new FormData();
  if (opts.password !== undefined) form.set("password", opts.password);

  const headers = new Headers();
  if (opts.accept) headers.set("accept", opts.accept);
  headers.set("x-forwarded-for", opts.xff ?? opts.ip ?? "203.0.113.1");

  return new NextRequest("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers,
    body: form,
  });
}

// A unique IP per test (see makeRequest's default) already isolates the
// rate limiter across tests that don't test the limiter itself, but reset
// explicitly too — the limiter's Map is module-scope state shared across
// this whole file.
beforeEach(() => {
  resetRateLimit();
});

const originalHash = process.env.ADMIN_PASSWORD_HASH;
const originalSecret = process.env.SESSION_SECRET;

afterEach(() => {
  if (originalHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = originalHash;
  if (originalSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSecret;
});

describe("POST /api/auth/login — candidateMatchesHash && configuredHash wiring", () => {
  it("rejects the right password when ADMIN_PASSWORD_HASH is unset — unknown state is not open access", async () => {
    delete process.env.ADMIN_PASSWORD_HASH;
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-bytes-long";

    const response = await POST(makeRequest({ password: REAL_PASSWORD, ip: "198.51.100.1" }));

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects the wrong password against a configured hash", async () => {
    process.env.ADMIN_PASSWORD_HASH = REAL_HASH;
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-bytes-long";

    const response = await POST(makeRequest({ password: "wrong", ip: "198.51.100.2" }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "invalid_credentials" });
  });

  it("accepts the right password against a configured hash and sets the session cookie", async () => {
    process.env.ADMIN_PASSWORD_HASH = REAL_HASH;
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-bytes-long";

    const response = await POST(makeRequest({ password: REAL_PASSWORD, ip: "198.51.100.3" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=`);
  });
});

describe("POST /api/auth/login — wantsHtml negotiation", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD_HASH = REAL_HASH;
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-bytes-long";
  });

  it("redirects 303 to / on success when Accept: text/html", async () => {
    const response = await POST(
      makeRequest({ password: REAL_PASSWORD, accept: "text/html", ip: "198.51.100.4" }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3001/");
  });

  it("redirects 303 to /login?error=invalid on failure when Accept: text/html", async () => {
    const response = await POST(
      makeRequest({ password: "wrong", accept: "text/html", ip: "198.51.100.5" }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3001/login?error=invalid");
  });

  it("returns bare JSON on success when Accept does not want html", async () => {
    const response = await POST(
      makeRequest({ password: REAL_PASSWORD, accept: "application/json", ip: "198.51.100.6" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("POST /api/auth/login — session cookie flags", () => {
  it("sets HttpOnly, Secure, SameSite=Lax, Path=/", async () => {
    process.env.ADMIN_PASSWORD_HASH = REAL_HASH;
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-bytes-long";

    const response = await POST(makeRequest({ password: REAL_PASSWORD, ip: "198.51.100.7" }));

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie).toContain("Path=/");
  });
});

describe("POST /api/auth/login — rate limiting", () => {
  it("locks out after MAX_ATTEMPTS wrong passwords from the same IP", async () => {
    process.env.ADMIN_PASSWORD_HASH = REAL_HASH;
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-bytes-long";
    const ip = "198.51.100.9";

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const response = await POST(makeRequest({ password: "wrong", ip }));
      expect(response.status).toBe(401);
    }

    const limited = await POST(makeRequest({ password: "wrong", ip }));
    expect(limited.status).toBe(429);
  });

  it("buckets by the RIGHTMOST X-Forwarded-For entry — a spoofed leftmost hop cannot bypass the limiter", async () => {
    process.env.ADMIN_PASSWORD_HASH = REAL_HASH;
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-bytes-long";
    // Real infra: this app's own reverse proxy appends its view of the
    // client as the LAST entry — "203.0.113.9" here. Everything to the left
    // of it is attacker-supplied and rotates on every request in a real
    // attack, exactly as it does below.
    const trustedHop = "203.0.113.9";

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const spoofedLeftmost = `198.51.100.${100 + i}`;
      const response = await POST(
        makeRequest({ password: "wrong", xff: `${spoofedLeftmost}, ${trustedHop}` }),
      );
      expect(response.status).toBe(401);
    }

    // A 6th request, different spoofed leftmost hop again, same trusted
    // rightmost hop — must still be limited. If getClientIp took the
    // leftmost entry instead, each of the 6 requests above would land in
    // its own bucket and none of them would ever reach 429.
    const limited = await POST(
      makeRequest({ password: "wrong", xff: `198.51.100.200, ${trustedHop}` }),
    );
    expect(limited.status).toBe(429);
  });
});
