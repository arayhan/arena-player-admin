import Link from "next/link";

// Server Component. Mirrors the mockup's `.crumbs` — the separator is CSS
// content in the mockup (never announced to a screen reader); here it is a
// plain aria-hidden character between list items instead, since a
// component has no stylesheet of its own to put a ::before rule in.
//
// Each <li> is a flex container, so its link is a flex item and vertical
// padding applies to it: `py-1` grows the link's hit area past its 18px ink
// box, and `-my-1` hands the space back to the layout so the crumb row keeps
// its original height. Same reason as everywhere else in this repo — the
// admin taps this on a phone at the field (docs/dev-rules.md, 44px floor).

type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden="true" className="opacity-55">
                  /
                </span>
              ) : null}
              {item.href && !isLast ? (
                <Link href={item.href} className="-my-1 py-1 hover:text-ink hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "font-semibold text-ink" : ""}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
