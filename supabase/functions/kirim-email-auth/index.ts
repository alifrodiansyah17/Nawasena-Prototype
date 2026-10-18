// POST /functions/v1/kirim-email-auth — Send Email Hook untuk Supabase Auth.
// Supabase memanggil fungsi ini setiap kali mau mengirim email kode masuk / daftar, menggantikan SMTP.
// Email dicoba lewat beberapa penyedia secara berurutan: kalau penyedia pertama gagal (kuota habis, error),
// otomatis pindah ke cadangan berikutnya. Penyedia yang tidak diisi kuncinya dilewati.
//
// Secret yang dipakai (Supabase → Edge Functions → Secrets):
//   SEND_EMAIL_HOOK_SECRET   wajib, dari Authentication → Hooks → Send Email (format "v1,whsec_...")
//   EMAIL_PENGIRIM           mis. "Nawasena <support@nawasena.info>" (domain harus terverifikasi di tiap penyedia)
//   EMAIL_URUTAN             opsional, urutan penyedia, bawaan "resend,brevo,smtp2go"
//   RESEND_API_KEY / BREVO_API_KEY / SMTP2GO_API_KEY   isi minimal dua supaya ada cadangan
import { Webhook } from "npm:standardwebhooks@1.0.0";

interface Surat { ke: string; judul: string; html: string; teks: string }
type Penyedia = { nama: string; kunci: string; kirim: (s: Surat, dari: { email: string; nama: string }) => Promise<void> };

function pecahPengirim(x: string): { email: string; nama: string } {
  const m = /^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/.exec(x);
  return m ? { nama: m[1] || "Nawasena", email: m[2] } : { nama: "Nawasena", email: x.trim() };
}

async function cekBalasan(nama: string, r: Response) {
  if (r.ok) return;
  throw new Error(`${nama} ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

const PENYEDIA: Penyedia[] = [
  {
    nama: "resend", kunci: "RESEND_API_KEY",
    kirim: async (s, dari) => cekBalasan("resend", await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${dari.nama} <${dari.email}>`, to: [s.ke], subject: s.judul, html: s.html, text: s.teks }),
      signal: AbortSignal.timeout(8000),
    })),
  },
  {
    nama: "brevo", kunci: "BREVO_API_KEY",
    kirim: async (s, dari) => cekBalasan("brevo", await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": Deno.env.get("BREVO_API_KEY")!, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sender: { name: dari.nama, email: dari.email }, to: [{ email: s.ke }], subject: s.judul, htmlContent: s.html, textContent: s.teks }),
      signal: AbortSignal.timeout(8000),
    })),
  },
  {
    nama: "smtp2go", kunci: "SMTP2GO_API_KEY",
    kirim: async (s, dari) => {
      const r = await fetch("https://api.smtp2go.com/v3/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Smtp2go-Api-Key": Deno.env.get("SMTP2GO_API_KEY")! },
        body: JSON.stringify({ sender: `${dari.nama} <${dari.email}>`, to: [s.ke], subject: s.judul, html_body: s.html, text_body: s.teks }),
        signal: AbortSignal.timeout(8000),
      });
      await cekBalasan("smtp2go", r);
      const j = await r.json().catch(() => ({}));
      if (j?.data?.failed > 0) throw new Error("smtp2go: " + JSON.stringify(j.data).slice(0, 300));
    },
  },
];

function esc(x: string) {
  return x.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Isi email kode 6 angka. Aplikasi Nawasena hanya memakai kode (bukan tautan). */
function susunSurat(ke: string, aksi: string, kode: string): Surat {
  const daftar = aksi === "signup" || aksi === "invite";
  const judul = daftar ? `Kode daftar Nawasena: ${kode}` : `Kode masuk Nawasena: ${kode}`;
  const pembuka = daftar ? "Ini kode untuk menyelesaikan pendaftaranmu di Nawasena." : "Ini kode untuk masuk ke akun Nawasena-mu.";
  const teks = `${pembuka}\n\nKode: ${kode}\n\nKode ini berlaku sebentar saja. Kalau kamu tidak merasa meminta kode ini, abaikan email ini.\n\n— Nawasena, Sahabat karirmu`;
  const html = `<!doctype html><html><body style="margin:0;background:#F0F9FF;font-family:Arial,Helvetica,sans-serif;color:#1E293B">
<div style="max-width:480px;margin:0 auto;padding:28px 16px">
<div style="background:#FFFFFF;border:1px solid #E0F2FE;border-radius:16px;padding:28px 24px">
<div style="font-size:18px;font-weight:bold;color:#0284C7">Nawasena</div>
<p style="font-size:15px;line-height:1.6;margin:18px 0 8px">${esc(pembuka)}</p>
<div style="font-size:34px;font-weight:bold;letter-spacing:8px;color:#0F172A;background:#F0F9FF;border-radius:12px;padding:16px;text-align:center;margin:12px 0 16px">${esc(kode)}</div>
<p style="font-size:13px;line-height:1.6;color:#64748B;margin:0">Kode ini berlaku sebentar saja. Kalau kamu tidak merasa meminta kode ini, abaikan email ini.</p>
</div>
<p style="font-size:12px;color:#94A3B8;text-align:center;margin-top:16px">Nawasena · Sahabat karirmu</p>
</div></body></html>`;
  return { ke, judul, html, teks };
}

function gagal(pesan: string, status = 500) {
  return new Response(JSON.stringify({ error: { http_code: status, message: pesan } }), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("not allowed", { status: 400 });
  const rahasia = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") || "").replace("v1,whsec_", "");
  if (!rahasia) return gagal("SEND_EMAIL_HOOK_SECRET belum diisi");

  // deno-lint-ignore no-explicit-any
  let data: any;
  try {
    data = new Webhook(rahasia).verify(await req.text(), Object.fromEntries(req.headers));
  } catch {
    return gagal("Tanda tangan hook tidak valid", 401);
  }
  const ke = String(data?.user?.email || "");
  const ed = data?.email_data || {};
  const kode = String(ed.token || ed.token_new || "");
  if (!ke || !kode) return gagal("Data email tidak lengkap", 400);

  const dari = pecahPengirim(Deno.env.get("EMAIL_PENGIRIM") || "Nawasena <support@nawasena.info>");
  const urutan = (Deno.env.get("EMAIL_URUTAN") || "resend,brevo,smtp2go").split(",").map((x) => x.trim().toLowerCase());
  const siap = urutan.map((n) => PENYEDIA.find((p) => p.nama === n)).filter((p): p is Penyedia => !!p && !!Deno.env.get(p.kunci));
  if (!siap.length) return gagal("Belum ada kunci penyedia email (RESEND_API_KEY / BREVO_API_KEY / SMTP2GO_API_KEY)");

  const surat = susunSurat(ke, String(ed.email_action_type || ""), kode);
  const galat: string[] = [];
  for (const p of siap) {
    try {
      await p.kirim(surat, dari);
      if (galat.length) console.warn(`email terkirim lewat cadangan ${p.nama} setelah gagal:`, galat.join(" | "));
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (e) {
      galat.push(String((e as Error).message || e));
    }
  }
  console.error("semua penyedia email gagal:", galat.join(" | "));
  return gagal("Email belum bisa dikirim. Coba lagi beberapa saat lagi.");
});
