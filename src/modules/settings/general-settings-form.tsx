"use client";

import { useState } from "react";
import { updateSiteSettingsAction } from "./settings.actions";

type GeneralSettingsFormProps = {
  initialSettings: {
    whatsapp_number: string;
    address: string;
    operating_hours: string;
    maps_embed_url: string;
    dp_percent: string;
  };
};

export function GeneralSettingsForm({ initialSettings }: GeneralSettingsFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const res = await updateSiteSettingsAction(formData);
    setIsPending(false);

    if (res.success) {
      setSuccess("Pengaturan umum berhasil disimpan.");
      setTimeout(() => setSuccess(null), 4000);
    } else {
      setError(res.error ?? "Gagal menyimpan pengaturan umum.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-panel border border-border bg-surface p-6"
    >
      <div className="border-b border-border pb-3">
        <h2 className="text-base font-bold text-ink">Informasi Lapangan & Kontak</h2>
        <p className="text-xs text-ink-muted">
          Data yang tampil di halaman utama situs publik untuk pemesanan pelanggan.
        </p>
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="whatsapp_number" className="text-xs font-semibold uppercase text-ink-muted">
          Nomor WhatsApp Admin (CS)
        </label>
        <input
          id="whatsapp_number"
          name="whatsapp_number"
          type="text"
          defaultValue={initialSettings.whatsapp_number}
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
          defaultValue={initialSettings.address}
          placeholder="Alamat lengkap lapangan arena futsal..."
          required
          className="rounded-control border border-border bg-ground p-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="operating_hours" className="text-xs font-semibold uppercase text-ink-muted">
          Jam Operasional
        </label>
        <input
          id="operating_hours"
          name="operating_hours"
          type="text"
          defaultValue={initialSettings.operating_hours || "06.00–24.00 WITA"}
          placeholder="Contoh: 06.00–24.00 WITA"
          required
          className="h-11 rounded-control border border-border bg-ground px-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
        <span className="text-[11px] text-ink-muted">
          Format tampilan jam operasional yang tampil pada halaman utama.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="dp_percent" className="text-xs font-semibold uppercase text-ink-muted">
          Ketentuan Minimal DP (%)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="dp_percent"
            name="dp_percent"
            type="number"
            min={1}
            max={100}
            defaultValue={initialSettings.dp_percent}
            required
            className="h-11 w-28 rounded-control border border-border bg-ground px-3 text-sm text-ink focus:border-accent focus:outline-none"
          />
          <span className="text-sm font-semibold text-ink">% dari total harga sewa</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="maps_embed_url" className="text-xs font-semibold uppercase text-ink-muted">
          Google Maps Embed URL (Iframe Src)
        </label>
        <input
          id="maps_embed_url"
          name="maps_embed_url"
          type="url"
          defaultValue={initialSettings.maps_embed_url}
          placeholder="https://www.google.com/maps/embed?pb=..."
          className="h-11 rounded-control border border-border bg-ground px-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
      </div>

      <div className="border-t border-border pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center rounded-control bg-accent px-5 py-2.5 text-xs font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
        >
          {isPending ? "Menyimpan..." : "Simpan Informasi Umum"}
        </button>
      </div>
    </form>
  );
}
