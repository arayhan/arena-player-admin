import "server-only";

import { isPastSlot, todayAtField } from "@/domain/dates";
import { normalisePhone } from "@/domain/phone";
import { TIME_SLOTS, type TimeSlot } from "@/domain/slots";
import type { BookingStatus } from "@/domain/status";
import { resolveDayType } from "@/server/pricing";
import { sql } from "@/server/db";

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
  status,
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
    const statusFilter = status && status.length > 0 ? status : null;

    // SQL statement from docs/architecture.md, "The query".
    // Bound parameters:
    // $1 status[]  text[] (nullable: when null, matches all statuses)
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
      where (${statusFilter}::text[] is null or b.status = any(${statusFilter}::text[]))
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

export type CreateBookingInput = {
  booking_date: string;
  time_slot?: string;
  time_slots?: string[];
  team_name: string;
  phone: string;
  notes?: string | null;
  status?: "pending" | "confirmed";
};

export type CreateBookingResult =
  | { success: true; id: string; ids?: string[] }
  | { success: false; error: string; code?: "CONFLICT" | "VALIDATION" | "UNKNOWN" };

export async function createBooking(data: CreateBookingInput): Promise<CreateBookingResult> {
  const normalisedPhone = normalisePhone(data.phone);
  if (!normalisedPhone) {
    return {
      success: false,
      error: "Nomor WhatsApp tidak valid.",
      code: "VALIDATION",
    };
  }

  const slots =
    data.time_slots && data.time_slots.length > 0
      ? data.time_slots
      : data.time_slot
        ? [data.time_slot]
        : [];

  if (slots.length === 0) {
    return {
      success: false,
      error: "Pilihan slot waktu wajib diisi.",
      code: "VALIDATION",
    };
  }

  const status = data.status ?? "confirmed";

  try {
    const ids: string[] = [];
    for (const slot of slots) {
      const rows = await sql<Array<{ id: string }>>`
        insert into bookings (
          booking_date,
          time_slot,
          team_name,
          phone,
          notes,
          proof_key,
          status
        ) values (
          ${data.booking_date},
          ${slot},
          ${data.team_name},
          ${normalisedPhone},
          ${data.notes ?? null},
          null,
          ${status}
        )
        returning id
      `;

      if (rows.length === 0 || !rows[0]?.id) {
        return {
          success: false,
          error: `Gagal membuat booking untuk slot ${slot}.`,
          code: "UNKNOWN",
        };
      }
      ids.push(rows[0].id);
    }

    return {
      success: true,
      id: ids[0] ?? "",
      ids,
    };
  } catch (error: unknown) {
    const pgError = error as { code?: string; message?: string };
    if (pgError?.code === "23505") {
      // 23505: unique_violation on uniq_active_slot
      return {
        success: false,
        error: "Salah satu slot pada tanggal dan jam yang dipilih sudah terisi.",
        code: "CONFLICT",
      };
    }

    console.error("[queries] createBooking failed:", error);
    return {
      success: false,
      error: "Terjadi kesalahan saat menyimpan booking.",
      code: "UNKNOWN",
    };
  }
}

export type SlotOptionItem = {
  slot: TimeSlot;
  status: "available" | "confirmed" | "pending" | "blocked" | "past";
  statusLabel: string;
  selectable: boolean;
  price: number;
  priceFormatted: string;
  hasPhotoPromo: boolean;
};

export type DateAvailabilityResult = {
  date: string;
  dayType: "weekday" | "weekend";
  isHoliday: boolean;
  holidayLabel: string | null;
  dpPercent: number;
  slots: SlotOptionItem[];
};

