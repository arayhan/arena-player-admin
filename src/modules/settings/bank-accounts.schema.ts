import { z } from "zod";

export const bankAccountsFilterSchema = z.object({
  q: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
  status: z
    .string()
    .optional()
    .transform((val): "all" | "active" | "inactive" => {
      if (val === "active" || val === "inactive" || val === "all") return val;
      return "all";
    }),
  sort: z
    .string()
    .optional()
    .transform((val): "bank" | "holder" | "number" | "status" | "order" => {
      if (
        val === "bank" ||
        val === "holder" ||
        val === "number" ||
        val === "status" ||
        val === "order"
      ) {
        return val;
      }
      return "order";
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

export type BankAccountsFilter = z.infer<typeof bankAccountsFilterSchema>;

export function parseBankAccountsFilter(
  raw: Record<string, string | string[] | undefined> | undefined,
): BankAccountsFilter {
  if (!raw) {
    return {
      q: null,
      status: "all",
      sort: "order",
      dir: "asc",
      page: 1,
      per_page: 10,
    };
  }

  const result = bankAccountsFilterSchema.safeParse(raw);
  if (!result.success) {
    return {
      q: null,
      status: "all",
      sort: "order",
      dir: "asc",
      page: 1,
      per_page: 10,
    };
  }

  return result.data;
}
