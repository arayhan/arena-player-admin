"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { normalisePhone } from "@/domain/phone";
import { createBankAccount, deleteBankAccount, updateSiteSetting } from "@/server/queries";

const generalSettingsSchema = z.object({
  whatsapp_number: z.string().trim().min(1, "Nomor WhatsApp wajib diisi"),
  address: z.string().trim().min(1, "Alamat lapangan wajib diisi"),
  maps_embed_url: z.string().trim().optional().nullable(),
  dp_percent: z.string().trim().regex(/^\d+$/, "Persentase DP harus berupa angka"),
});

export async function updateSiteSettingsAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const raw = {
    whatsapp_number: formData.get("whatsapp_number"),
    address: formData.get("address"),
    maps_embed_url: formData.get("maps_embed_url") || "",
    dp_percent: formData.get("dp_percent") || "50",
  };

  const parsed = generalSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message ?? "Data pengaturan tidak valid.";
    return { success: false, error: errorMsg };
  }

  const normalisedWhatsApp = normalisePhone(parsed.data.whatsapp_number);
  if (!normalisedWhatsApp) {
    return {
      success: false,
      error: "Format nomor WhatsApp tidak valid (contoh: 08123456789 atau 628123456789).",
    };
  }

  await updateSiteSetting("whatsapp_number", normalisedWhatsApp);
  await updateSiteSetting("address", parsed.data.address);
  await updateSiteSetting("maps_embed_url", parsed.data.maps_embed_url ?? "");
  await updateSiteSetting("dp_percent", parsed.data.dp_percent);

  revalidatePath("/settings");
  return { success: true };
}

const bankAccountSchema = z.object({
  bank: z.string().trim().min(1, "Nama bank wajib diisi").max(40, "Nama bank maksimal 40 karakter"),
  account_number: z
    .string()
    .trim()
    .min(1, "Nomor rekening wajib diisi")
    .max(40, "Nomor rekening maksimal 40 karakter"),
  account_holder: z
    .string()
    .trim()
    .min(1, "Nama pemilik rekening wajib diisi")
    .max(100, "Nama pemilik rekening maksimal 100 karakter"),
  is_active: z.coerce.boolean().default(true),
});

export async function addBankAccountAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const raw = {
    bank: formData.get("bank"),
    account_number: formData.get("account_number"),
    account_holder: formData.get("account_holder"),
    is_active: formData.get("is_active") === "true" || formData.get("is_active") === "on",
  };

  const parsed = bankAccountSchema.safeParse(raw);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message ?? "Data rekening tidak valid.";
    return { success: false, error: errorMsg };
  }

  const result = await createBankAccount(parsed.data);
  if (!result.success) {
    return { success: false, error: result.error ?? "Gagal menambahkan rekening." };
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function updateBankAccountAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const idRaw = formData.get("id");
  if (typeof idRaw !== "string" || !idRaw) {
    return { success: false, error: "ID rekening tidak valid." };
  }

  const raw = {
    bank: formData.get("bank"),
    account_number: formData.get("account_number"),
    account_holder: formData.get("account_holder"),
    is_active: formData.get("is_active") === "true" || formData.get("is_active") === "on",
  };

  const parsed = bankAccountSchema.safeParse(raw);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message ?? "Data rekening tidak valid.";
    return { success: false, error: errorMsg };
  }

  const { updateBankAccount } = await import("@/server/queries");
  const result = await updateBankAccount(idRaw, parsed.data);
  if (!result.success) {
    return { success: false, error: result.error ?? "Gagal memperbarui rekening." };
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function toggleBankAccountStatusAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const idRaw = formData.get("id");
  const isActiveRaw = formData.get("is_active");
  if (typeof idRaw !== "string" || !idRaw) {
    return { success: false, error: "ID rekening tidak valid." };
  }

  const newStatus = isActiveRaw === "true";
  const { toggleBankAccountStatus } = await import("@/server/queries");
  const result = await toggleBankAccountStatus(idRaw, newStatus);
  if (!result.success) {
    return { success: false, error: result.error ?? "Gagal mengubah status rekening." };
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function deleteBankAccountAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const idRaw = formData.get("id");
  if (typeof idRaw !== "string" || !idRaw) {
    return { success: false, error: "ID rekening tidak valid." };
  }

  const result = await deleteBankAccount(idRaw);
  if (!result.success) {
    return { success: false, error: result.error ?? "Gagal menghapus rekening." };
  }

  revalidatePath("/settings");
  return { success: true };
}
