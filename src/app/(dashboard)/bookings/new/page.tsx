import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { todayAtField } from "@/domain/dates";
import { BookingCreateForm } from "@/modules/bookings/booking-create-form";
import { getSlotAvailabilityForDate } from "@/server/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tambah Booking Walk-in | Arena Player Admin",
  description:
    "Input pemesanan langsung di lapangan dengan pilihan multi-slot ketersediaan langsung.",
};

type Props = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function NewBookingPage({ searchParams }: Props) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const errorMessage = resolvedParams?.error ? decodeURIComponent(resolvedParams.error) : null;

  const today = todayAtField();
  const initialAvailability = await getSlotAvailabilityForDate(today);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Beranda", href: "/" },
          { label: "Booking", href: "/bookings" },
          { label: "Tambah Booking" },
        ]}
      />

      <BookingCreateForm initialAvailability={initialAvailability} errorMessage={errorMessage} />
    </div>
  );
}
