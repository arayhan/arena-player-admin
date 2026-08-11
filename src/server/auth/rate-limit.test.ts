import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit, MAX_ATTEMPTS, resetRateLimit } from "./rate-limit";

/**
 * In-memory, per-IP, 5 attempts / 15 min → 429. Deliberately not Redis and
 * not a database table (docs/architecture.md, "Login rate limiting"). No
 * credentials needed — this is pure in-process state.
 */
describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetRateLimit();
  });

  it("allows exactly MAX_ATTEMPTS attempts before limiting", () => {
    const ip = "203.0.113.1";
    const results = Array.from({ length: MAX_ATTEMPTS }, () => checkRateLimit(ip));
    expect(results.every((r) => r === "ok")).toBe(true);
    expect(MAX_ATTEMPTS).toBe(5);
  });

  it("limits the attempt after MAX_ATTEMPTS", () => {
    const ip = "203.0.113.2";
    for (let i = 0; i < MAX_ATTEMPTS; i++) checkRateLimit(ip);
    expect(checkRateLimit(ip)).toBe("limited");
  });

  it("tracks IPs independently", () => {
    const ipA = "203.0.113.3";
    const ipB = "203.0.113.4";
    for (let i = 0; i < MAX_ATTEMPTS; i++) checkRateLimit(ipA);
    expect(checkRateLimit(ipA)).toBe("limited");
    expect(checkRateLimit(ipB)).toBe("ok");
  });

  it("resets the window after it expires", () => {
    vi.useFakeTimers();
    const ip = "203.0.113.5";
    for (let i = 0; i < MAX_ATTEMPTS; i++) checkRateLimit(ip);
    expect(checkRateLimit(ip)).toBe("limited");

    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    expect(checkRateLimit(ip)).toBe("ok");
    vi.useRealTimers();
  });
});
