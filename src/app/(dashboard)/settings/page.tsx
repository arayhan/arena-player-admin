import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { AddBankAccountForm } from "@/modules/settings/add-bank-account-form";
import { BankAccountItem } from "@/modules/settings/bank-account-item";
import { GeneralSettingsForm } from "@/modules/settings/general-settings-form";
import { getBankAccounts, getSiteSettings } from "@/server/queries";
import { tableExists } from "@/server/schema-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pengaturan | Arena Player Admin",
  description: "Pengaturan operasional lapangan, rekening pembayaran, dan kontak WhatsApp.",
};

export default async function SettingsPage() {
  const hasSettingsTable = await tableExists("site_settings");
  const settings = await getSiteSettings();
  const bankAccounts = await getBankAccounts();

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Beranda", href: "/" }, { label: "Pengaturan" }]} />

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
          <GeneralSettingsForm initialSettings={settings} />
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
            <AddBankAccountForm />
          </div>
        </div>
      </div>
    </div>
  );
}
