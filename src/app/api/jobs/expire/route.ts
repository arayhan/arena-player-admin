import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, verifySession } from "@/server/auth/session";
import { expireOldPendingBookings } from "@/server/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Dual authentication per docs/architecture.md:
  // 1. Authorization: Bearer $CRON_SECRET (external HTTP scheduler)
  // 2. admin_session cookie (manual dashboard button)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  let isAuthorized = false;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const payload = await verifySession(sessionCookie);
      if (payload?.sub === "admin") {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { expiredCount, rows } = await expireOldPendingBookings();

  return NextResponse.json(
    {
      expired: expiredCount,
      rows,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