export async function getSlotAvailabilityForDate(
  date: string,
  now: Date = new Date(),
): Promise<DateAvailabilityResult> {
  const formatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

  try {
    const [bookingRows, blockRows, holidayRows, rateRows, siteSettings] = await Promise.all([
      sql<Array<{ time_slot: string; status: BookingStatus }>>`
        select time_slot, status
        from bookings
        where booking_date::text = ${date}
          and status in ('pending', 'confirmed')
      `,
      sql<Array<{ time_slot: string }>>`
        select time_slot
        from slot_blocks
        where block_date::text = ${date}
      `,
      sql<Array<{ holiday_date: string; label: string }>>`
        select holiday_date::text as holiday_date, label
        from public_holidays
      `,
      sql<Array<{ time_slot: string; day_type: string; price_rupiah: number }>>`
        select time_slot, day_type, price_rupiah
        from rate_card
      `,
      getSiteSettings(),
    ]);

    const holidayMap = new Map(holidayRows.map((h) => [h.holiday_date, h.label]));
    const holidayDates = new Set(holidayRows.map((h) => h.holiday_date));
    const dayType = resolveDayType(date, holidayDates);
    const isHoliday = holidayMap.has(date);
    const holidayLabel = holidayMap.get(date) ?? null;
    const dpPercent = parseInt(siteSettings.dp_percent, 10) || 50;

    const bookingStatusMap = new Map(bookingRows.map((b) => [b.time_slot, b.status]));
    const blockedSlotSet = new Set(blockRows.map((b) => b.time_slot));

    const rateMap = new Map(
      rateRows.filter((r) => r.day_type === dayType).map((r) => [r.time_slot, r.price_rupiah]),
    );

    const slots: SlotOptionItem[] = TIME_SLOTS.map((slot) => {
      const hour = parseInt(slot.split(":")[0] ?? "0", 10);
      const hasPhotoPromo = hour >= 16;

      let defaultPrice = 200_000;
      if (dayType === "weekday") {
        defaultPrice = hour < 16 ? 200_000 : hour < 18 ? 300_000 : 400_000;
      } else {
        defaultPrice = hour < 16 ? 200_000 : hour < 18 ? 350_000 : 450_000;
      }

      const price = rateMap.get(slot) ?? defaultPrice;
      const priceFormatted = formatter.format(price);

      if (isPastSlot(date, slot, now)) {
        return {
          slot,
          status: "past",
          statusLabel: "Sudah Lewat",
          selectable: false,
          price,
          priceFormatted,
          hasPhotoPromo,
        };
      }

      if (blockedSlotSet.has(slot)) {
        return {
          slot,
          status: "blocked",
          statusLabel: "Diblokir Admin",
          selectable: false,
          price,
          priceFormatted,
          hasPhotoPromo,
        };
      }

      const bStatus = bookingStatusMap.get(slot);
      if (bStatus === "confirmed") {
        return {
          slot,
          status: "confirmed",
          statusLabel: "Terisi (Confirmed)",
          selectable: false,
          price,
          priceFormatted,
          hasPhotoPromo,
        };
      }

      if (bStatus === "pending") {
        return {
          slot,
          status: "pending",
          statusLabel: "Pending (Menunggu DP)",
          selectable: false,
          price,
          priceFormatted,
          hasPhotoPromo,
        };
      }

      return {
        slot,
        status: "available",
        statusLabel: "Tersedia",
        selectable: true,
        price,
        priceFormatted,
        hasPhotoPromo,
      };
    });

    return {
      date,
      dayType,
      isHoliday,
      holidayLabel,
      dpPercent,
      slots,
    };
  } catch (error) {
    console.error("[queries] getSlotAvailabilityForDate failed:", error);
    return {
      date,
      dayType: "weekday",
      isHoliday: false,
      holidayLabel: null,
      dpPercent: 50,
      slots: TIME_SLOTS.map((slot) => ({
        slot,
        status: "available",
        statusLabel: "Tersedia",
        selectable: true,
        price: 200_000,
        priceFormatted: formatter.format(200_000),
        hasPhotoPromo: parseInt(slot.split(":")[0] ?? "0", 10) >= 16,
      })),
    };
  }
}

export async function updateBooking(
  id: string,
  data: {
    team_name: string;
    phone: string;
    notes?: string | null;
  },
): Promise<{ success: boolean; error?: string }> {
  const normalisedPhone = normalisePhone(data.phone);
  if (!normalisedPhone) {
    return { success: false, error: "Nomor WhatsApp tidak valid." };
  }

  try {
    const result = await sql`
      update bookings
      set team_name = ${data.team_name},
          phone = ${normalisedPhone},
          notes = ${data.notes ?? null}
      where id = ${id}
      returning id
    `;

    if (result.length === 0) {
      return { success: false, error: "Booking tidak ditemukan." };
    }

    return { success: true };
  } catch (error) {
    console.error("[queries] updateBooking failed:", error);
    return { success: false, error: "Gagal memperbarui data booking." };
  }
}

