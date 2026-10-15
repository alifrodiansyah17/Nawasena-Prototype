import "server-only";

// Email transaksional (konfirmasi / penolakan pembayaran). Memakai Resend kalau
// RESEND_API_KEY diisi; kalau tidak, hanya dicatat di log server.
export async function sendEmail(to: string | null | undefined, subject: string, text: string) {
  if (!to) return;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email:dev] to=${to} subject=${subject}`);
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Nawasena <halo@nawasena.id>",
        to,
        subject,
        text,
      }),
    });
  } catch (e) {
    console.error("email gagal", e);
  }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function confirmedEmail(nickname: string, orderNo: string) {
  return {
    subject: "Pembayaranmu sudah terkonfirmasi",
    text: `Halo ${nickname},\n\nTim Nawasena sudah mengecek pembayaranmu untuk pesanan ${orderNo}. Enam bagian Peta Potensimu sudah kebuka.\n\nBaca di sini: ${APP_URL}/peta\n\nSalam,\nNawasena`,
  };
}

export function rejectedEmail(nickname: string, orderNo: string, reason: string) {
  return {
    subject: "Bukti bayarmu belum bisa dikonfirmasi",
    text: `Halo ${nickname},\n\nBukti bayar untuk pesanan ${orderNo} belum bisa kami konfirmasi.\nAlasannya: ${reason}.\n\nKamu bisa kirim ulang bukti bayar di sini: ${APP_URL}/bayar/status\n\nSalam,\nNawasena`,
  };
}
