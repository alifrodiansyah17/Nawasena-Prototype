// Email transaksi (konfirmasi pembayaran + receipt, penolakan, laporan selesai).
// Dikirim lewat SMTP lebih dulu; kalau gagal atau belum diisi, dicoba penyedia HTTP cadangan.
// Penyedia yang kuncinya kosong dilewati.
//
// Secret (Supabase → Edge Functions → Secrets):
//   SMTP_HOST, SMTP_PORT (bawaan 465), SMTP_USER, SMTP_PASS   SMTP utama. Port 25 dan 587 diblokir Edge Functions, pakai 465.
//   EMAIL_PENGIRIM            mis. "Nawasena <support@nawasena.info>"
//   EMAIL_URUTAN_TRANSAKSI    opsional, bawaan "smtp,resend,brevo,smtp2go"
//   RESEND_API_KEY / BREVO_API_KEY / SMTP2GO_API_KEY   cadangan (opsional)
import nodemailer from "npm:nodemailer@6.9.16";

export interface Lampiran { nama: string; tipe: string; isi: Uint8Array }

function keBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

function pecahPengirim(x: string): { email: string; nama: string } {
  const m = /^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/.exec(x);
  return m ? { nama: m[1] || "Nawasena", email: m[2] } : { nama: "Nawasena", email: x.trim() };
}

async function cekBalasan(nama: string, r: Response) {
  if (r.ok) return;
  throw new Error(`${nama} ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

interface Surat { ke: string; judul: string; html: string; teks: string; lampiran: Lampiran[] }
type Kirim = (s: Surat, dari: { email: string; nama: string }) => Promise<void>;

const PENYEDIA: Record<string, { siap: () => boolean; kirim: Kirim }> = {
  smtp: {
    siap: () => !!(Deno.env.get("SMTP_HOST") && Deno.env.get("SMTP_USER") && Deno.env.get("SMTP_PASS")),
    kirim: async (s, dari) => {
      const port = Number(Deno.env.get("SMTP_PORT") || 465);
      const t = nodemailer.createTransport({
        host: Deno.env.get("SMTP_HOST"), port, secure: port === 465,
        auth: { user: Deno.env.get("SMTP_USER"), pass: Deno.env.get("SMTP_PASS") },
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
      });
      await t.sendMail({
        from: `${dari.nama} <${dari.email}>`, to: s.ke, subject: s.judul, html: s.html, text: s.teks,
        attachments: s.lampiran.map((l) => ({ filename: l.nama, content: keBase64(l.isi), encoding: "base64", contentType: l.tipe })),
      });
    },
  },
  resend: {
    siap: () => !!Deno.env.get("RESEND_API_KEY"),
    kirim: async (s, dari) => cekBalasan("resend", await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${dari.nama} <${dari.email}>`, to: [s.ke], subject: s.judul, html: s.html, text: s.teks,
        attachments: s.lampiran.map((l) => ({ filename: l.nama, content: keBase64(l.isi) })),
      }),
      signal: AbortSignal.timeout(15000),
    })),
  },
  brevo: {
    siap: () => !!Deno.env.get("BREVO_API_KEY"),
    kirim: async (s, dari) => cekBalasan("brevo", await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": Deno.env.get("BREVO_API_KEY")!, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: dari.nama, email: dari.email }, to: [{ email: s.ke }], subject: s.judul, htmlContent: s.html, textContent: s.teks,
        ...(s.lampiran.length ? { attachment: s.lampiran.map((l) => ({ name: l.nama, content: keBase64(l.isi) })) } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    })),
  },
  smtp2go: {
    siap: () => !!Deno.env.get("SMTP2GO_API_KEY"),
    kirim: async (s, dari) => {
      const r = await fetch("https://api.smtp2go.com/v3/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Smtp2go-Api-Key": Deno.env.get("SMTP2GO_API_KEY")! },
        body: JSON.stringify({
          sender: `${dari.nama} <${dari.email}>`, to: [s.ke], subject: s.judul, html_body: s.html, text_body: s.teks,
          attachments: s.lampiran.map((l) => ({ filename: l.nama, fileblob: keBase64(l.isi), mimetype: l.tipe })),
        }),
        signal: AbortSignal.timeout(15000),
      });
      await cekBalasan("smtp2go", r);
      const j = await r.json().catch(() => ({}));
      if (j?.data?.failed > 0) throw new Error("smtp2go: " + JSON.stringify(j.data).slice(0, 300));
    },
  },
};

/** Kirim email. true kalau terkirim lewat salah satu penyedia; tidak pernah melempar galat. */
export async function kirimEmail(ke: string, judul: string, html: string, lampiran: Lampiran[] = []): Promise<boolean> {
  if (!ke) return false;
  const dari = pecahPengirim(Deno.env.get("EMAIL_PENGIRIM") || "Nawasena <support@nawasena.info>");
  const teks = html.replace(/<br\s*\/?>|<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();
  const surat: Surat = { ke, judul, html, teks, lampiran };
  const urutan = (Deno.env.get("EMAIL_URUTAN_TRANSAKSI") || "smtp,resend,brevo,smtp2go").split(",").map((x) => x.trim().toLowerCase());
  const galat: string[] = [];
  for (const n of urutan) {
    const p = PENYEDIA[n];
    if (!p || !p.siap()) continue;
    try {
      await p.kirim(surat, dari);
      if (galat.length) console.warn(`email "${judul}" terkirim lewat ${n} setelah gagal:`, galat.join(" | "));
      return true;
    } catch (e) {
      galat.push(`${n}: ${String((e as Error).message || e).slice(0, 300)}`);
    }
  }
  console.error(`email "${judul}" ke ${ke} tidak terkirim:`, galat.length ? galat.join(" | ") : "belum ada penyedia email yang diisi");
  return false;
}

/** Tampilan email Nawasena (warna DSL), isi berupa HTML yang sudah di-escape. */
export function bungkusEmail(isi: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F0F9FF;font-family:Arial,Helvetica,sans-serif;color:#0F172A">
<div style="max-width:520px;margin:0 auto;padding:28px 16px">
<div style="background:#FFFFFF;border:1px solid #E0F2FE;border-bottom:4px solid #FACC15;border-radius:16px;padding:28px 24px;font-size:15px;line-height:1.6">
<div style="font-size:18px;font-weight:bold;color:#0284C7;margin-bottom:14px">Nawasena</div>
${isi}
</div>
<p style="font-size:12px;color:#64748B;text-align:center;margin-top:16px">Nawasena · Sahabat karirmu · support@nawasena.info</p>
</div></body></html>`;
}
