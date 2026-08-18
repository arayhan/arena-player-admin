"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isBookingDateString } from "@/domain/dates";
import { isTimeSlot, TIME_SLOTS, type TimeSlot } from "@/domain/slots";
import { addPublicHoliday, deletePublicHoliday, upsertRatePrice } from "@/server/queries";

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
    redirect(
      `/pricing?error=${encodeURIComponent(`Harga weekday tersimpan, tapi harga weekend gagal: ${weekendResult.error ?? "kesalahan tidak diketahui"}.`)}`,
    );
    return;
  }

  revalidatePath("/pricing");
  redirect("/pricing?success=price_saved");
}

const tierUpdateSchema = z.object({
  tier: z.enum(["morning_afternoon", "afternoon_evening", "night"]),
  price_weekday: z.coerce.number().int().positive(),
  price_weekend: z.coerce.number().int().positive(),
});

export async function updateTierPricesAction(formData: FormData): Promise<void> {
  const raw = {
    tier: formData.get("tier"),
    price_weekday: formData.get("price_weekday"),
    price_weekend: formData.get("price_weekend"),
  };

  const parsed = tierUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/pricing?error=${encodeURIComponent("Data rentang harga tidak valid.")}`);
    return;
  }

  const { tier, price_weekday, price_weekend } = parsed.data;

  // Filter slots based on tier range
  let targetSlots: TimeSlot[];
  if (tier === "morning_afternoon") {
    // 06.00 - 16.00 (index 0 to 9)
    targetSlots = TIME_SLOTS.slice(0, 10) as TimeSlot[];
  } else if (tier === "afternoon_evening") {
    // 16.00 - 18.00 (index 10 to 11)
    targetSlots = TIME_SLOTS.slice(10, 12) as TimeSlot[];
  } else {
    // 18.00 - 24.00 (index 12 to 17)
    targetSlots = TIME_SLOTS.slice(12, 18) as TimeSlot[];
  }

  for (const slot of targetSlots) {
    await upsertRatePrice(slot, "weekday", price_weekday);
    await upsertRatePrice(slot, "weekend", price_weekend);
  }

  revalidatePath("/pricing");
  redirect("/pricing?success=tier_saved");
}

/**
 * Resets/syncs all 36 slot rates to the exact standard Pricelist Mini Soccer:
 * - 06:00 - 16:00: Weekday 200k, Weekend 200k
 * - 16:00 - 18:00: Weekday 300k, Weekend 350k
 * - 18:00 - 24:00: Weekday 400k, Weekend 450k
 */
export async function applyStandardPricelistAction(): Promise<void> {
  for (const slot of TIME_SLOTS) {
    const slotHour = parseInt(slot.split(":")[0] ?? "0", 10);
    let weekdayPrice = 200_000;
    let weekendPrice = 200_000;

    if (slotHour >= 6 && slotHour < 16) {
      weekdayPrice = 200_000;
      weekendPrice = 200_000;
    } else if (slotHour >= 16 && slotHour < 18) {
      weekdayPrice = 300_000;
      weekendPrice = 350_000;
    } else if (slotHour >= 18) {
      weekdayPrice = 400_000;
      weekendPrice = 450_000;
    }

    await upsertRatePrice(slot, "weekday", weekdayPrice);
    await upsertRatePrice(slot, "weekend", weekendPrice);
  }

  revalidatePath("/pricing");
  redirect("/pricing?success=standard_applied");
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
