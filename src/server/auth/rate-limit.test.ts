import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit, MAX_ATTEMPTS, peekRateLimit, resetRateLimit } from "./rate-limit";

const WINDOW_MS = 15 * 60 * 1000;

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

/**
 * The login page renders this value as the wait the admin reads, so the cases
 * that matter are the ones where it must NOT produce a number: an IP with no
 * bucket, an IP still inside its allowance, and a window that has already
 * passed. A number in any of those is a wait stated wrongly.
 */
describe("peekRateLimit", () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetRateLimit();
  });

  it("returns null for an IP that has never attempted", () => {
    expect(peekRateLimit("203.0.113.10")).toBeNull();
  });

  it("returns null while attempts remain, and a wait once the allowance is spent", () => {
    // The flip is at `count >= MAX_ATTEMPTS`, which is `checkRateLimit`'s own
    // condition: the fifth attempt is allowed AND leaves nothing behind it, so
    // the door is shut from that moment, not from the sixth attempt's refusal.
    const ip = "203.0.113.11";
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      checkRateLimit(ip);
      expect(peekRateLimit(ip)).toBeNull();
    }

    expect(checkRateLimit(ip)).toBe("ok");
    expect(peekRateLimit(ip)).not.toBeNull();
    expect(checkRateLimit(ip)).toBe("limited");
  });

  it("reports the remaining window once the IP is limited", () => {
    const ip = "203.0.113.12";
    for (let i = 0; i < MAX_ATTEMPTS; i++) checkRateLimit(ip);
    expect(checkRateLimit(ip)).toBe("limited");

    const remaining = peekRateLimit(ip);
    expect(remaining).not.toBeNull();
    expect(remaining!).toBeGreaterThan(0);
    expect(remaining!).toBeLessThanOrEqual(WINDOW_MS);
  });

  it("counts down from the FIRST attempt, not from the one that was refused", () => {
    // The defect this function exists to fix: the window is anchored to the
    // first attempt and never extended, so a slow run of guesses leaves far
    // less than WINDOW_MS on the clock when the limit finally fires.
    vi.useFakeTimers();
    const ip = "203.0.113.13";
    checkRateLimit(ip);

    vi.advanceTimersByTime(14 * 60 * 1000);
    for (let i = 1; i < MAX_ATTEMPTS; i++) checkRateLimit(ip);
    expect(checkRateLimit(ip)).toBe("limited");

    expect(peekRateLimit(ip)).toBe(60 * 1000);
    vi.useRealTimers();
  });

  it("returns null once the window has expired, even with the bucket still present", () => {
    vi.useFakeTimers();
    const ip = "203.0.113.14";
    for (let i = 0; i < MAX_ATTEMPTS; i++) checkRateLimit(ip);
    expect(peekRateLimit(ip)).not.toBeNull();

    vi.advanceTimersByTime(WINDOW_MS + 1);

    expect(peekRateLimit(ip)).toBeNull();
    vi.useRealTimers();
  });

  it("does not mutate the bucket it reads", () => {
    // It runs on a GET. A peek that created, incremented or evicted would let a
    // page render change what the next POST is allowed to do.
    const ip = "203.0.113.15";
    for (let i = 0; i < MAX_ATTEMPTS; i++) checkRateLimit(ip);

    peekRateLimit(ip);
    peekRateLimit(ip);
    peekRateLimit(ip);

    expect(checkRateLimit(ip)).toBe("limited");
    expect(peekRateLimit("203.0.113.16")).toBeNull();
    expect(checkRateLimit("203.0.113.16")).toBe("ok");
  });
});
