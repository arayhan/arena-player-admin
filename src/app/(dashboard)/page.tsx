// Scaffold placeholder. Nothing product-shaped ships in step 02 — auth
// (step 07) gates this route and the dashboard's real content (pending
// count, oldest-pending age, manual expiry button) lands in Phase 2/3.
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
    <main className="flex min-h-full flex-1 items-center justify-center p-8">
      <div className="text-center">
        <h1>Arena Player — Admin</h1>
        <p className="mt-2 text-sm text-navy-400">Scaffold. Belum ada konten.</p>
      </div>
    </main>
  );
}
