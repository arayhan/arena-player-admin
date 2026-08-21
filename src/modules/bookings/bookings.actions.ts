"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  confirmBooking,
  createBooking,
  expireOldPendingBookings,
  getBookingById,
  rejectBooking,
  updateBooking,
} from "@/server/queries";
import { createBookingInputSchema, updateBookingInputSchema } from "./bookings.schema";

const uuidSchema = z.string().uuid();

export async function confirmBookingAction(formData: FormData): Promise<void> {
  const idRaw = formData.get("id");
  const returnUrlRaw = formData.get("returnUrl");
  const returnUrl =
    typeof returnUrlRaw === "string" && returnUrlRaw.startsWith("/") ? returnUrlRaw : null;
  const parsed = uuidSchema.safeParse(idRaw);

  if (!parsed.success) {
    redirect(returnUrl ?? "/bookings");
    return;
  }

  const id = parsed.data;
  const result = await confirmBooking(id);

  if (!result.success) {
    // 409 Conflict: Row was already actioned or status changed.
    // Fetch latest status to provide specific Indonesian copy.
    const current = await getBookingById(id);
    let message = "Booking ini sudah diproses.";
    if (current?.status === "confirmed") {
      message = "Booking ini sudah dikonfirmasi sebelumnya.";
    } else if (current?.status === "rejected") {
      message = "Booking ini sudah ditolak sebelumnya.";
    } else if (current?.status === "expired") {
      message = "Booking ini sudah kedaluwarsa.";
    }

    if (returnUrl) {
      const sep = returnUrl.includes("?") ? "&" : "?";
      redirect(`${returnUrl}${sep}conflict=${encodeURIComponent(message)}`);
      return;
    }

    redirect(`/bookings/${id}?conflict=${encodeURIComponent(message)}`);
    return;
  }

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${id}`);

  if (returnUrl) {
    const sep = returnUrl.includes("?") ? "&" : "?";
    redirect(`${returnUrl}${sep}success=confirmed`);
    return;
  }

  redirect(`/bookings/${id}?success=confirmed`);
}

export async function rejectBookingAction(formData: FormData): Promise<void> {
  const idRaw = formData.get("id");
  const returnUrlRaw = formData.get("returnUrl");
  const returnUrl =
    typeof returnUrlRaw === "string" && returnUrlRaw.startsWith("/") ? returnUrlRaw : null;
  const parsed = uuidSchema.safeParse(idRaw);

  if (!parsed.success) {
    redirect(returnUrl ?? "/bookings");
    return;
  }

  const id = parsed.data;
  const result = await rejectBooking(id);

  if (!result.success) {
    const current = await getBookingById(id);
    let message = "Booking ini tidak dapat ditolak pada status saat ini.";
    if (current?.status === "rejected") {
      message = "Booking ini sudah ditolak sebelumnya.";
    } else if (current?.status === "expired") {
      message = "Booking ini sudah kedaluwarsa.";
    }

    if (returnUrl) {
      const sep = returnUrl.includes("?") ? "&" : "?";
      redirect(`${returnUrl}${sep}conflict=${encodeURIComponent(message)}`);
      return;
    }

    redirect(`/bookings/${id}?conflict=${encodeURIComponent(message)}`);
    return;
  }

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${id}`);

  if (returnUrl) {
    const sep = returnUrl.includes("?") ? "&" : "?";
    redirect(`${returnUrl}${sep}success=rejected`);
    return;
  }

  redirect(`/bookings/${id}?success=rejected`);
}

export async function triggerManualExpiryAction(): Promise<{
  success: boolean;
  expiredCount: number;
}> {
  const { expiredCount } = await expireOldPendingBookings();

  revalidatePath("/");
  revalidatePath("/bookings");
  return { success: true, expiredCount };
}

export async function createBookingAction(formData: FormData): Promise<void> {
  const timeSlots = formData.getAll("time_slots");
  const timeSlotFallback = formData.get("time_slot");

  const raw = {
    booking_date: formData.get("booking_date"),
    time_slots:
      timeSlots.length > 0
        ? timeSlots.map(String)
        : typeof timeSlotFallback === "string" && timeSlotFallback
          ? [timeSlotFallback]
          : [],
    team_name: formData.get("team_name"),
    phone: formData.get("phone"),
    notes: formData.get("notes") || null,
    status: formData.get("status") || "confirmed",
  };

  const parsed = createBookingInputSchema.safeParse(raw);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message ?? "Data booking tidak valid.";
    redirect(`/bookings/new?error=${encodeURIComponent(errorMsg)}`);
    return;
  }

  const result = await createBooking({
    booking_date: parsed.data.booking_date,
    time_slots: parsed.data.time_slots,
    team_name: parsed.data.team_name,
    phone: parsed.data.phone,
    notes: parsed.data.notes,
    status: parsed.data.status,
  });

  if (!result.success) {
    redirect(`/bookings/new?error=${encodeURIComponent(result.error)}`);
    return;
  }

  revalidatePath("/");
  revalidatePath("/bookings");
  redirect(`/bookings/${result.id}?success=created`);
}

export async function updateBookingAction(formData: FormData): Promise<void> {
  const raw = {
    id: formData.get("id"),
    team_name: formData.get("team_name"),
    phone: formData.get("phone"),
    notes: formData.get("notes") || null,
  };

  const parsed = updateBookingInputSchema.safeParse(raw);
  if (!parsed.success) {
    const id = typeof raw.id === "string" ? raw.id : "";
    const errorMsg = parsed.error.issues[0]?.message ?? "Data booking tidak valid.";
    redirect(`/bookings/${id}?conflict=${encodeURIComponent(errorMsg)}`);
    return;
  }

  const result = await updateBooking(parsed.data.id, {
    team_name: parsed.data.team_name,
    phone: parsed.data.phone,
    notes: parsed.data.notes,
  });

  if (!result.success) {
    redirect(
      `/bookings/${parsed.data.id}?conflict=${encodeURIComponent(result.error ?? "Gagal memperbarui booking.")}`,
    );
    return;
  }

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${parsed.data.id}`);
  redirect(`/bookings/${parsed.data.id}?success=updated`);
}
