import { z } from "zod";

import { isBookingDateString, todayAtField } from "@/domain/dates";
import { BOOKING_STATUSES, type BookingStatus } from "@/domain/status";
import { SORTABLE, SORT_DIR, type SortDir, type SortKey } from "@/server/queries";

export const bookingsFilterSchema = z.object({
  status: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val): BookingStatus[] => {
      if (!val) return ["pending"];
      const arr = Array.isArray(val) ? val : [val];
      const valid = arr.filter((s): s is BookingStatus =>
        (BOOKING_STATUSES as readonly string[]).includes(s),
      );
      return valid.length > 0 ? valid : ["pending"];
    }),
  from: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val === "all") return null;
      return isBookingDateString(val) ? val : todayAtField();
    }),
  to: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return null;
      return isBookingDateString(val) ? val : null;
    }),
  q: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
  sort: z
    .string()
    .optional()
    .transform((val): SortKey => {
      if (val && val in SORTABLE) return val as SortKey;
      return "when";
    }),
  dir: z
    .string()
    .optional()
    .transform((val): SortDir => {
      if (val && val in SORT_DIR) return val as SortDir;
      return "asc";
    }),
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val): number => {
      if (!val) return 1;
      const parsed = Number(val);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
    }),
});

export type BookingsFilter = z.infer<typeof bookingsFilterSchema>;

export function parseBookingsFilter(
  raw: Record<string, string | string[] | undefined> | undefined,
): BookingsFilter {
  if (!raw) {
    return {
      status: ["pending"],
      from: todayAtField(),
      to: null,
      q: null,
      sort: "when",
      dir: "asc",
      page: 1,
    };
  }

  const result = bookingsFilterSchema.safeParse(raw);
  if (!result.success) {
    return {
      status: ["pending"],
      from: todayAtField(),
      to: null,
      q: null,
      sort: "when",
      dir: "asc",
      page: 1,
    };
  }

  return result.data;
}

export const createBookingInputSchema = z.object({
  booking_date: z.string().refine(isBookingDateString, {
    message: "Format tanggal harus YYYY-MM-DD",
  }),
  time_slot: z.string().min(1, "Pilihan slot waktu wajib diisi"),
  team_name: z
    .string()
    .trim()
    .min(1, "Nama tim / pemesan wajib diisi")
    .max(100, "Nama tim maksimal 100 karakter"),
  phone: z.string().trim().min(8, "Nomor WhatsApp wajib diisi"),
  notes: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional().nullable(),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
});

export type CreateBookingFormValues = z.infer<typeof createBookingInputSchema>;

export const updateBookingInputSchema = z.object({
  id: z.string().uuid("ID booking tidak valid"),
  team_name: z
    .string()
    .trim()
    .min(1, "Nama tim / pemesan wajib diisi")
    .max(100, "Nama tim maksimal 100 karakter"),
  phone: z.string().trim().min(8, "Nomor WhatsApp wajib diisi"),
  notes: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional().nullable(),
});

export type UpdateBookingFormValues = z.infer<typeof updateBookingInputSchema>;
