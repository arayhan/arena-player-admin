"use client";

import { useEffect, useState } from "react";

// One of the two client components in v1 (the other is the proof-image
// reload button, landing with the bookings module). Cycling and persisting
// a theme choice needs onClick + localStorage, both browser-only.

type ThemeState = "system" | "light" | "dark";

const STORAGE_KEY = "arena-theme";

const NEXT_STATE: Record<ThemeState, ThemeState> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const LABEL: Record<ThemeState, string> = {
  system: "Mengikuti sistem",
  light: "Terang",
  dark: "Gelap",
};

// Inline SVGs — no icon library, per the dependency table. One glyph per
// state, in a lookup rather than a conditional chain for the same reason
// StatusPill is one.
const ICON: Record<ThemeState, React.ReactNode> = {
  system: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 20H16M12 17V20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  light: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 2V4.5M12 19.5V22M4.2 4.2L6 6M18 18L19.8 19.8M2 12H4.5M19.5 12H22M4.2 19.8L6 18M18 6L19.8 4.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  ),
  dark: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

function applyTheme(theme: ThemeState) {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export function ThemeToggle() {
  // Always starts "system" — matches the server-rendered markup exactly,
  // so hydration never mismatches. The real stored choice (if any) is read
  // in the effect below, after mount; the pre-hydration script in
  // src/app/layout.tsx already stamped the correct data-theme on <html>
  // before first paint, so this delay only affects the toggle's own icon,
  // never a flash of the wrong theme.
  const [theme, setTheme] = useState<ThemeState>("system");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        // A deliberate, one-time sync from an external source
        // (localStorage) that does not exist during SSR — the canonical
        // "read on mount" case react-hooks/set-state-in-effect otherwise
        // guards against cascading updates for. There is no subscription
        // to build here: the value only ever changes from this same
        // component's own click handler, which sets state directly.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTheme(stored);
      }
    } catch {
      // Private mode can throw on localStorage access — stay on "system".
    }
  }, []);

  function cycle() {
    const next = NEXT_STATE[theme];
    setTheme(next);
    applyTheme(next);
    try {
      if (next === "system") {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // The DOM attribute and in-memory state already updated; a failed
      // write just means the choice does not survive a reload.
    }
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-control border border-border text-ink-muted hover:border-input-border hover:text-ink [&_svg]:h-4 [&_svg]:w-4"
      aria-label={`Tema: ${LABEL[theme]}. Klik untuk mengganti.`}
    >
      {ICON[theme]}
    </button>
  );
}