export async function getDashboardMetrics(): Promise<{
  pendingCount: number;
  todayActiveCount: number;
  monthTotalCount: number;
  oldestPendingCreatedAt: string | null;
}> {
  const today = todayAtField();
  const firstDayOfMonth = today.slice(0, 7) + "-01";

  try {
    // 1. Pending count and oldest created_at
    const pendingRows = await sql<Array<{ count: string; oldest: string | null }>>`
      select
        count(*)::text as count,
        min(created_at)::text as oldest
      from bookings
      where status = 'pending'
    `;

    // 2. Today's active bookings count
    const todayRows = await sql<Array<{ count: string }>>`
      select
        count(*)::text as count
      from bookings
      where booking_date = ${today}
        and status in ('pending', 'confirmed')
    `;

    // 3. Month total active bookings count
    const monthRows = await sql<Array<{ count: string }>>`
      select
        count(*)::text as count
      from bookings
      where booking_date >= ${firstDayOfMonth}
        and status in ('pending', 'confirmed')
    `;

    return {
      pendingCount: Number(pendingRows[0]?.count ?? 0),
      oldestPendingCreatedAt: pendingRows[0]?.oldest ?? null,
      todayActiveCount: Number(todayRows[0]?.count ?? 0),
      monthTotalCount: Number(monthRows[0]?.count ?? 0),
    };
  } catch (error) {
    console.error("[queries] getDashboardMetrics failed:", error);
    return {
      pendingCount: 0,
      todayActiveCount: 0,
      monthTotalCount: 0,
      oldestPendingCreatedAt: null,
    };
  }
}

export type SlotBlockRow = {
  id: string;
  block_date: string;
  time_slot: TimeSlot;
  reason: string | null;
  created_at: string;
  total_count?: number;
};

export type ListSlotBlocksParams = {
  from?: string | null;
  to?: string | null;
  q?: string | null;
  sort?: "date" | "reason" | "created";
  dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
  fromDate?: string | null;
};

export async function listSlotBlocks(
  params?: ListSlotBlocksParams,
): Promise<{ rows: SlotBlockRow[]; totalCount: number }> {
  const from = params?.from ?? params?.fromDate ?? null;
  const to = params?.to ?? null;
  const q = params?.q?.trim() || null;
  const sort = params?.sort ?? "date";
  const dir = params?.dir ?? "asc";
  const limit = params?.limit ?? 25;
  const offset = params?.offset ?? 0;

  try {
    const rows = await sql<SlotBlockRow[]>`
      select
        id,
        block_date::text as block_date,
        time_slot,
        reason,
        created_at::text as created_at,
        count(*) over ()::int as total_count
      from slot_blocks
      where (${from}::date is null or block_date >= ${from}::date)
        and (${to}::date is null or block_date <= ${to}::date)
        and (
          ${q}::text is null
          or reason ilike '%' || ${q} || '%'
          or time_slot ilike '%' || ${q} || '%'
        )
      order by
        case when ${sort} = 'date' and ${dir} = 'asc' then block_date end asc,
        case when ${sort} = 'date' and ${dir} = 'asc' then time_slot end asc,
        case when ${sort} = 'date' and ${dir} = 'desc' then block_date end desc,
        case when ${sort} = 'date' and ${dir} = 'desc' then time_slot end desc,
        case when ${sort} = 'reason' and ${dir} = 'asc' then reason end asc,
        case when ${sort} = 'reason' and ${dir} = 'desc' then reason end desc,
        case when ${sort} = 'created' and ${dir} = 'asc' then created_at end asc,
        case when ${sort} = 'created' and ${dir} = 'desc' then created_at end desc
      limit ${limit}
      offset ${offset}
    `;

    const totalCount = rows.length > 0 && rows[0].total_count ? Number(rows[0].total_count) : 0;
    return { rows, totalCount };
  } catch (error) {
    console.error("[queries] listSlotBlocks failed:", error);
    return { rows: [], totalCount: 0 };
  }
}

export async function createSlotBlock(data: {
  block_date: string;
  time_slot: string;
  reason?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const rows = await sql<Array<{ id: string }>>`
      insert into slot_blocks (
        block_date,
        time_slot,
        reason
      ) values (
        ${data.block_date},
        ${data.time_slot},
        ${data.reason ?? null}
      )
      returning id
    `;
    if (rows.length === 0) {
      return { success: false, error: "Gagal menyimpan pemblokiran slot." };
    }
    return { success: true };
  } catch (error: unknown) {
    const pgError = error as { code?: string };
    if (pgError?.code === "23505") {
      // 23505: unique_violation on uniq_slot_block
      return {
        success: false,
        error: "Slot pada tanggal dan jam tersebut sudah diblokir sebelumnya.",
      };
    }
    console.error("[queries] createSlotBlock failed:", error);
    return { success: false, error: "Terjadi kesalahan saat memblokir slot." };
  }
}

