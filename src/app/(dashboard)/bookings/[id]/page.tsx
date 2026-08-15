import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { BookingDetail } from "@/modules/bookings/booking-detail";
import { getBookingById } from "@/server/queries";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conflict?: string; success?: string }>;
};

const uuidSchema = z.string().uuid();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return { title: "Booking Tidak Ditemukan | Arena Player Admin" };
  }

  const booking = await getBookingById(id);
  if (!booking) {
    return { title: "Booking Tidak Ditemukan | Arena Player Admin" };
  }

  return {
    title: `${booking.team_name} · ${booking.booking_date} | Arena Player Admin`,
    description: `Detail booking ${booking.team_name} tanggal ${booking.booking_date} slot ${booking.time_slot}.`,
  };
}

export default async function BookingDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const search = await searchParams;

  // Pre-validate UUID to prevent Postgres 22P02 invalid_text_representation 500 error
  if (!uuidSchema.safeParse(id).success) {
    notFound();
  }

  const booking = await getBookingById(id);
  if (!booking) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Beranda", href: "/" },
          { label: "Booking", href: "/bookings" },
          { label: booking.team_name },
        ]}
      />

      <BookingDetail
        booking={booking}
        conflictMessage={search.conflict ?? null}
        successMessage={search.success ?? null}
      />
    </div>
  );
}
