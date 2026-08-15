import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";

vi.mock("@/server/queries", () => ({
  listBookings: vi.fn().mockResolvedValue({
    rows: [
      {
        id: "test-uuid-1",
        booking_date: "2026-08-16",
        time_slot: "19.00 - 20.00",
        team_name: 'Tim "Garuda", NTB',
        phone: "6281234567890",
        status: "confirmed",
        created_at: "2026-08-16T10:00:00.000Z",
      },
    ],
    totalCount: 1,
  }),
  SORTABLE: { when: "b.booking_date, b.time_slot" },
  SORT_DIR: { asc: "asc", desc: "desc" },
}));

describe("GET /api/exports/bookings", () => {
  it("returns CSV content with proper headers and escaping", async () => {
    const req = new NextRequest("http://localhost:3001/api/exports/bookings?status=confirmed");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=");

    const text = await res.text();
    // Verify header line
    expect(text).toContain("ID,Tanggal Booking,Jam Slot,Nama Tim,No WhatsApp,Status,Dibuat Pada");

    // Verify escaping of quotes and commas in team name
    expect(text).toContain(
      'test-uuid-1,2026-08-16,19.00 - 20.00,"Tim ""Garuda"", NTB",\'6281234567890,confirmed,2026-08-16T10:00:00.000Z',
    );
  });
});