export async function deleteSlotBlock(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await sql`
      delete from slot_blocks
      where id = ${id}
      returning id
    `;
    if (result.length === 0) {
      return { success: false, error: "Data pemblokiran tidak ditemukan." };
    }
    return { success: true };
  } catch (error) {
    console.error("[queries] deleteSlotBlock failed:", error);
    return { success: false, error: "Gagal membuka blokir slot." };
  }
}

export type StatsSummary = {
  statusBreakdown: Record<BookingStatus, number>;
  totalAllTime: number;
  popularSlots: Array<{ time_slot: string; count: number }>;
  recentDays: Array<{ date: string; confirmedCount: number; pendingCount: number }>;
};

export async function getStatsData(): Promise<StatsSummary> {
  const today = todayAtField();

  try {
    // 1. Status breakdown
    const statusRows = await sql<Array<{ status: BookingStatus; count: string }>>`
      select
        status,
        count(*)::text as count
      from bookings
      group by status
    `;

    const statusBreakdown: Record<BookingStatus, number> = {
      pending: 0,
      confirmed: 0,
      rejected: 0,
      expired: 0,
    };

    let totalAllTime = 0;
    for (const r of statusRows) {
      const c = Number(r.count || 0);
      statusBreakdown[r.status] = c;
      totalAllTime += c;
    }

    // 2. Popular slots (confirmed + pending)
    const slotRows = await sql<Array<{ time_slot: string; count: string }>>`
      select
        time_slot,
        count(*)::text as count
      from bookings
      where status in ('confirmed', 'pending')
      group by time_slot
      order by count(*) desc
      limit 6
    `;

    const popularSlots = slotRows.map((r) => ({
      time_slot: r.time_slot,
      count: Number(r.count || 0),
    }));

    // 3. Next 7 days breakdown
    const dailyRows = await sql<
      Array<{ booking_date: string; status: BookingStatus; count: string }>
    >`
      select
        booking_date::text as booking_date,
        status,
        count(*)::text as count
      from bookings
      where booking_date >= ${today}
        and status in ('confirmed', 'pending')
      group by booking_date, status
      order by booking_date asc
    `;

    const dayMap = new Map<string, { confirmedCount: number; pendingCount: number }>();
    for (const r of dailyRows) {
      if (!dayMap.has(r.booking_date)) {
        dayMap.set(r.booking_date, { confirmedCount: 0, pendingCount: 0 });
      }
      const entry = dayMap.get(r.booking_date)!;
      if (r.status === "confirmed") {
        entry.confirmedCount += Number(r.count || 0);
      } else if (r.status === "pending") {
        entry.pendingCount += Number(r.count || 0);
      }
    }

    const recentDays: Array<{ date: string; confirmedCount: number; pendingCount: number }> = [];
    dayMap.forEach((val, date) => {
      recentDays.push({
        date,
        confirmedCount: val.confirmedCount,
        pendingCount: val.pendingCount,
      });
    });

    return {
      statusBreakdown,
      totalAllTime,
      popularSlots,
      recentDays: recentDays.slice(0, 7),
    };
  } catch (error) {
    console.error("[queries] getStatsData failed:", error);
    return {
      statusBreakdown: { pending: 0, confirmed: 0, rejected: 0, expired: 0 },
      totalAllTime: 0,
      popularSlots: [],
      recentDays: [],
    };
  }
}

export type SiteSettingsMap = {
  whatsapp_number: string;
  address: string;
  operating_hours: string;
  maps_embed_url: string;
  dp_percent: string;
};

export async function getSiteSettings(): Promise<SiteSettingsMap> {
  const defaults: SiteSettingsMap = {
    whatsapp_number: "6289682620666",
    address: "",
    operating_hours: "06.00–24.00 WITA",
    maps_embed_url: "",
    dp_percent: "50",
  };

  try {
    const rows = await sql<Array<{ key: string; value: string }>>`
      select key, value from site_settings
    `;
    for (const r of rows) {
      if (r.key in defaults) {
        defaults[r.key as keyof SiteSettingsMap] = r.value;
      }
    }
    return defaults;
  } catch (error) {
    console.error("[queries] getSiteSettings fallback to defaults:", error);
    return defaults;
  }
}

