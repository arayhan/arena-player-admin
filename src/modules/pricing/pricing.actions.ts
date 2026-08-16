"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isBookingDateString } from "@/domain/dates";
import { isTimeSlot } from "@/domain/slots";
import { addPublicHoliday, deletePublicHoliday, upsertRatePrice } from "@/server/queries";

// ONE FORM PER SLOT, BOTH DAY TYPES AT ONCE — not one form per (slot,
// day_type) pair. Eighteen forms on the page instead of thirty-six is the
// point: the admin edits a slot's whole row (weekday and weekend price
// together, the way the pricelist itself presents them) and hits Simpan
// once, rather than two separate saves that can be half-applied if they
// only remember to click one.
const rateRowSchema = z.object({
  time_slot: z.string().refine(isTimeSlot, { message: "Slot waktu tidak valid" }),
  price_weekday: z.coerce
    .number()
    .int("Harga weekday harus bilangan bulat")
    .positive("Harga weekday harus lebih dari 0"),
  price_weekend: z.coerce
    .number()
    .int("Harga weekend harus bilangan bulat")
    .positive("Harga weekend harus lebih dari 0"),
});

export async function updateRatePriceAction(formData: FormData): Promise<void> {
  const raw = {
    time_slot: formData.get("time_slot"),
    price_weekday: formData.get("price_weekday"),
    price_weekend: formData.get("price_weekend"),
  };

  const parsed = rateRowSchema.safeParse(raw);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message ?? "Data harga tidak valid.";
    redirect(`/pricing?error=${encodeURIComponent(errorMsg)}`);
    return;
  }

  const weekdayResult = await upsertRatePrice(
    parsed.data.time_slot,
    "weekday",
    parsed.data.price_weekday,
  );
  if (!weekdayResult.success) {
    redirect(
      `/pricing?error=${encodeURIComponent(weekdayResult.error ?? "Gagal menyimpan harga weekday.")}`,
    );
    return;
  }

  const weekendResult = await upsertRatePrice(
    parsed.data.time_slot,
    "weekend",
    parsed.data.price_weekend,
  );
  if (!weekendResult.success) {
    // Weekday already saved at this point — not rolled back. Both writes
    // are independent upserts on independent rows (uniq_rate_card_slot is
    // per time_slot+day_type, not per time_slot), so a partial save leaves
    // the weekday price correctly updated rather than reverted; the error
    // names which half still needs a retry instead of claiming nothing saved.
    redirect(
      `/pricing?error=${encodeURIComponent(`Harga weekday tersimpan, tapi harga weekend gagal: ${weekendResult.error ?? "kesalahan tidak diketahui"}.`)}`,
    );
    return;
  }

  revalidatePath("/pricing");
  redirect("/pricing?success=price_saved");
}

const publicHolidaySchema = z.object({
  holiday_date: z.string().refine(isBookingDateString, {
    message: "Format tanggal harus YYYY-MM-DD",
  }),
  label: z.string().trim().min(1, "Nama hari libur wajib diisi").max(100),
});

export async function addPublicHolidayAction(formData: FormData): Promise<void> {
  const raw = {
    holiday_date: formData.get("holiday_date"),
    label: formData.get("label"),
  };

  const parsed = publicHolidaySchema.safeParse(raw);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message ?? "Data hari libur tidak valid.";
    redirect(`/pricing?error=${encodeURIComponent(errorMsg)}`);
    return;
  }

  const result = await addPublicHoliday(parsed.data);
  if (!result.success) {
    redirect(
      `/pricing?error=${encodeURIComponent(result.error ?? "Gagal menambahkan hari libur.")}`,
    );
    return;
  }

  revalidatePath("/pricing");
  redirect("/pricing?success=holiday_added");
}

export async function deletePublicHolidayAction(formData: FormData): Promise<void> {
  const idRaw = formData.get("id");
  if (typeof idRaw !== "string" || !idRaw) {
    redirect("/pricing");
    return;
  }

  const result = await deletePublicHoliday(idRaw);
  if (!result.success) {
    redirect(`/pricing?error=${encodeURIComponent(result.error ?? "Gagal menghapus hari libur.")}`);
    return;
  }

  revalidatePath("/pricing");
  redirect("/pricing?success=holiday_deleted");
}
