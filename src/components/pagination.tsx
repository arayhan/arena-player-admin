import Link from "next/link";

export type PaginationProps = {
  page: number;
  perPage: number;
  totalCount: number;
  baseUrl: string;
  searchParams?: Record<string, string | string[] | undefined>;
  perPageOptions?: number[];
};

export function buildPageUrl(
  baseUrl: string,
  searchParams: Record<string, string | string[] | undefined> | undefined,
  overrides: { page?: number; per_page?: number },
): string {
  const params = new URLSearchParams();

  if (searchParams) {
    for (const [key, val] of Object.entries(searchParams)) {
      if (key === "page" || key === "per_page") continue;
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

  const targetPage = overrides.page ?? 1;
  const targetPerPage = overrides.per_page;

  if (targetPage > 1) {
    params.set("page", String(targetPage));
  }
  if (targetPerPage && targetPerPage > 0) {
    params.set("per_page", String(targetPerPage));
  }

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

export function Pagination({
  page,
  perPage,
  totalCount,
  baseUrl,
  searchParams,
  perPageOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  if (totalCount === 0) return null;

  const startRecord = (currentPage - 1) * perPage + 1;
  const endRecord = Math.min(currentPage * perPage, totalCount);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "...")[] = [];
    pages.push(1);

    const left = Math.max(2, currentPage - 1);
    const right = Math.min(totalPages - 1, currentPage + 1);

    if (left > 2) {
      pages.push("...");
    }

    for (let i = left; i <= right; i++) {
      pages.push(i);
    }

    if (right < totalPages - 1) {
      pages.push("...");
    }

    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav
      aria-label="Navigasi halaman tabel"
      className="flex flex-col gap-4 border-t border-border pt-4 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between"
    >
      {/* Records info and Per-page Selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Menampilkan <strong className="font-semibold text-ink">{startRecord}</strong>–
          <strong className="font-semibold text-ink">{endRecord}</strong> dari{" "}
          <strong className="font-semibold text-ink">{totalCount}</strong> data
        </span>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-ink-muted">Baris:</span>
          <div className="flex items-center rounded-control border border-border bg-ground p-0.5">
            {perPageOptions.map((option) => {
              const isActive = perPage === option;
              const url = buildPageUrl(baseUrl, searchParams, { page: 1, per_page: option });
              return (
                <Link
                  key={option}
                  href={url}
                  className={`min-h-[28px] min-w-[28px] px-2 py-1 text-center font-medium rounded-control transition-colors duration-150 ${
                    isActive
                      ? "bg-accent text-accent-ink font-bold shadow-xs"
                      : "text-ink hover:bg-surface"
                  }`}
                >
                  {option}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Page Navigation Buttons */}
      <div className="flex flex-wrap items-center gap-1">
        {/* Previous Page */}
        {currentPage > 1 ? (
          <Link
            href={buildPageUrl(baseUrl, searchParams, {
              page: currentPage - 1,
              per_page: perPage,
            })}
            aria-label="Halaman sebelumnya"
            className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-control border border-border bg-surface px-2.5 py-1 text-ink transition-colors hover:bg-ground active:scale-95"
          >
            ‹ Prev
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex min-h-[36px] min-w-[36px] cursor-not-allowed items-center justify-center rounded-control border border-border/40 bg-surface/50 px-2.5 py-1 text-ink-muted/50"
          >
            ‹ Prev
          </span>
        )}

        {/* Page Number Pills */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="flex h-9 w-7 items-center justify-center text-ink-muted"
                >
                  …
                </span>
              );
            }

            const isCurrent = p === currentPage;
            const url = buildPageUrl(baseUrl, searchParams, { page: p, per_page: perPage });

            return isCurrent ? (
              <span
                key={p}
                aria-current="page"
                className="inline-flex h-9 min-w-[36px] items-center justify-center rounded-control bg-accent px-2 text-xs font-bold text-accent-ink shadow-xs"
              >
                {p}
              </span>
            ) : (
              <Link
                key={p}
                href={url}
                aria-label={`Ke halaman ${p}`}
                className="inline-flex h-9 min-w-[36px] items-center justify-center rounded-control border border-border bg-surface px-2 text-xs font-medium text-ink transition-colors hover:bg-ground active:scale-95"
              >
                {p}
              </Link>
            );
          })}
        </div>

        {/* Next Page */}
        {currentPage < totalPages ? (
          <Link
            href={buildPageUrl(baseUrl, searchParams, {
              page: currentPage + 1,
              per_page: perPage,
            })}
            aria-label="Halaman selanjutnya"
            className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-control border border-border bg-surface px-2.5 py-1 text-ink transition-colors hover:bg-ground active:scale-95"
          >
            Next ›
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex min-h-[36px] min-w-[36px] cursor-not-allowed items-center justify-center rounded-control border border-border/40 bg-surface/50 px-2.5 py-1 text-ink-muted/50"
          >
            Next ›
          </span>
        )}
      </div>
    </nav>
  );
}
