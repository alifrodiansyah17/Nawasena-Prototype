import { WA_HOURS } from "@/lib/config";

// Semua jalur bantuan lewat /api/bantuan supaya help_click tercatat beserta layarnya,
// lalu diarahkan ke wa.me dengan pesan awal terisi (AC-03.2).
export function HelpChip({ layar }: { layar: string }) {
  return (
    <a className="chip help-chip" href={`/api/bantuan?layar=${encodeURIComponent(layar)}`} target="_blank" rel="noopener">
      <span aria-hidden>💬</span> Bantuan
    </a>
  );
}

// Kartu bantuan penuh di titik rawan: landing, verifikasi gagal, pembayaran (AC-03.3).
export function HelpCard({ layar }: { layar: string }) {
  return (
    <div className="card soft stack" style={{ ["--gap" as string]: "8px" }}>
      <h3>Ada yang bikin bingung?</h3>
      <p className="muted">Chat tim Nawasena lewat WhatsApp. {WA_HOURS}.</p>
      <a className="btn btn-secondary" href={`/api/bantuan?layar=${encodeURIComponent(layar)}`} target="_blank" rel="noopener">
        Chat lewat WhatsApp
      </a>
    </div>
  );
}
