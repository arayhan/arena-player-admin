import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

import { BrandMark } from "./brand-mark";

// Server Component, colocated for the same reason as BrandMark — one
// consumer, the dashboard layout, which passes this whole tree into
// NavDrawer's `nav` prop as already-rendered content.
//
// No active-route highlighting (`aria-current="page"`) in v1: that needs
// the current pathname, which a Server Component only gets from a request
// header this app's middleware does not set. Wiring it would mean either a
// third client component or a middleware change neither is scoped here —
// left as a follow-up once a feature module actually needs it.

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
  badge?: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Beranda",
    href: "/",
    icon: (
      <path
        d="M4 11L12 4L20 11M6 10V19C6 19.55 6.45 20 7 20H10V15C10 14.45 10.45 14 11 14H13C13.55 14 14 14.45 14 15V20H17C17.55 20 18 19.55 18 19V10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    label: "Booking",
    href: "/bookings",
    icon: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4 9.5H20" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M8 3.5V6.5M16 3.5V6.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    label: "Statistik",
    href: "/stats",
    icon: (
      <path
        d="M4 20V11M10 20V4M16 20V14M20 20V8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    ),
  },
  {
    label: "Blokir Slot",
    href: "/blocks",
    icon: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M8 10V7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7V10"
          stroke="currentColor"
          strokeWidth="1.7"
        />
      </>
    ),
    disabled: true,
    badge: "Fase 4",
  },
];

const SISTEM_ITEMS: NavItem[] = [
  {
    label: "Ekspor",
    href: "/export",
    icon: (
      <>
        <path
          d="M12 3V15M12 15L8 11M12 15L16 11"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 17V19C4 19.55 4.45 20 5 20H19C19.55 20 20 19.55 20 19V17"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    label: "Pengaturan",
    href: "/settings",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M19.4 13.5C19.5 12.5 19.5 11.5 19.4 10.5L21 9L19 5.7L17.1 6.4C16.4 5.7 15.5 5.1 14.6 4.7L14.2 2.7H9.8L9.4 4.7C8.5 5.1 7.6 5.7 6.9 6.4L5 5.7L3 9L4.6 10.5C4.5 11.5 4.5 12.5 4.6 13.5L3 15L5 18.3L6.9 17.6C7.6 18.3 8.5 18.9 9.4 19.3L9.8 21.3H14.2L14.6 19.3C15.5 18.9 16.4 18.3 17.1 17.6L19 18.3L21 15L19.4 13.5Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </>
    ),
  },
];

function NavLink({ item }: { item: NavItem }) {
  if (item.disabled) {
    return (
      <span
        aria-disabled="true"
        className="flex cursor-not-allowed items-center gap-3 rounded-control p-2 text-sm font-medium text-ink-muted opacity-55"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 flex-none">
          {item.icon}
        </svg>
        {item.label}
        {item.badge ? (
          <span className="ml-auto rounded-full border border-border px-1.5 py-0.5 text-xs font-semibold">
            {item.badge}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 rounded-control p-2 text-sm font-medium text-ink-muted hover:bg-border hover:text-ink"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 flex-none">
        {item.icon}
      </svg>
      {item.label}
    </Link>
  );
}

export function SidebarNav() {
  return (
    <>
      <div className="flex items-center gap-3 p-1">
        <BrandMark />
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.label} item={item} />
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-1">
          <div className="px-2 pb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Sistem
          </div>
          {SISTEM_ITEMS.map((item) => (
            <NavLink key={item.label} item={item} />
          ))}
        </div>
      </nav>

      <div className="flex items-center gap-2 border-t border-border p-1 pt-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-ink"
        >
          A
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-ink">Admin</span>
          <span className="truncate text-xs text-ink-muted">Lapangan Lombok</span>
        </span>
        <ThemeToggle />
        <form method="POST" action="/api/auth/logout">
          <button
            type="submit"
            className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-control border border-border text-ink-muted hover:border-input-border hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
              <path
                d="M15 4H19C19.55 4 20 4.45 20 5V19C20 19.55 19.55 20 19 20H15"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path
                d="M10 8L14 12L10 16"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M14 12H4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <span className="sr-only">Keluar</span>
          </button>
        </form>
      </div>
    </>
  );
}
