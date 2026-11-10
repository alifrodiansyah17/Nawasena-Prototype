// POST /functions/v1/refund — flow refund (docs/flow-refund-nawasena.pdf)
//   Pengguna : { aksi: "ajukan", jenis: "bank"|"ewallet", nama, nomor, pemilik, milik_lain }
//   Admin    : { aksi: "proses", id }                                                   → izin refund:u
//              { aksi: "selesaikan", id, bukti: { nama, tipe, data(base64) }, tanggal, nominal, biaya } → izin refund:u
//              { aksi: "tolak", id, alasan }                                             → izin refund:u
// Aturan bisnis ada di fungsi database (syarat_refund, ajukan/proses/selesaikan/tolak_refund). Fungsi ini menambah
// unggah bukti transfer ke bucket privat `refund` dan email ke pengguna di setiap perubahan status.
import { adminDb, CORS, esc, json, penggunaDari } from "./_shared/umum.ts";
import { bungkusEmail, kirimEmail, type Lampiran } from "./_shared/surel.ts";
import { punyaIzin } from "./_shared/izin.ts";

const EKSTENSI: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };
const ALASAN: Record<string, string> = { nominal: "nominal transfer tidak sesuai tagihan", analisis: "analisis arah karir gagal disusun" };

function rp(n: number): string { return "Rp" + Math.round(n || 0).toLocaleString("id-ID"); }
function wib(iso: string): string {
  const B = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const w = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  return `${w.getUTCDate()} ${B[w.getUTCMonth()]} ${w.getUTCFullYear()}, ${String(w.getUTCHours()).padStart(2, "0")}.${String(w.getUTCMinutes()).padStart(2, "0")} WIB`;
}
function samarkan(nomor: string): string { return nomor.length > 4 ? "•••• " + nomor.slice(-4) : nomor; }
function bacaBukti(k: unknown): Lampiran {
  const o = (k || {}) as { nama?: string; tipe?: string; data?: string };
  const tipe = String(o.tipe || "").toLowerCase();
  if (!EKSTENSI[tipe]) throw new Error("Bukti transfer harus PDF, JPG, atau PNG");
  let isi: Uint8Array;
  try { const bin = atob(String(o.data || "")); isi = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) isi[i] = bin.charCodeAt(i); }
  catch { throw new Error("File bukti transfer tidak terbaca, coba unggah ulang"); }
  if (!isi.length) throw new Error("Bukti transfer refund wajib diunggah");
  if (isi.length > 5 * 1024 * 1024) throw new Error("Bukti transfer maksimal 5 MB");
  const nama = String(o.nama || "").replace(/[^\w.\- ]+/g, "").trim().slice(0, 80) || `bukti-refund.${EKSTENSI[tipe]}`;
  return { nama, tipe, isi };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const user = await penggunaDari(req);
    if (!user) return json({ galat: "Sesi habis, silakan masuk lagi" }, 401);
    const body = await req.json().catch(() => ({}));
    const aksi = String(body.aksi || "");
    const db = adminDb();
    const app = Deno.env.get("APP_URL") || "";
    const tautan = app ? `<p><a href="${app}" style="color:#0284C7;font-weight:bold">Buka Nawasena</a></p>` : "";
    const profil = async (uid: string) => (await db.from("profil").select("nama, email").eq("id", uid).single()).data || { nama: "", email: "" };

    // ---------------------------------------------------------------- pengguna
    if (aksi === "ajukan") {
      const { data: r, error } = await db.rpc("ajukan_refund", {
        p_user: user.id, p_jenis: String(body.jenis || ""), p_nama: String(body.nama || ""), p_nomor: String(body.nomor || ""),
        p_pemilik: String(body.pemilik || ""), p_milik_lain: !!body.milik_lain,
      });
      if (error) return json({ galat: error.message }, 400);
      const p = await profil(user.id);
      await kirimEmail(p.email, `Refund ${r.kode} sudah kami terima`, bungkusEmail(
        `<p>Halo ${esc(p.nama)},</p><p>Pengajuan refund <b>${esc(r.kode)}</b> sebesar <b>${rp(r.nominal)}</b> (${esc(ALASAN[r.alasan] || r.alasan)}) sudah kami terima.</p>` +
        `<p>Dana dikirim ke <b>${esc(r.tujuan_nama)} ${esc(samarkan(r.tujuan_nomor))}</b> a.n. ${esc(r.tujuan_pemilik)} paling lambat <b>${wib(r.batas_sla)}</b>. Biaya admin ditanggung Nawasena.</p>` +
        (r.alasan === "nominal" ? `<p>Setelah dana kembali, silakan bayar ulang dengan nominal yang tertera di halaman pembayaran.</p>` : "") + tautan + `<p>— Nawasena</p>`));
      return json({ ok: true, refund: { id: r.id, kode: r.kode, status: r.status, batas_sla: r.batas_sla } });
    }

    // ---------------------------------------------------------------- admin
    if (!["proses", "selesaikan", "tolak"].includes(aksi)) return json({ galat: "Aksi tidak dikenal" }, 400);
    if (!(await punyaIzin(req, "refund", "u"))) return json({ galat: "Kamu tidak punya izin memproses refund, atau sesimu sudah lewat 24 jam" }, 403);
    const id = String(body.id || "");
    const { data: lama } = await db.from("refund").select("*").eq("id", id).maybeSingle();
    if (!lama) return json({ galat: "Refund tidak ditemukan" }, 404);

    if (aksi === "proses") {
      const { error } = await db.rpc("proses_refund", { p_admin: user.id, p_id: id });
      if (error) return json({ galat: error.message }, 409);
      return json({ ok: true });
    }

    if (aksi === "selesaikan") {
      const k = bacaBukti(body.bukti);
      const nominal = Math.round(Number(String(body.nominal ?? "").replace(/[^\d]/g, "")));
      const biaya = Math.round(Number(String(body.biaya ?? "").replace(/[^\d]/g, "")));
      if (nominal !== lama.nominal) return json({ galat: `Nominal transfer harus sama dengan nominal refund (${rp(lama.nominal)})` }, 400);
      if (!Number.isFinite(biaya) || biaya < 0) return json({ galat: "Isi biaya admin transfer (0 kalau gratis)" }, 400);
      const path = `${lama.user_id}/${lama.id}-${Date.now()}.${EKSTENSI[k.tipe]}`;
      const { error: e1 } = await db.storage.from("refund").upload(path, k.isi, { contentType: k.tipe, upsert: false });
      if (e1) throw new Error("Bukti transfer gagal disimpan: " + e1.message);
      const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(body.tanggal || "")) ? body.tanggal : null;
      const { data: r, error } = await db.rpc("selesaikan_refund", { p_admin: user.id, p_id: id, p_bukti_path: path, p_bukti_nama: k.nama, p_tanggal: tanggal, p_nominal: nominal, p_biaya: biaya });
      if (error) { await db.storage.from("refund").remove([path]); return json({ galat: error.message }, 409); }
      const p = await profil(lama.user_id);
      const terkirim = await kirimEmail(p.email, `Refund ${r.kode} sudah ditransfer`, bungkusEmail(
        `<p>Halo ${esc(p.nama)},</p><p>Refund <b>${esc(r.kode)}</b> sebesar <b>${rp(r.nominal)}</b> sudah kami transfer ke <b>${esc(r.tujuan_nama)} ${esc(samarkan(r.tujuan_nomor))}</b> a.n. ${esc(r.tujuan_pemilik)}. Bukti transfer terlampir.</p>` +
        (r.alasan === "nominal" ? `<p>Kamu bisa membayar ulang kapan saja dari halaman pembayaran. Pastikan nominalnya persis sampai 3 digit terakhir ya.</p>`
          : `<p>Order ini sudah direfund, jadi akses laporan lengkapnya ditutup. Kalau mau mencoba lagi, kamu bisa membeli ulang dari aplikasi.</p>`) +
        tautan + `<p>Terima kasih atas kesabarannya. — Nawasena</p>`), [k]);
      return json({ ok: true, email: terkirim });
    }

    // tolak
    const alasan = String(body.alasan || "").trim();
    if (!alasan) return json({ galat: "Alasan penolakan wajib diisi" }, 400);
    const { data: r, error } = await db.rpc("tolak_refund", { p_admin: user.id, p_id: id, p_alasan: alasan });
    if (error) return json({ galat: error.message }, 409);
    const p = await profil(lama.user_id);
    await kirimEmail(p.email, `Refund ${r.kode} perlu diperbaiki`, bungkusEmail(
      `<p>Halo ${esc(p.nama)},</p><p>Refund <b>${esc(r.kode)}</b> belum bisa kami proses: <b>${esc(alasan)}</b>.</p>` +
      `<p>Silakan perbaiki data rekening / e-wallet tujuan dan ajukan ulang dari aplikasi. Waktu proses 1×24 jam dihitung lagi sejak pengajuan baru.</p>` + tautan + `<p>— Nawasena</p>`));
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ galat: String((e as Error).message || e) }, 500);
  }
});