export async function updateSiteSetting(
  key: string,
  value: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await sql`
      insert into site_settings (key, value, updated_at)
      values (${key}, ${value}, now())
      on conflict (key) do update
      set value = ${value}, updated_at = now()
    `;
    return { success: true };
  } catch (error) {
    console.error(`[queries] updateSiteSetting failed for ${key}:`, error);
    return { success: false, error: "Gagal menyimpan pengaturan." };
  }
}

export type BankAccountRow = {
  id: string;
  bank: string;
  account_number: string;
  account_holder: string;
  sort_order: number;
  is_active: boolean;
  total_count?: number;
};

export type ListBankAccountsParams = {
  q?: string | null;
  status?: "all" | "active" | "inactive";
  sort?: "bank" | "holder" | "number" | "status" | "order";
  dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

export async function getBankAccounts(
  params?: ListBankAccountsParams,
): Promise<{ rows: BankAccountRow[]; totalCount: number }> {
  const q = params?.q?.trim() || null;
  const status = params?.status ?? "all";
  const sort = params?.sort ?? "order";
  const dir = params?.dir ?? "asc";
  const limit = params?.limit ?? 25;
  const offset = params?.offset ?? 0;

  try {
    const rows = await sql<BankAccountRow[]>`
      select 
        id, 
        bank, 
        account_number, 
        account_holder, 
        sort_order, 
        coalesce(is_active, true) as is_active,
        count(*) over ()::int as total_count
      from bank_accounts
      where (
        ${status} = 'all'
        or (${status} = 'active' and coalesce(is_active, true) = true)
        or (${status} = 'inactive' and coalesce(is_active, true) = false)
      )
      and (
        ${q}::text is null
        or bank ilike '%' || ${q} || '%'
        or account_number ilike '%' || ${q} || '%'
        or account_holder ilike '%' || ${q} || '%'
      )
      order by
        case when ${sort} = 'bank' and ${dir} = 'asc' then bank end asc,
        case when ${sort} = 'bank' and ${dir} = 'desc' then bank end desc,
        case when ${sort} = 'holder' and ${dir} = 'asc' then account_holder end asc,
        case when ${sort} = 'holder' and ${dir} = 'desc' then account_holder end desc,
        case when ${sort} = 'number' and ${dir} = 'asc' then account_number end asc,
        case when ${sort} = 'number' and ${dir} = 'desc' then account_number end desc,
        case when ${sort} = 'status' and ${dir} = 'asc' then is_active end asc,
        case when ${sort} = 'status' and ${dir} = 'desc' then is_active end desc,
        case when ${sort} = 'order' and ${dir} = 'asc' then sort_order end asc,
        case when ${sort} = 'order' and ${dir} = 'desc' then sort_order end desc,
        created_at asc
      limit ${limit}
      offset ${offset}
    `;
    const totalCount = rows.length > 0 && rows[0].total_count ? Number(rows[0].total_count) : 0;
    return { rows, totalCount };
  } catch (error) {
    console.error("[queries] getBankAccounts failed:", error);
    return { rows: [], totalCount: 0 };
  }
}

export async function createBankAccount(data: {
  bank: string;
  account_number: string;
  account_holder: string;
  is_active?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const isActive = data.is_active ?? true;
    await sql`
      insert into bank_accounts (bank, account_number, account_holder, is_active, sort_order)
      select 
        ${data.bank}, 
        ${data.account_number}, 
        ${data.account_holder}, 
        ${isActive}, 
        coalesce(max(sort_order), 0) + 1
      from bank_accounts
    `;
    return { success: true };
  } catch (error) {
    console.error("[queries] createBankAccount failed:", error);
    return { success: false, error: "Gagal menambahkan rekening bank." };
  }
}

export async function updateBankAccount(
  id: string,
  data: {
    bank: string;
    account_number: string;
    account_holder: string;
    is_active?: boolean;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    await sql`
      update bank_accounts
      set
        bank = ${data.bank},
        account_number = ${data.account_number},
        account_holder = ${data.account_holder},
        is_active = coalesce(${data.is_active ?? null}, is_active)
      where id = ${id}
    `;
    return { success: true };
  } catch (error) {
    console.error("[queries] updateBankAccount failed:", error);
    return { success: false, error: "Gagal memperbarui rekening bank." };
  }
}

export async function toggleBankAccountStatus(
  id: string,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    await sql`
      update bank_accounts
      set is_active = ${isActive}
      where id = ${id}
    `;
    return { success: true };
  } catch (error) {
    console.error("[queries] toggleBankAccountStatus failed:", error);
    return { success: false, error: "Gagal mengubah status aktif rekening bank." };
  }
}

