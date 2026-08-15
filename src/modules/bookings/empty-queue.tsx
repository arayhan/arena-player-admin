import { StatusPill } from "@/components/status-pill";

export function EmptyQueue({ isFilterActive = false }: { isFilterActive?: boolean }) {
  if (isFilterActive) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-panel border border-border bg-surface px-6 py-12 text-center">
        <h2>Tidak ada booking yang cocok</h2>
        <p className="max-w-sm text-sm text-ink-muted">
          Coba ubah status, rentang tanggal, atau kata kunci pencarian.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-panel border border-border bg-surface px-6 py-12 text-center">
      <div className="flex items-center gap-2">
        <StatusPill status="confirmed" />
      </div>
      <h2>Antrean kosong</h2>
      <p className="max-w-sm text-sm text-ink-muted">
        Semua booking telah diproses. Booking baru dari situs publik akan muncul di sini secara
        otomatis.
      </p>
    </div>
  );
}
