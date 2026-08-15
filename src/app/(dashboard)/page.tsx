import { Breadcrumbs } from "@/components/breadcrumbs";

// Just enough to prove the shell renders around real page content. The
// dashboard's actual content (pending count, oldest-pending age, manual
// expiry button) lands in Phase 2/3, once there is a live Supabase connection
// and (for oldest-pending) schema-request 002 — see docs/architecture.md's
// route map.
//
// `force-dynamic` explicitly, rather than relying on middleware's
// Cache-Control header alone: this page has no `searchParams`, no cookies
// read in the component itself, and no other signal that would make Next
// treat it as dynamic, so it was being statically prerendered at build
// time (architecture.md:55 — every admin response carries `private,
// no-store`, and a session-gated page must never be render-once-serve-many
// regardless of what headers ride on top of it).
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Beranda" }]} />
      <h1>Beranda</h1>

      {/* NOT the empty-queue success state, and it must not be "improved" into
          one. There is no bookings table, no query and no data layer yet — so
          this app cannot see the queue rather than having looked and found it
          empty. "Antrean kosong" here would tell the admin nothing needs their
          attention while the truth is that nothing can be read at all, which
          is the reassuring lie PRODUCT.md principle 4 exists to prevent.

          When the queue is live and genuinely empty, that is a different
          state with different words and its own component — see
          docs/tasks/6-step-01-direction.md. */}
      <p className="text-sm text-ink-muted">
        Antrean belum tersambung ke database. Booking dari situs publik akan muncul di sini setelah
        database siap — saat ini belum ada yang bisa diproses.
      </p>
    </>
  );
}
