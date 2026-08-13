import type { BookingStatus } from "@/domain/status";

// Lookup objects keyed by the four database states — never a conditional
// class expression. docs/architecture.md rejects clsx/tailwind-merge by
// name and names this exact case: a status pill is a surface + border +
// ink triple per DESIGN.md, not a hue picked by an if/else chain.
// `Record<BookingStatus, string>` itself enforces exhaustiveness against
// src/domain/status.ts — a status added or removed there is a compile
// error here, not a silently unstyled pill.

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Menunggu",
  confirmed: "Dikonfirmasi",
  rejected: "Ditolak",
  expired: "Kedaluwarsa",
};

const STATUS_CLASSES: Record<BookingStatus, string> = {
  pending: "bg-amber-bg border-amber-border text-amber-ink",
  confirmed: "bg-green-bg border-green-border text-green-ink",
  rejected: "bg-red-bg border-red-border text-red-ink",
  expired: "bg-grey-bg border-grey-border text-grey-ink",
};

export function StatusPill({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-control border px-2 py-0.5 text-xs font-semibold ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
