import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import { AddBankAccountForm } from "@/modules/settings/add-bank-account-form";
import { BankAccountItem } from "@/modules/settings/bank-account-item";
import { BankAccountsFilters } from "@/modules/settings/bank-accounts-filters";
import { parseBankAccountsFilter } from "@/modules/settings/bank-accounts.schema";
import { GeneralSettingsForm } from "@/modules/settings/general-settings-form";
import { getBankAccounts, getSiteSettings } from "@/server/queries";
import { tableExists } from "@/server/schema-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pengaturan | Arena Player Admin",
  description: "Pengaturan operasional lapangan, rekening pembayaran, dan kontak WhatsApp.",
};

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({ searchParams }: Props) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const hasSettingsTable = await tableExists("site_settings");
  const settings = await getSiteSettings();

  const bankFilter = parseBankAccountsFilter(
    resolvedParams
      ? {
          q: resolvedParams.bank_q,
          status: resolvedParams.bank_status,
          sort: resolvedParams.bank_sort,
          dir: resolvedParams.bank_dir,
          page: resolvedParams.bank_page,
          per_page: resolvedParams.bank_per_page,
        }
      : undefined,
  );

  const bankOffset = (bankFilter.page - 1) * bankFilter.per_page;
  const { rows: bankAccounts, totalCount: totalBankAccounts } = await getBankAccounts({
    q: bankFilter.q,
    status: bankFilter.status,
    sort: bankFilter.sort,
    dir: bankFilter.dir,
    limit: bankFilter.per_page,
    offset: bankOffset,
  });

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
          <div className="flex flex-col gap-5 rounded-panel border border-border bg-surface p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-base font-bold text-ink">Rekening Bank Tujuan Transfer</h2>
                <p className="text-xs text-ink-muted">
                  Daftar rekening bank aktif yang ditampilkan pada form pembayaran DP customer.
                </p>
              </div>
              <span className="rounded-full border border-border bg-ground px-2.5 py-0.5 text-xs font-semibold text-ink">
                Total {totalBankAccounts}
              </span>
            </div>

            {/* Filter and Sort Bar */}
            <BankAccountsFilters currentFilter={bankFilter} actionPath="/settings" />

            {bankAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-control border border-dashed border-border p-6 text-center text-xs text-ink-muted">
                <p className="font-semibold text-ink">Belum ada rekening terdaftar</p>
                <p className="mt-1">
                  {bankFilter.q || bankFilter.status !== "all"
                    ? "Tidak ada rekening yang cocok dengan filter."
                    : "Tambahkan rekening bank menggunakan formulir di bawah."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {bankAccounts.map((acc) => (
                  <BankAccountItem key={acc.id} account={acc} />
                ))}

                {/* Pagination */}
                <Pagination
                  page={bankFilter.page}
                  perPage={bankFilter.per_page}
                  totalCount={totalBankAccounts}
                  baseUrl="/settings"
                  searchParams={resolvedParams}
                  perPageOptions={[5, 10, 25]}
                />
              </div>
            )}

            {/* Add Bank Account Form */}
            <div className="border-t border-border pt-4">
              <AddBankAccountForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
