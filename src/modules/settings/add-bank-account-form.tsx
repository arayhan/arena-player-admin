"use client";

import { useState } from "react";
import { addBankAccountAction } from "./settings.actions";

export function AddBankAccountForm() {
  const [isActive, setIsActive] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    setSuccess(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("is_active", isActive ? "true" : "false");

    const res = await addBankAccountAction(formData);
    setIsPending(false);

    if (res.success) {
      form.reset();
      setIsActive(true);
      setSuccess("Rekening bank baru berhasil ditambahkan.");
      setTimeout(() => setSuccess(null), 4000);
    } else {
      setError(res.error ?? "Gagal menambahkan rekening.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-col gap-3.5 rounded-control border border-border bg-ground/50 p-4"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-accent" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
          Tambah Rekening Baru
        </h3>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-control border border-red-border bg-red-bg p-3 text-xs font-medium text-red-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 flex-none">
            <path
              d="M12 9v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-control border border-green-border bg-green-bg p-3 text-xs font-medium text-green-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 flex-none">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-ink-muted">
            Nama Bank <span className="text-red-ink">*</span>
          </label>
          <input
            name="bank"
            type="text"
            placeholder="Contoh: BCA, Mandiri, BRI"
            required
            maxLength={40}
            className="h-10 rounded-control border border-border bg-surface px-3 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-ink-muted">
            Nomor Rekening <span className="text-red-ink">*</span>
          </label>
          <input
            name="account_number"
            type="text"
            placeholder="Contoh: 1234567890"
            required
            maxLength={40}
            className="h-10 rounded-control border border-border bg-surface px-3 font-mono text-xs font-semibold text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-ink-muted">
            Nama Pemilik (a.n.) <span className="text-red-ink">*</span>
          </label>
          <input
            name="account_holder"
            type="text"
            placeholder="Contoh: Arena Futsal Lombok"
            required
            maxLength={100}
            className="h-10 rounded-control border border-border bg-surface px-3 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        {/* Toggle Switch */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive(!isActive)}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center p-1 focus:outline-none"
          >
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                isActive ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </span>
          </button>
          <span className="text-xs font-medium text-ink">
            {isActive
              ? "Langsung aktifkan untuk pembayaran pelanggan"
              : "Simpan sebagai nonaktif (draft)"}
          </span>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center rounded-control bg-accent px-5 py-2 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {isPending ? "Menambahkan..." : "+ Tambah Rekening"}
        </button>
      </div>
    </form>
  );
}
