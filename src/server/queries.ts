import "server-only";

import { sql } from "@/server/db";
import type { BookingStatus } from "@/domain/status";
import type { TimeSlot } from "@/domain/slots";
import { normalisePhone } from "@/domain/phone";
import { todayAtField } from "@/domain/dates";

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

export type CreateBookingInput = {
  booking_date: string;
  time_slot: string;
  team_name: string;
  phone: string;
  notes?: string | null;
  status?: "pending" | "confirmed";
};

export type CreateBookingResult =
  | { success: true; id: string }
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

  const status = data.status ?? "confirmed";

  try {
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
        ${data.time_slot},
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
        error: "Gagal membuat booking baru.",
        code: "UNKNOWN",
      };
    }

    return {
      success: true,
      id: rows[0].id,
    };
  } catch (error: unknown) {
    const pgError = error as { code?: string; message?: string };
    if (pgError?.code === "23505") {
      // 23505: unique_violation on uniq_active_slot
      return {
        success: false,
        error: "Slot pada tanggal dan jam tersebut sudah terisi.",
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
};

export async function listSlotBlocks(params?: {
  fromDate?: string | null;
}): Promise<SlotBlockRow[]> {
  const fromDate = params?.fromDate ?? todayAtField();
  try {
    const rows = await sql<SlotBlockRow[]>`
      select
        id,
        block_date::text as block_date,
        time_slot,
        reason,
        created_at::text as created_at
      from slot_blocks
      where block_date >= ${fromDate}
      order by block_date asc, time_slot asc
    `;
    return rows;
  } catch (error) {
    console.error("[queries] listSlotBlocks failed:", error);
    return [];
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
  maps_embed_url: string;
  dp_percent: string;
};

export async function getSiteSettings(): Promise<SiteSettingsMap> {
  // `address` DEFAULTS TO EMPTY, NEVER A PLAUSIBLE-LOOKING PLACEHOLDER. This
  // field used to default to an invented street address ("Jl. Lapangan
  // Futsal Arena No. 1, Lombok") — never supplied by the client, seeded into
  // the live database by an out-of-band script (deleted 2026-08-17) and
  // duplicated right here as a fallback. Same defect, quieter: the DB row
  // has since been corrected, but this constant would have reintroduced the
  // fabrication on the very next moment the table was briefly unreachable.
  // An empty string renders as the settings page's own "required" gap, which
  // is the missing-data state PRODUCT.md asks for — not a fact nobody gave.
  const defaults: SiteSettingsMap = {
    whatsapp_number: "6289682620666",
    address: "",
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
};

export async function getBankAccounts(): Promise<BankAccountRow[]> {
  try {
    const rows = await sql<BankAccountRow[]>`
      select id, bank, account_number, account_holder, sort_order, coalesce(is_active, true) as is_active
      from bank_accounts
      order by sort_order asc, created_at asc
    `;
    return rows;
  } catch (error) {
    console.error("[queries] getBankAccounts failed:", error);
    return [];
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
};

export async function getPublicHolidays(): Promise<PublicHolidayRow[]> {
  try {
    const rows = await sql<PublicHolidayRow[]>`
      select id, holiday_date::text as holiday_date, label
      from public_holidays
      order by holiday_date asc
    `;
    return rows;
  } catch (error) {
    console.error("[queries] getPublicHolidays failed:", error);
    return [];
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
