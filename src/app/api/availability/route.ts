import { NextResponse } from "next/server";

import { isBookingDateString } from "@/domain/dates";
import { getSlotAvailabilityForDate } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date || !isBookingDateString(date)) {
    return NextResponse.json(
      { error: "Parameter tanggal tidak valid. Format harus YYYY-MM-DD." },
      { status: 400 },
    );
  }

  const result = await getSlotAvailabilityForDate(date);
  return NextResponse.json(result);
}
