"use client";

import { useState, useTransition } from "react";
import type { BankAccountRow } from "@/server/queries";
import {
  deleteBankAccountAction,
  toggleBankAccountStatusAction,
  updateBankAccountAction,
} from "./settings.actions";

type BankAccountItemProps = {
  account: BankAccountRow;
};

export function BankAccountItem({ account }: BankAccountItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className={`flex flex-col rounded-control border p-4 transition-all duration-150 ${
        account.is_active
          ? "border-border bg-surface shadow-xs"
          : "border-border/60 bg-ground/50 opacity-80"
      }`}
    >
      {/* View Mode */}
      {!isEditing ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left Side: Account Info */}
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-accent/10 px-2 py-0.5 font-mono text-xs font-bold text-accent">
                {account.bank}
              </span>
              <span className="font-mono text-sm font-semibold tracking-wide text-ink">
                {account.account_number}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  account.is_active
                    ? "border border-green-border bg-green-bg text-green-ink"
                    : "border border-border bg-neutral-100 text-ink-muted dark:bg-neutral-800"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    account.is_active ? "bg-green-500" : "bg-neutral-400"
                  }`}
                />
                {account.is_active ? "Aktif" : "Nonaktif"}
              </span>
            </div>
            <span className="text-xs text-ink-muted">a.n. {account.account_holder}</span>
          </div>

          {/* Right Side: Toggle Switch + Edit Text + Delete Button */}
          <div className="flex items-center gap-3">
            {/* Toggle Switch Component */}
            <form action={toggleBankAccountStatusAction} className="inline-flex items-center">
              <input type="hidden" name="id" value={account.id} />
              <input type="hidden" name="is_active" value={account.is_active ? "false" : "true"} />
              <button
                type="submit"
                disabled={isPending}
                aria-label={
                  account.is_active ? "Nonaktifkan rekening bank" : "Aktifkan rekening bank"
                }
                title={
                  account.is_active
                    ? "Klik untuk menonaktifkan rekening"
                    : "Klik untuk mengaktifkan rekening"
                }
                className="group flex min-h-[44px] cursor-pointer items-center gap-2 py-1 text-xs text-ink"
              >
                <div
                  className={`relative h-6 w-11 rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-accent ${
                    account.is_active
                      ? "bg-green-500 dark:bg-green-600"
                      : "bg-neutral-300 dark:bg-neutral-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                      account.is_active ? "translate-x-6" : "translate-x-1"
                    } mt-1`}
                  />
                </div>
              </button>
            </form>

            {/* Edit Text Button (Beside the switch) */}
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-control border border-border bg-ground px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="h-3.5 w-3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>Edit</span>
            </button>

            {/* Delete Button */}
            <form
              action={deleteBankAccountAction}
              onSubmit={(e) => {
                if (!confirm(`Hapus rekening ${account.bank} (${account.account_number})?`)) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="id" value={account.id} />
              <button
                type="submit"
                aria-label="Hapus rekening"
                title="Hapus rekening"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control border border-red-border/60 bg-red-bg/50 text-xs font-medium text-red-ink transition-colors hover:bg-red-border/20"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className="h-4 w-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Edit Form Mode */
        <form
          action={async (formData: FormData) => {
            startTransition(async () => {
              await updateBankAccountAction(formData);
              setIsEditing(false);
            });
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-bold text-ink">Edit Rekening: {account.bank}</span>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs font-semibold text-ink-muted hover:text-ink"
            >
              Batal ✕
            </button>
          </div>

          <input type="hidden" name="id" value={account.id} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase text-ink-muted">
                Nama Bank
              </label>
              <input
                name="bank"
                type="text"
                defaultValue={account.bank}
                required
                className="h-10 rounded-control border border-border bg-ground px-3 text-xs font-medium text-ink focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase text-ink-muted">
                Nomor Rekening
              </label>
              <input
                name="account_number"
                type="text"
                defaultValue={account.account_number}
                required
                className="h-10 rounded-control border border-border bg-ground px-3 font-mono text-xs font-semibold text-ink focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase text-ink-muted">
                Nama Pemilik (a.n.)
              </label>
              <input
                name="account_holder"
                type="text"
                defaultValue={account.account_holder}
                required
                className="h-10 rounded-control border border-border bg-ground px-3 text-xs font-medium text-ink focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={account.is_active}
                className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
              />
              <span className="text-xs font-medium text-ink">
                Status Aktif (Ditampilkan pada formulir DP)
              </span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-control border border-border px-4 py-2 text-xs font-medium text-ink transition-colors hover:bg-ground"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-h-[44px] items-center justify-center rounded-control bg-accent px-5 py-2 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {isPending ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
