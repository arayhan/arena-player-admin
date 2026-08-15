const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export function formatBookingDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = Number(parts[1]) - 1;
  const day = Number(parts[2]);

  const monthName = MONTH_NAMES_SHORT[monthIdx] ?? parts[1];
  return `${day} ${monthName} ${year}`;
}

export function formatRelativeAge(createdAtStr: string, now: Date = new Date()): string {
  try {
    const created = new Date(createdAtStr);
    const diffMs = now.getTime() - created.getTime();
    if (diffMs < 0) return "Baru saja";

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return "Baru saja";
    if (diffMinutes < 60) return `${diffMinutes} mnt lalu`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hr lalu`;
  } catch {
    return createdAtStr;
  }
}
