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

// lang="id": every string an admin reads on this page is Indonesian, per
// CLAUDE.md hard rule 10.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
