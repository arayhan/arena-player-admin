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
    <html lang="id" className={`${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full min-h-dvh flex-col">{children}</body>
    </html>
  );
}
