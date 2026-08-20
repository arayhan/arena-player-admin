import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// SELF-HOSTED THROUGH next/font, never a CDN <link> — same reasoning as
// arena-player-web's layout.tsx. Inter is the only face this app uses;
// DESIGN.md's mono step is `ui-monospace`, a system stack, so it needs no
// loader.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arena Player — Admin",
  description: "Back-office pemesanan lapangan mini soccer Arena Player.",
  openGraph: {
    title: "Arena Player — Admin",
    description: "Back-office pemesanan lapangan mini soccer Arena Player.",
    type: "website",
    locale: "id_ID",
    siteName: "Arena Player Admin",
    images: [{ url: "/logo.png", width: 1042, height: 671, alt: "Arena Player Admin" }],
  },
};

// Stamps `data-theme` on <html> before first paint. Without this, the page
// renders with the OS theme (the plain `:root` block / the
// prefers-color-scheme media query) and then corrects to the admin's saved
// choice a frame later — a visible flash. Wrapped in try/catch: private
// browsing can throw on localStorage access, and the fallback (no
// attribute set, OS theme applies) is a fine default, not a broken page.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("arena-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

// lang="id": every string an admin reads on this page is Indonesian, per
// CLAUDE.md hard rule 10.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` IS REQUIRED BY THE SCRIPT ABOVE, NOT A
    // WORKAROUND FOR ONE. THEME_INIT_SCRIPT runs during HTML parsing and adds
    // `data-theme` to this element, so by the time React hydrates the DOM
    // carries an attribute no render produced and React reports a mismatch it
    // cannot patch. This tells React the DOM wins for THIS element's own
    // attributes only — it does not travel to <head>, <body> or any child, so
    // a real mismatch anywhere else still surfaces.
    //
    // No `data-theme` default is set here on purpose, unlike Next's own theme
    // example. globals.css treats "no attribute" as "follow the OS" via
    // `prefers-color-scheme`; stamping `light` here would make every visitor
    // who never touched the toggle render light regardless of their system.
    <html lang="id" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full min-h-dvh flex-col">{children}</body>
    </html>
  );
}
