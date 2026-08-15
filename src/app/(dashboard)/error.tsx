// "use client": required by the framework, not chosen. Next only accepts an
// `error.tsx` as a Client Component because it hands it a `reset` callback,
// so this is the third `"use client"` in v1 and the only one whose reason is
// "the convention has no server form." See docs/dev-rules.md, "Server
// Component by default" — the rule asks for a stated reason, and this is it.
//
// It lives inside `(dashboard)` so a render error keeps the sidebar: the
// admin can still reach the queue instead of being dropped onto a bare page.
"use client";

import { useEffect } from "react";

import { Button } from "@/components/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side only. The digest is what correlates this screen with the
    // server log; the message itself is never rendered — an error string can
    // carry a connection detail or a column name, and docs/rules/security.md
    // forbids putting either in front of the admin.
    console.error("[dashboard] render error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="rounded-panel border border-red-border bg-red-bg p-6">
      <h1 className="text-red-ink">Terjadi kesalahan</h1>
      <p className="mt-2 text-sm text-red-ink">
        Halaman ini gagal dimuat. Coba muat ulang — jika masih gagal, catat kode di bawah dan
        hubungi pengembang.
      </p>

      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-red-ink">Kode: {error.digest}</p>
      ) : null}

      <div className="mt-6">
        <Button type="button" onClick={reset}>
          Coba lagi
        </Button>
      </div>
    </div>
  );
}
