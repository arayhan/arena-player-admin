import { z } from "zod";
import { isBookingDateString } from "@/domain/dates";

export const rateCardFilterSchema = z.object({
  q: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
  category: z
    .string()
    .optional()
    .transform((val): "all" | "morning" | "afternoon" | "night" | "photo" => {
      if (
        val === "morning" ||
        val === "afternoon" ||
        val === "night" ||
        val === "photo" ||
        val === "all"
      ) {
        return val;
      }
      return "all";
    }),
  sort: z
    .string()
    .optional()
    .transform((val): "slot" | "weekday" | "weekend" => {
      if (val === "weekday" || val === "weekend" || val === "slot") return val;
      return "slot";
    }),
  dir: z
    .string()
    .optional()
    .transform((val): "asc" | "desc" => {
      if (val === "desc" || val === "asc") return val;
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
  per_page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val): number => {
      if (!val) return 18;
      const parsed = Number(val);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : 18;
    }),
});

export type RateCardFilter = z.infer<typeof rateCardFilterSchema>;

export function parseRateCardFilter(
  raw: Record<string, string | string[] | undefined> | undefined,
): RateCardFilter {
  if (!raw) {
    return {
      q: null,
      category: "all",
      sort: "slot",
      dir: "asc",
      page: 1,
      per_page: 18,
    };
  }

  const result = rateCardFilterSchema.safeParse(raw);
  if (!result.success) {
    return {
      q: null,
      category: "all",
      sort: "slot",
      dir: "asc",
      page: 1,
      per_page: 18,
    };
  }

  return result.data;
}

export const holidaysFilterSchema = z.object({
  q: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
  from: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val === "all") return null;
      return isBookingDateString(val) ? val : null;
    }),
  to: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return null;
      return isBookingDateString(val) ? val : null;
    }),
  sort: z
    .string()
    .optional()
    .transform((val): "date" | "label" => {
      if (val === "label" || val === "date") return val;
      return "date";
    }),
  dir: z
    .string()
    .optional()
    .transform((val): "asc" | "desc" => {
      if (val === "desc" || val === "asc") return val;
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
  per_page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val): number => {
      if (!val) return 10;
      const parsed = Number(val);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : 10;
    }),
});

export type HolidaysFilter = z.infer<typeof holidaysFilterSchema>;

export function parseHolidaysFilter(
  raw: Record<string, string | string[] | undefined> | undefined,
): HolidaysFilter {
  if (!raw) {
    return {
      q: null,
      from: null,
      to: null,
      sort: "date",
      dir: "asc",
      page: 1,
      per_page: 10,
    };
  }

  const result = holidaysFilterSchema.safeParse(raw);
  if (!result.success) {
    return {
      q: null,
      from: null,
      to: null,
      sort: "date",
      dir: "asc",
      page: 1,
      per_page: 10,
    };
  }

  return result.data;
}
