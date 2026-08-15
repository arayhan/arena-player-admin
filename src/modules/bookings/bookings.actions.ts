"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { confirmBooking, getBookingById, rejectBooking } from "@/server/queries";

const uuidSchema = z.string().uuid();

export async function confirmBookingAction(formData: FormData): Promise<void> {
  const idRaw = formData.get("id");
  const parsed = uuidSchema.safeParse(idRaw);

  if (!parsed.success) {
    redirect("/bookings");
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

    redirect(`/bookings/${id}?conflict=${encodeURIComponent(message)}`);
    return;
  }

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${id}`);
  redirect(`/bookings/${id}?success=confirmed`);
}

export async function rejectBookingAction(formData: FormData): Promise<void> {
  const idRaw = formData.get("id");
  const parsed = uuidSchema.safeParse(idRaw);

  if (!parsed.success) {
    redirect("/bookings");
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

    redirect(`/bookings/${id}?conflict=${encodeURIComponent(message)}`);
    return;
  }

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${id}`);
  redirect(`/bookings/${id}?success=rejected`);
}

export async function triggerManualExpiryAction(): Promise<void> {
  const { expireOldPendingBookings } = await import("@/server/queries");
  const { expiredCount } = await expireOldPendingBookings();

  revalidatePath("/");
  revalidatePath("/bookings");
  redirect(`/?expired=${expiredCount}`);
}
