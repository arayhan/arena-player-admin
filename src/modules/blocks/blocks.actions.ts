"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isBookingDateString } from "@/domain/dates";
import { isTimeSlot } from "@/domain/slots";
import { createSlotBlock, deleteSlotBlock } from "@/server/queries";

const blockSlotSchema = z.object({
  block_date: z.string().refine(isBookingDateString, {
    message: "Format tanggal harus YYYY-MM-DD",
  }),
  time_slot: z.string().refine(isTimeSlot, {
    message: "Pilihan slot waktu tidak valid",
  }),
  reason: z.string().trim().max(200, "Alasan maksimal 200 karakter").optional().nullable(),
});

export async function blockSlotAction(formData: FormData): Promise<void> {
  const raw = {
    block_date: formData.get("block_date"),
    time_slot: formData.get("time_slot"),
    reason: formData.get("reason") || null,
  };

  const parsed = blockSlotSchema.safeParse(raw);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message ?? "Data blokir slot tidak valid.";
    redirect(`/blocks?error=${encodeURIComponent(errorMsg)}`);
    return;
  }

  const result = await createSlotBlock(parsed.data);
  if (!result.success) {
    redirect(`/blocks?error=${encodeURIComponent(result.error ?? "Gagal memblokir slot.")}`);
    return;
  }

  revalidatePath("/blocks");
  revalidatePath("/");
  redirect("/blocks?success=blocked");
}

export async function unblockSlotAction(formData: FormData): Promise<void> {
  const idRaw = formData.get("id");
  if (typeof idRaw !== "string" || !idRaw) {
    redirect("/blocks");
    return;
  }

  const result = await deleteSlotBlock(idRaw);
  if (!result.success) {
    redirect(`/blocks?error=${encodeURIComponent(result.error ?? "Gagal membuka blokir.")}`);
    return;
  }

  revalidatePath("/blocks");
  revalidatePath("/");
  redirect("/blocks?success=unblocked");
}
