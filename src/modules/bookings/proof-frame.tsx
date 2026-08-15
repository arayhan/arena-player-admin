"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProofFrame({ signedUrl, alt }: { signedUrl: string; alt: string }) {
  const [expired, setExpired] = useState(false);
  const router = useRouter();

  if (expired) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-control border border-border bg-surface p-6 text-center text-ink">
        <div className="text-sm font-semibold text-ink">Tautan bukti sudah kedaluwarsa</div>
        <p className="max-w-sm text-xs text-ink-muted">
          Tautan hanya berlaku 120 detik karena ini dokumen pembayaran. Muat ulang untuk membuat
          tautan baru.
        </p>
        <button
          type="button"
          onClick={() => {
            setExpired(false);
            router.refresh();
          }}
          className="inline-flex min-h-[44px] items-center rounded-control bg-accent px-4 py-2 text-xs font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover"
        >
          Muat ulang bukti
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Plain <img> is MANDATORY per hard rule 2 — next/image caches private payment proofs on disk */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={signedUrl}
        alt={alt}
        onError={() => setExpired(true)}
        className="max-h-[500px] w-auto max-w-full rounded-control border border-border object-contain shadow-sm"
      />
    </div>
  );
}
