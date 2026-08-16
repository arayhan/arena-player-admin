"use client";

import { useState, useTransition } from "react";
import { addBankAccountAction } from "./settings.actions";

export function AddBankAccountForm() {
  const [isActive, setIsActive] = useState(true);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={async (formData: FormData) => {
        startTransition(async () => {
          formData.set("is_active", isActive ? "true" : "false");
          await addBankAccountAction(formData);
        });
      }}
      className="mt-3 flex flex-col gap-3.5 rounded-control border border-border bg-ground/50 p-4"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-accent" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
          Tambah Rekening Baru
        </h3>
      </div>

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
