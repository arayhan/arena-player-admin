import { presignProofUrl } from "@/server/storage";
import { ProofFrame } from "./proof-frame";

export async function ProofPanel({
  proofKey,
  teamName,
}: {
  proofKey: string | null;
  teamName: string;
}) {
  if (!proofKey) {
    return (
      <div className="flex flex-col items-center justify-center rounded-control border border-dashed border-border bg-ground/50 p-8 text-center text-xs text-ink-muted">
        <p className="font-medium text-ink">Tidak ada bukti transfer</p>
        <p className="mt-1">
          Booking ini dibuat tanpa lampiran bukti transfer atau pembayaran tunai.
        </p>
      </div>
    );
  }

  let signedUrl: string | null = null;
  let signingError: string | null = null;

  try {
    signedUrl = await presignProofUrl(proofKey);
  } catch (error) {
    console.error("[ProofPanel] Failed to sign proof URL:", error);
    signingError = "Gagal memuat dokumen bukti pembayaran dari penyimpanan.";
  }

  if (signingError || !signedUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-control border border-border bg-amber-bg/50 p-6 text-center text-xs text-amber-ink">
        <p className="font-semibold">Bukti Pembayaran Tidak Dapat Dimuat</p>
        <p className="text-ink-muted">
          Terjadi kendala saat menghubungkan ke penyimpanan berkas. Silakan periksa konfigurasi
          penyimpanan atau hubungi pengelola sistem.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ProofFrame signedUrl={signedUrl} alt={`Bukti pembayaran untuk ${teamName}`} />
    </div>
  );
}
