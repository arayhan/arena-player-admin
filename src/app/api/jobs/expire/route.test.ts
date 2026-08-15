import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "./route";
import { expireOldPendingBookings } from "@/server/queries";
import { verifySession } from "@/server/auth/session";

vi.mock("@/server/queries", () => ({
  expireOldPendingBookings: vi.fn().mockResolvedValue({
    expiredCount: 2,
    rows: [
      { id: "uuid-1", booking_date: "2026-08-14", time_slot: "19.00 - 20.00" },
      { id: "uuid-2", booking_date: "2026-08-14", time_slot: "20.00 - 21.00" },
    ],
  }),
}));

vi.mock("@/server/auth/session", () => ({
  SESSION_COOKIE_NAME: "admin_session",
  verifySession: vi.fn(),
}));

describe("POST /api/jobs/expire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret_cron_12345";
  });

  it("returns 401 Unauthorized when no credentials are provided", async () => {
    const req = new NextRequest("http://localhost:3001/api/jobs/expire", {
      method: "POST",
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(expireOldPendingBookings).not.toHaveBeenCalled();
  });

  it("returns 401 when an invalid Bearer token is provided", async () => {
    const req = new NextRequest("http://localhost:3001/api/jobs/expire", {
      method: "POST",
      headers: {
        authorization: "Bearer wrong_secret",
      },
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(expireOldPendingBookings).not.toHaveBeenCalled();
  });

  it("authenticates successfully with valid Bearer token", async () => {
    const req = new NextRequest("http://localhost:3001/api/jobs/expire", {
      method: "POST",
      headers: {
        authorization: "Bearer secret_cron_12345",
      },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(expireOldPendingBookings).toHaveBeenCalledTimes(1);

    const body = await res.json();
    expect(body.expired).toBe(2);
    expect(body.rows).toHaveLength(2);
  });

  it("authenticates successfully with valid admin_session cookie", async () => {
    vi.mocked(verifySession).mockResolvedValue({
      sub: "admin",
      iat: 1234567890,
      exp: 1234567890 + 3600,
    });

    const req = new NextRequest("http://localhost:3001/api/jobs/expire", {
      method: "POST",
      headers: {
        cookie: "admin_session=valid_jwt_token",
      },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(expireOldPendingBookings).toHaveBeenCalledTimes(1);

    const body = await res.json();
    expect(body.expired).toBe(2);
  });
});
