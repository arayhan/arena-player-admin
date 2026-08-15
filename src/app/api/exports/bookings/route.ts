import { NextRequest, NextResponse } from "next/server";

import { todayAtField } from "@/domain/dates";
import { parseBookingsFilter } from "@/modules/bookings/bookings.schema";
import { listBookings } from "@/server/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_EXPORT_LIMIT = 5000;

function escapeCsvField(val: string | number | null | undefined): string {
  if (val == null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filter = parseBookingsFilter(searchParams);

    const { rows: bookings } = await listBookings({
      status: filter.status,
      from: filter.from,
      to: filter.to,
      q: filter.q,
      sort: filter.sort,
      dir: filter.dir,
      limit: MAX_EXPORT_LIMIT,
      offset: 0,
    });

    const headers = [
      "ID",
      "Tanggal Booking",
      "Jam Slot",
      "Nama Tim",
      "No WhatsApp",
      "Status",
      "Dibuat Pada",
    ];

    const csvRows = [headers.map(escapeCsvField).join(",")];

    for (const b of bookings) {
      csvRows.push(
        [
          escapeCsvField(b.id),
          escapeCsvField(b.booking_date),
          escapeCsvField(b.time_slot),
          escapeCsvField(b.team_name),
          // Prefix phone with quote formula so Excel preserves digits without converting to float
          escapeCsvField(`'${b.phone}`),
          escapeCsvField(b.status),
          escapeCsvField(b.created_at),
        ].join(","),
      );
    }

    // UTF-8 BOM + CSV payload
    const csvContent = "\uFEFF" + csvRows.join("\r\n");
    const filename = `booking-${todayAtField()}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/exports/bookings] Export failed:", error);
    return new NextResponse("Gagal menghasilkan ekspor CSV", { status: 500 });
  }
}
