import "server-only";

import { sql } from "@/server/db";
import type { BookingStatus } from "@/domain/status";
import type { TimeSlot } from "@/domain/slots";
import { normalisePhone } from "@/domain/phone";

export const SORTABLE = {
  when: "b.booking_date, b.time_slot",
  created: "b.created_at",
  team: "b.team_name",
  status: "b.status",
} as const;
export type SortKey = keyof typeof SORTABLE;

export const SORT_DIR = {
  asc: "asc",
  desc: "desc",
} as const;
export type SortDir = keyof typeof SORT_DIR;

export type BookingRow = {
  id: string;
  booking_date: string;
  time_slot: TimeSlot;
  team_name: string;
  phone: string;
  proof_key: string | null;
  status: BookingStatus;
  created_at: string;
  notes?: string | null;
  total_count?: number;
};

export type ListBookingsParams = {
  status?: BookingStatus[];
  from?: string | null;
  to?: string | null;
  q?: string | null;
  limit?: number;
  offset?: number;
  sort?: SortKey;
  dir?: SortDir;
};

export async function listBookings({
  status = ["pending"],
  from = null,
  to = null,
  q = null,
  limit = 50,
  offset = 0,
  sort = "when",
  dir = "asc",
}: ListBookingsParams = {}): Promise<{ rows: BookingRow[]; totalCount: number }> {
  try {
    const qText = q && q.trim().length > 0 ? q.trim() : null;
    const qPhone = qText ? normalisePhone(qText) : null;
    const selectedSort = SORTABLE[sort] ? sort : "when";
    const selectedDir = SORT_DIR[dir] ? dir : "asc";

    // SQL statement from docs/architecture.md, "The query".
    // Bound parameters:
    // $1 status[]  text[]
    // $2 from      date nullable
    // $3 to        date nullable
    // $4 q_text    text nullable
    // $5 q_phone   text nullable
    // $6 limit     int
    // $7 offset    int
    const rows = await sql<BookingRow[]>`
      select
        b.id,
        b.booking_date::text as booking_date,
        b.time_slot,
        b.team_name,
        b.phone,
        b.proof_key,
        b.status,
        b.created_at::text   as created_at,
        count(*) over ()::int as total_count
      from bookings b
      where b.status = any(${status}::text[])
        and (${from}::date is null or b.booking_date >= ${from}::date)
        and (${to}::date is null or b.booking_date <= ${to}::date)
        and (
          ${qText}::text is null
          or b.team_name ilike '%' || ${qText} || '%'
          or (${qPhone}::text is not null and b.phone = ${qPhone})
        )
      order by
        case when ${selectedSort} = 'when' and ${selectedDir} = 'asc' then b.booking_date end asc,
        case when ${selectedSort} = 'when' and ${selectedDir} = 'asc' then b.time_slot end asc,
        case when ${selectedSort} = 'when' and ${selectedDir} = 'desc' then b.booking_date end desc,
        case when ${selectedSort} = 'when' and ${selectedDir} = 'desc' then b.time_slot end desc,
        case when ${selectedSort} = 'created' and ${selectedDir} = 'asc' then b.created_at end asc,
        case when ${selectedSort} = 'created' and ${selectedDir} = 'desc' then b.created_at end desc,
        case when ${selectedSort} = 'team' and ${selectedDir} = 'asc' then b.team_name end asc,
        case when ${selectedSort} = 'team' and ${selectedDir} = 'desc' then b.team_name end desc,
        case when ${selectedSort} = 'status' and ${selectedDir} = 'asc' then b.status end asc,
        case when ${selectedSort} = 'status' and ${selectedDir} = 'desc' then b.status end desc
      limit ${limit}
      offset ${offset}
    `;

    const totalCount = rows.length > 0 && rows[0].total_count ? Number(rows[0].total_count) : 0;
    return { rows, totalCount };
  } catch (error) {
    console.error("[queries] listBookings failed:", error);
    return { rows: [], totalCount: 0 };
  }
}

export async function getBookingById(id: string): Promise<BookingRow | null> {
  try {
    const rows = await sql<BookingRow[]>`
      select
        b.id,
        b.booking_date::text as booking_date,
        b.time_slot,
        b.team_name,
        b.phone,
        b.proof_key,
        b.status,
        b.created_at::text   as created_at,
        b.notes
      from bookings b
      where b.id = ${id}
      limit 1
    `;
    return rows[0] ?? null;
  } catch (error) {
    console.error("[queries] getBookingById failed:", error);
    return null;
  }
}

export async function confirmBooking(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await sql`
      update bookings
      set status = 'confirmed'
      where id = ${id}
        and status = 'pending'
      returning id
    `;
    if (result.length === 0) {
      return { success: false, error: "409: Booking sudah diproses atau status berubah." };
    }
    return { success: true };
  } catch (error) {
    console.error("[queries] confirmBooking failed:", error);
    return { success: false, error: "Gagal mengonfirmasi booking." };
  }
}

export async function rejectBooking(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await sql`
      update bookings
      set status = 'rejected'
      where id = ${id}
        and status in ('pending', 'confirmed')
      returning id
    `;
    if (result.length === 0) {
      return { success: false, error: "409: Booking tidak dapat ditolak pada status saat ini." };
    }
    return { success: true };
  } catch (error) {
    console.error("[queries] rejectBooking failed:", error);
    return { success: false, error: "Gagal menolak booking." };
  }
}

export type ExpiredBookingRow = {
  id: string;
  booking_date: string;
  time_slot: string;
};

export async function expireOldPendingBookings(): Promise<{
  expiredCount: number;
  rows: ExpiredBookingRow[];
}> {
  try {
    // Statement from docs/architecture.md, "The expiry job":
    // update bookings
    //    set status = 'expired'
    //  where status = 'pending'
    //    and created_at < now() - interval '24 hours'
    // returning id, booking_date, time_slot;
    const rows = await sql<ExpiredBookingRow[]>`
      update bookings
      set status = 'expired'
      where status = 'pending'
        and created_at < now() - interval '24 hours'
      returning
        id,
        booking_date::text as booking_date,
        time_slot
    `;
    return {
      expiredCount: rows.length,
      rows,
    };
  } catch (error) {
    console.error("[queries] expireOldPendingBookings failed:", error);
    return {
      expiredCount: 0,
      rows: [],
    };
  }
}
