import Link from "next/link";

export type SortableHeaderProps = {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  baseUrl: string;
  searchParams?: Record<string, string | string[] | undefined>;
  align?: "left" | "right" | "center";
  defaultDir?: "asc" | "desc";
  className?: string;
};

export function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  baseUrl,
  searchParams,
  align = "left",
  defaultDir = "asc",
  className = "",
}: SortableHeaderProps) {
  const isCurrentSort = currentSort === sortKey;
  const nextDir = isCurrentSort ? (currentDir === "asc" ? "desc" : "asc") : defaultDir;

  const params = new URLSearchParams();
  if (searchParams) {
    for (const [key, val] of Object.entries(searchParams)) {
      if (key === "sort" || key === "dir" || key === "page") continue;
      if (val === undefined || val === null || val === "") continue;
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item) params.append(key, item);
        }
      } else {
        params.append(key, val);
      }
    }
  }

  params.set("sort", sortKey);
  params.set("dir", nextDir);
  // Reset to page 1 on sort change
  const queryString = params.toString();
  const sortUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;

  const alignClass =
    align === "right"
      ? "justify-end text-right"
      : align === "center"
        ? "justify-center text-center"
        : "justify-start text-left";

  return (
    <Link
      href={sortUrl}
      title={`Urutkan berdasarkan ${label} (${isCurrentSort ? (currentDir === "asc" ? "Z-A / Menurun" : "A-Z / Menaik") : "Aktifkan"})`}
      className={`group inline-flex items-center gap-1.5 font-semibold transition-colors duration-150 hover:text-ink select-none ${alignClass} ${
        isCurrentSort ? "text-accent font-bold" : "text-ink-muted"
      } ${className}`}
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 items-center justify-center rounded transition-transform ${
          isCurrentSort ? "text-accent" : "text-ink-muted/40 group-hover:text-ink-muted"
        }`}
      >
        {isCurrentSort ? (
          currentDir === "asc" ? (
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 stroke-current stroke-2">
              <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 stroke-current stroke-2">
              <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 stroke-current stroke-2">
            <path
              d="M7 10l5-5 5 5M7 14l5 5 5-5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.6"
            />
          </svg>
        )}
      </span>
    </Link>
  );
}
