import Link from "next/link";
import type { Metadata } from "next";

// Server Component, at the ROOT rather than inside `(dashboard)`, and the
// placement is the whole point: Next serves this file for a URL that matches
// no route at all. A `not-found.tsx` inside the route group only handles
// `notFound()` thrown from within that group, so it would never see a typed
// or stale `/stats`.
//
// It therefore renders without the sidebar, and that is deliberate rather
// than a compromise: reproducing the shell here would be a second copy of it,
// and a second copy is the drift this repo keeps paying for. The nav items
// for unbuilt routes are disabled, so nobody arrives here by clicking — this
// is the typed-URL and stale-bookmark case, and one clear way back is enough.

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan — Arena Player Admin",
};

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center bg-ground px-4">
      <div className="w-full max-w-sm rounded-panel border border-border bg-surface p-8">
        <h1>Halaman tidak ditemukan</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Alamat yang dibuka tidak ada. Mungkin salah ketik, atau halaman ini belum tersedia.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-control bg-accent px-4 text-sm font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}
