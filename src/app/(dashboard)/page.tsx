import { Breadcrumbs } from "@/components/breadcrumbs";

// Just enough to prove the shell renders around real page content. The
// dashboard's actual content (pending count, oldest-pending age, manual
// expiry button) lands in Phase 2/3, once there is a live Neon connection
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
      <p className="text-sm text-ink-muted">
        Scaffold. Antrean booking, statistik, dan tombol ekspirasi manual menyusul di Fase 2/3.
      </p>
    </>
  );
}