export async function deleteBankAccount(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await sql`delete from bank_accounts where id = ${id}`;
    return { success: true };
  } catch (error) {
    console.error("[queries] deleteBankAccount failed:", error);
    return { success: false, error: "Gagal menghapus rekening bank." };
  }
}

export type RateCardRow = {
  time_slot: TimeSlot;
  day_type: "weekday" | "weekend";
  price_rupiah: number;
};

export async function getRateCard(): Promise<RateCardRow[]> {
  try {
    const rows = await sql<RateCardRow[]>`
      select time_slot, day_type, price_rupiah
      from rate_card
      order by time_slot asc, day_type asc
    `;
    return rows;
  } catch (error) {
    console.error("[queries] getRateCard failed:", error);
    return [];
  }
}

export async function upsertRatePrice(
  timeSlot: string,
  dayType: "weekday" | "weekend",
  priceRupiah: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await sql`
      insert into rate_card (time_slot, day_type, price_rupiah, updated_at)
      values (${timeSlot}, ${dayType}, ${priceRupiah}, now())
      on conflict (time_slot, day_type) do update
      set price_rupiah = ${priceRupiah}, updated_at = now()
    `;
    return { success: true };
  } catch (error) {
    console.error("[queries] upsertRatePrice failed:", error);
    return { success: false, error: "Gagal menyimpan harga slot." };
  }
}

export type PublicHolidayRow = {
  id: string;
  holiday_date: string;
  label: string;
  total_count?: number;
};

export type ListPublicHolidaysParams = {
  from?: string | null;
  to?: string | null;
  q?: string | null;
  sort?: "date" | "label";
  dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

export async function getPublicHolidays(
  params?: ListPublicHolidaysParams,
): Promise<{ rows: PublicHolidayRow[]; totalCount: number }> {
  const from = params?.from ?? null;
  const to = params?.to ?? null;
  const q = params?.q?.trim() || null;
  const sort = params?.sort ?? "date";
  const dir = params?.dir ?? "asc";
  const limit = params?.limit ?? 25;
  const offset = params?.offset ?? 0;

  try {
    const rows = await sql<PublicHolidayRow[]>`
      select 
        id, 
        holiday_date::text as holiday_date, 
        label,
        count(*) over ()::int as total_count
      from public_holidays
      where (${from}::date is null or holiday_date >= ${from}::date)
        and (${to}::date is null or holiday_date <= ${to}::date)
        and (
          ${q}::text is null
          or label ilike '%' || ${q} || '%'
          or holiday_date::text ilike '%' || ${q} || '%'
        )
      order by
        case when ${sort} = 'date' and ${dir} = 'asc' then holiday_date end asc,
        case when ${sort} = 'date' and ${dir} = 'desc' then holiday_date end desc,
        case when ${sort} = 'label' and ${dir} = 'asc' then label end asc,
        case when ${sort} = 'label' and ${dir} = 'desc' then label end desc
      limit ${limit}
      offset ${offset}
    `;
    const totalCount = rows.length > 0 && rows[0].total_count ? Number(rows[0].total_count) : 0;
    return { rows, totalCount };
  } catch (error) {
    console.error("[queries] getPublicHolidays failed:", error);
    return { rows: [], totalCount: 0 };
  }
}

export async function addPublicHoliday(data: {
  holiday_date: string;
  label: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const rows = await sql<Array<{ id: string }>>`
      insert into public_holidays (holiday_date, label)
      values (${data.holiday_date}, ${data.label})
      returning id
    `;
    if (rows.length === 0) {
      return { success: false, error: "Gagal menambahkan hari libur." };
    }
    return { success: true };
  } catch (error: unknown) {
    const pgError = error as { code?: string };
    if (pgError?.code === "23505") {
      // 23505: unique_violation on public_holidays.holiday_date
      return { success: false, error: "Tanggal ini sudah terdaftar sebagai hari libur." };
    }
    console.error("[queries] addPublicHoliday failed:", error);
    return { success: false, error: "Gagal menambahkan hari libur." };
  }
}

export async function deletePublicHoliday(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await sql`
      delete from public_holidays
      where id = ${id}
      returning id
    `;
    if (result.length === 0) {
      return { success: false, error: "Data hari libur tidak ditemukan." };
    }
    return { success: true };
  } catch (error) {
    console.error("[queries] deletePublicHoliday failed:", error);
    return { success: false, error: "Gagal menghapus hari libur." };
  }
}
