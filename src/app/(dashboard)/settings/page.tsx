import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { BankAccountItem } from "@/modules/settings/bank-account-item";
import {
  addBankAccountAction,
  updateSiteSettingsAction,
} from "@/modules/settings/settings.actions";
import { getBankAccounts, getSiteSettings } from "@/server/queries";
import { tableExists } from "@/server/schema-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pengaturan | Arena Player Admin",
  description: "Pengaturan operasional lapangan, rekening pembayaran, dan kontak WhatsApp.",
};

type Props = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function SettingsPage({ searchParams }: Props) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const errorMessage = resolvedParams?.error ? decodeURIComponent(resolvedParams.error) : null;
  const successMessage = resolvedParams?.success ? resolvedParams.success : null;

  const hasSettingsTable = await tableExists("site_settings");
  const settings = await getSiteSettings();
  const bankAccounts = await getBankAccounts();

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Beranda", href: "/" }, { label: "Pengaturan" }]} />

      {/* Notifications */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-panel border border-red-border bg-red-bg p-4 text-sm font-medium text-red-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5 flex-none">
            <path
              d="M12 9v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-panel border border-green-border bg-green-bg p-4 text-sm font-medium text-green-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5 flex-none">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            {successMessage === "saved"
              ? "Pengaturan umum berhasil disimpan."
              : successMessage === "bank_added"
                ? "Rekening bank baru berhasil ditambahkan."
                : successMessage === "bank_updated"
                  ? "Data rekening bank berhasil diperbarui."
                  : successMessage === "bank_deleted"
                    ? "Rekening bank berhasil dihapus."
                    : "Perubahan berhasil disimpan."}
          </span>
        </div>
      )}

      {!hasSettingsTable && (
        <div className="rounded-panel border border-amber-border bg-amber-bg/30 p-6 text-ink">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-amber" />
            <h2 className="text-sm font-bold text-ink">Database Migration Notice</h2>
          </div>
          <p className="mt-2 text-xs text-ink-muted leading-relaxed">
            Tabel <code className="font-mono text-xs font-semibold text-ink">site_settings</code> &{" "}
            <code className="font-mono text-xs font-semibold text-ink">bank_accounts</code> belum
            diterapkan pada database Supabase. Saat ini halaman menggunakan data konfigurasi
            default.
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Terapkan skrip migrasi dari{" "}
            <code className="font-mono text-xs text-ink font-semibold">
              docs/schema-requests/003-site-settings.md
            </code>{" "}
            melalui Supabase SQL Editor untuk mengaktifkan persistensi live ke database publik.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column: General & Contact Settings */}
        <div className="flex flex-col gap-6">
          <form
            action={updateSiteSettingsAction}
            className="flex flex-col gap-5 rounded-panel border border-border bg-surface p-6"
          >
            <div className="border-b border-border pb-3">
              <h2 className="text-base font-bold text-ink">Informasi Lapangan & Kontak</h2>
              <p className="text-xs text-ink-muted">
                Data yang tampil di halaman utama situs publik untuk pemesanan pelanggan.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="whatsapp_number"
                className="text-xs font-semibold uppercase text-ink-muted"
              >
                Nomor WhatsApp Admin (CS)
              </label>
              <input
                id="whatsapp_number"
                name="whatsapp_number"
                type="text"
                defaultValue={settings.whatsapp_number}
                placeholder="Contoh: 089682620666 atau 6289682620666"
                required
                className="h-11 rounded-control border border-border bg-ground px-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
              <span className="text-[11px] text-ink-muted">
                Nomor ini digunakan untuk link wa.me pada konfirmasi booking pelanggan.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="address" className="text-xs font-semibold uppercase text-ink-muted">
                Alamat Lapangan
              </label>
              <textarea
                id="address"
                name="address"
                rows={3}
                defaultValue={settings.address}
                placeholder="Alamat lengkap lapangan arena futsal..."
                required
                className="rounded-control border border-border bg-ground p-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="dp_percent"
                className="text-xs font-semibold uppercase text-ink-muted"
              >
                Ketentuan Minimal DP (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="dp_percent"
                  name="dp_percent"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={settings.dp_percent}
                  required
                  className="h-11 w-28 rounded-control border border-border bg-ground px-3 text-sm text-ink focus:border-accent focus:outline-none"
                />
                <span className="text-sm font-semibold text-ink">% dari total harga sewa</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="maps_embed_url"
                className="text-xs font-semibold uppercase text-ink-muted"
              >
                Google Maps Embed URL (Iframe Src)
              </label>
              <input
                id="maps_embed_url"
                name="maps_embed_url"
                type="url"
                defaultValue={settings.maps_embed_url}
                placeholder="https://www.google.com/maps/embed?pb=..."
                className="h-11 rounded-control border border-border bg-ground px-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>

            <div className="border-t border-border pt-4">
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center justify-center rounded-control bg-accent px-5 py-2.5 text-xs font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover"
              >
                Simpan Informasi Umum
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Bank Accounts List & Management */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-5 rounded-panel border border-border bg-surface p-6">
            <div className="border-b border-border pb-3">
              <h2 className="text-base font-bold text-ink">Rekening Bank Tujuan Transfer</h2>
              <p className="text-xs text-ink-muted">
                Daftar rekening bank aktif yang ditampilkan pada form pembayaran DP customer.
              </p>
            </div>

            {bankAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-control border border-dashed border-border p-6 text-center text-xs text-ink-muted">
                <p className="font-semibold text-ink">Belum ada rekening terdaftar</p>
                <p className="mt-1">Tambahkan rekening bank menggunakan formulir di bawah.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {bankAccounts.map((acc) => (
                  <BankAccountItem key={acc.id} account={acc} />
                ))}
              </div>
            )}

            {/* Add Bank Account Form */}
            <form
              action={addBankAccountAction}
              className="mt-2 flex flex-col gap-3 rounded-control border border-border bg-ground p-4"
            >
              <h3 className="text-xs font-bold uppercase text-ink">Tambah Rekening Baru</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  name="bank"
                  type="text"
                  placeholder="Nama Bank (BCA, BRI)"
                  required
                  className="h-10 rounded-control border border-border bg-surface px-3 text-xs text-ink focus:border-accent focus:outline-none"
                />
                <input
                  name="account_number"
                  type="text"
                  placeholder="Nomor Rekening"
                  required
                  className="h-10 rounded-control border border-border bg-surface px-3 font-mono text-xs font-semibold text-ink focus:border-accent focus:outline-none"
                />
                <input
                  name="account_holder"
                  type="text"
                  placeholder="Nama Pemilik Rekening"
                  required
                  className="h-10 rounded-control border border-border bg-surface px-3 text-xs text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="relative inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked
                    className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <span className="text-xs font-medium text-ink">
                    Langsung aktifkan untuk pembayaran pelanggan
                  </span>
                </label>
              </div>

              <button
                type="submit"
                className="mt-1 inline-flex min-h-[44px] items-center justify-center rounded-control border border-border bg-surface px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-border"
              >
                + Tambah Rekening
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
