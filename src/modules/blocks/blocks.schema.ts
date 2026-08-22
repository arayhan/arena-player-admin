import { z } from "zod";
import { isBookingDateString } from "@/domain/dates";

export const blocksFilterSchema = z.object({
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
  q: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
  sort: z
    .string()
    .optional()
    .transform((val): "date" | "reason" | "created" => {
      if (val === "reason" || val === "created" || val === "date") return val;
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
      if (!val) return 25;
      const parsed = Number(val);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : 25;
    }),
});

export type BlocksFilter = z.infer<typeof blocksFilterSchema>;

export function parseBlocksFilter(
  raw: Record<string, string | string[] | undefined> | undefined,
): BlocksFilter {
  if (!raw) {
    return {
      from: null,
      to: null,
      q: null,
      sort: "date",
      dir: "asc",
      page: 1,
      per_page: 25,
    };
  }

  const result = blocksFilterSchema.safeParse(raw);
  if (!result.success) {
    return {
      from: null,
      to: null,
      q: null,
      sort: "date",
      dir: "asc",
      page: 1,
      per_page: 25,
    };
  }

  return result.data;
}
