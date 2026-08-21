"use client";

import { useState } from "react";
import { triggerManualExpiryAction } from "./bookings.actions";

export function ExpiryTriggerButton() {
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setMessage(null);
    try {
      const res = await triggerManualExpiryAction();
      setIsPending(false);
      if (res.expiredCount > 0) {
        setMessage(`${res.expiredCount} booking yang melewati 24 jam berhasil dilepaskan.`);
      } else {
        setMessage("Tidak ada booking pending yang melewati batas 24 jam saat ini.");
      }
      setTimeout(() => setMessage(null), 5000);
    } catch {
      setIsPending(false);
      setMessage("Gagal menjalankan auto-expire.");
      setTimeout(() => setMessage(null), 5000);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-150 hover:bg-ground disabled:opacity-50"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
        >
          <path
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {isPending ? "Memproses..." : "Jalankan Auto-Expire Sekarang"}
      </button>

      {message && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-control border border-green-border bg-green-bg px-3 py-1.5 text-xs font-medium text-green-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-3.5 w-3.5 flex-none">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
