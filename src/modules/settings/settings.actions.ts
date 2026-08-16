"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { normalisePhone } from "@/domain/phone";
import { createBankAccount, deleteBankAccount, updateSiteSetting } from "@/server/queries";

const generalSettingsSchema = z.object({
  whatsapp_number: z.string().min(1, "Nomor WhatsApp wajib diisi"),
  address: z.string().min(1, "Alamat lapangan wajib diisi"),
  maps_embed_url: z.string().optional().nullable(),
  dp_percent: z.string().regex(/^\d+$/, "Persentase DP harus berupa angka"),
});

export async function updateSiteSettingsAction(formData: FormData): Promise<void> {
  const raw = {
    whatsapp_number: formData.get("whatsapp_number"),
    address: formData.get("address"),
    maps_embed_url: formData.get("maps_embed_url") || "",
    dp_percent: formData.get("dp_percent") || "50",
  };

  const parsed = generalSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message ?? "Data pengaturan tidak valid.";
    redirect(`/settings?error=${encodeURIComponent(errorMsg)}`);
    return;
  }

  const normalisedWhatsApp = normalisePhone(parsed.data.whatsapp_number);
  if (!normalisedWhatsApp) {
    redirect("/settings?error=Format+nomor+WhatsApp+tidak+valid");
    return;
  }

  await updateSiteSetting("whatsapp_number", normalisedWhatsApp);
  await updateSiteSetting("address", parsed.data.address);
  await updateSiteSetting("maps_embed_url", parsed.data.maps_embed_url ?? "");
  await updateSiteSetting("dp_percent", parsed.data.dp_percent);

  revalidatePath("/settings");
  redirect("/settings?success=saved");
}

const bankAccountSchema = z.object({
  bank: z.string().min(1, "Nama bank wajib diisi").max(40),
  account_number: z.string().min(1, "Nomor rekening wajib diisi").max(40),
  account_holder: z.string().min(1, "Nama pemilik rekening wajib diisi").max(100),
  is_active: z.coerce.boolean().default(true),
});

export async function addBankAccountAction(formData: FormData): Promise<void> {
  const raw = {
    bank: formData.get("bank"),
    account_number: formData.get("account_number"),
    account_holder: formData.get("account_holder"),
    is_active: formData.get("is_active") === "true" || formData.get("is_active") === "on",
  };

  const parsed = bankAccountSchema.safeParse(raw);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message ?? "Data rekening tidak valid.";
    redirect(`/settings?error=${encodeURIComponent(errorMsg)}`);
    return;
  }

  const result = await createBankAccount(parsed.data);
  if (!result.success) {
    redirect(
      `/settings?error=${encodeURIComponent(result.error ?? "Gagal menambahkan rekening.")}`,
    );
    return;
  }

  revalidatePath("/settings");
  redirect("/settings?success=bank_added");
}

export async function updateBankAccountAction(formData: FormData): Promise<void> {
  const idRaw = formData.get("id");
  if (typeof idRaw !== "string" || !idRaw) {
    redirect("/settings");
    return;
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
    redirect(`/settings?error=${encodeURIComponent(errorMsg)}`);
    return;
  }

  const { updateBankAccount } = await import("@/server/queries");
  const result = await updateBankAccount(idRaw, parsed.data);
  if (!result.success) {
    redirect(
      `/settings?error=${encodeURIComponent(result.error ?? "Gagal memperbarui rekening.")}`,
    );
    return;
  }

  revalidatePath("/settings");
  redirect("/settings?success=bank_updated");
}

export async function toggleBankAccountStatusAction(formData: FormData): Promise<void> {
  const idRaw = formData.get("id");
  const isActiveRaw = formData.get("is_active");
  if (typeof idRaw !== "string" || !idRaw) {
    redirect("/settings");
    return;
  }

  const newStatus = isActiveRaw === "true";
  const { toggleBankAccountStatus } = await import("@/server/queries");
  const result = await toggleBankAccountStatus(idRaw, newStatus);
  if (!result.success) {
    redirect(
      `/settings?error=${encodeURIComponent(result.error ?? "Gagal mengubah status rekening.")}`,
    );
    return;
  }

  revalidatePath("/settings");
  redirect("/settings?success=bank_updated");
}

export async function deleteBankAccountAction(formData: FormData): Promise<void> {
  const idRaw = formData.get("id");
  if (typeof idRaw !== "string" || !idRaw) {
    redirect("/settings");
    return;
  }

  const result = await deleteBankAccount(idRaw);
  if (!result.success) {
    redirect(`/settings?error=${encodeURIComponent(result.error ?? "Gagal menghapus rekening.")}`);
    return;
  }

  revalidatePath("/settings");
  redirect("/settings?success=bank_deleted");
}
