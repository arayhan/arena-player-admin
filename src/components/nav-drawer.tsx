"use client";

import { useEffect, useId, useRef, useState } from "react";

// The second (and last, in v1) client component. The sidebar's own content
// (`nav`) and the mobile top bar's brand mark (`topbarBrand`) are rendered
// server-side by the (dashboard) layout and passed in as already-built
// elements — this file never imports a Server Component, it only arranges
// ReactNode props, so nothing under it loses its Server Component status.
//
// Below ~1000px the sidebar becomes a fixed drawer (mirrors the design
// mockup's own breakpoint). No slide-in: DESIGN.md permits background-color
// and border-color transitions only, so the drawer appears/disappears the
// way every other overlay does, not by sliding.

type NavDrawerProps = {
  nav: React.ReactNode;
  topbarBrand: React.ReactNode;
  children: React.ReactNode;
};

export function NavDrawer({ nav, topbarBrand, children }: NavDrawerProps) {
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const navId = useId();

  function close() {
    setOpen(false);
    burgerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus moves into the drawer on open. The <aside> itself is the
    // target (tabIndex={-1} below) rather than its first link — the first
    // link already carries aria-current="page" some of the time, and
    // stealing focus onto it specifically would be a second, unrelated
    // announcement.
    sidebarRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSidebarClick(event: React.MouseEvent<HTMLElement>) {
    // Choosing a nav item closes the drawer. Delegated rather than wired
    // per-link, since the links themselves are server-rendered content.
    const target = event.target as HTMLElement;
    if (target.closest("a")) {
      close();
    }
  }

  return (
    <div className="flex min-h-screen min-h-dvh">
      {/* Skip-to-content link for keyboard / assistive tech users. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-ink"
      >
        Lewati ke konten utama
      </a>

      {/* Scrim: clickable backdrop button that closes the mobile drawer.
          An accessible label is provided so screen readers and keyboard users
          who encounter it understand its dismiss action. */}
      <button
        type="button"
        tabIndex={-1}
        onClick={close}
        aria-label="Tutup menu navigasi"
        className={`${open ? "block" : "hidden"} fixed inset-0 z-[55] cursor-default border-0 bg-scrim p-0 min-[1001px]:hidden`}
      />

      <aside
        id={navId}
        ref={sidebarRef}
        tabIndex={-1}
        aria-label="Navigasi utama"
        onClick={handleSidebarClick}
        className={`${open ? "flex" : "hidden"} flex-col gap-6 border-r border-border bg-sidebar p-3 max-[1000px]:fixed max-[1000px]:inset-y-0 max-[1000px]:left-0 max-[1000px]:z-[60] max-[1000px]:w-[280px] max-[1000px]:max-w-[86vw] max-[1000px]:overflow-y-auto min-[1001px]:sticky min-[1001px]:top-0 min-[1001px]:flex min-[1001px]:h-screen min-[1001px]:w-[236px]`}
      >
        {nav}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 hidden items-center gap-3 border-b border-border bg-sidebar px-4 py-2 max-[1000px]:flex">
          <button
            ref={burgerRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls={navId}
            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-control border border-border text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
              <path
                d="M4 7H20M4 12H20M4 17H20"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
            </svg>
            <span className="sr-only">Buka menu navigasi</span>
          </button>
          {topbarBrand}
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex flex-1 flex-col gap-4 p-6 outline-none"
        >
          <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-4">{children}</div>
        </main>
      </div>
    </div>
  );
}
