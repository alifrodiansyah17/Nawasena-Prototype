// POST /functions/v1/konfirmasi — dipakai backoffice.
//   { pesanan_id, aksi: "ok", kwitansi, nominal_bukti? } → simpan receipt, tandai lunas, mulai susun Bagian 2–6,
//                                                         lalu kirim email konfirmasi dengan receipt terlampir
//   { pesanan_id, aksi: "kwitansi", kwitansi }           → pesanan yang sudah lunas: unggah/ganti receipt dan kirim ulang
//   { pesanan_id, aksi: "tolak", alasan, nominal_bukti? } → tolak dengan alasan (pengguna bisa kirim ulang bukti)
//   { pesanan_id, aksi: "batal" }                         → kembalikan ke Menunggu (keputusan sendiri, maks. 15 menit)
// kwitansi = { nama, tipe, data } dengan data berisi isi file dalam base64 (PDF/JPG/PNG, maks. 5 MB). Wajib untuk "ok".
// Keputusan lewat fungsi database putuskan_pesanan: keputusan pertama yang tersimpan menang,
// dan setiap keputusan tercatat di audit_admin.
import { adminDb, CORS, esc, json, penggunaDari, picuFungsi } from "./_shared/umum.ts";
import { bungkusEmail, kirimEmail, type Lampiran } from "./_shared/surel.ts";

const BATAS_KWITANSI = 5 * 1024 * 1024;
const EKSTENSI: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };

function bacaKwitansi(k: unknown): Lampiran {
  const o = (k || {}) as { nama?: string; tipe?: string; data?: string };
  const tipe = String(o.tipe || "").toLowerCase();
  if (!EKSTENSI[tipe]) throw new Error("Receipt harus berupa PDF, JPG, atau PNG");
  let isi: Uint8Array;
  try {
    const bin = atob(String(o.data || ""));
    isi = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) isi[i] = bin.charCodeAt(i);
  } catch {
    throw new Error("File receipt tidak terbaca, coba unggah ulang");
  }
  if (!isi.length) throw new Error("Receipt pembayaran wajib diunggah sebelum konfirmasi");
  if (isi.length > BATAS_KWITANSI) throw new Error("Receipt maksimal 5 MB");
  const nama = String(o.nama || "").replace(/[^\w.\- ]+/g, "").trim().slice(0, 80) || `receipt.${EKSTENSI[tipe]}`;
  return { nama, tipe, isi };
}

function rp(n: number): string {
  return "Rp" + Math.round(n || 0).toLocaleString("id-ID");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const user = await penggunaDari(req);
    if (!user) return json({ galat: "Sesi habis, silakan masuk lagi" }, 401);
    const db = adminDb();
    const { data: adm } = await db.from("admin").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adm) return json({ galat: "Akun ini bukan admin" }, 403);

    const { pesanan_id, aksi, alasan, nominal_bukti, kwitansi } = await req.json();
    const { data: ps } = await db.from("pesanan").select("*, profil(nama, email)").eq("id", pesanan_id).single();
    if (!ps) return json({ galat: "Pesanan tidak ditemukan" }, 404);
    const app = Deno.env.get("APP_URL") || "";
    const nominal = Number.isFinite(Number(nominal_bukti)) && Number(nominal_bukti) > 0 ? Math.round(Number(nominal_bukti)) : null;

    const putuskan = async (a: string, alasanTolak: string | null = null) => {
      const { data, error } = await db.rpc("putuskan_pesanan", {
        p_pesanan: pesanan_id, p_admin: user.id, p_aksi: a, p_alasan: alasanTolak, p_nominal: nominal,
      });
      if (error) throw new Error(error.message);
      return data && (data as { id?: string }).id ? data : null;
    };

    // Simpan receipt ke storage (bucket privat `kwitansi`), lalu catat di pesanan
    const simpanKwitansi = async (k: Lampiran) => {
      const path = `${ps.user_id}/${ps.id}-${Date.now()}.${EKSTENSI[k.tipe]}`;
      const { error } = await db.storage.from("kwitansi").upload(path, k.isi, { contentType: k.tipe, upsert: false });
      if (error) throw new Error("Receipt gagal disimpan: " + error.message);
      const { error: e2 } = await db.from("pesanan").update({ kwitansi_path: path, kwitansi_nama: k.nama }).eq("id", ps.id);
      if (e2) throw new Error("Receipt gagal dicatat: " + e2.message);
      return path;
    };

    const kirimKwitansi = async (k: Lampiran, judul: string) => {
      const ok = await kirimEmail(ps.profil.email, judul, bungkusEmail(
        `<p>Halo ${esc(ps.profil.nama)},</p>` +
        `<p>Pembayaran <b>${esc(ps.kode)}</b> sebesar <b>${rp(nominal || ps.nominal)}</b> sudah kami terima. Terima kasih!</p>` +
        `<p>Receipt pembayaranmu terlampir di email ini. Simpan sebagai bukti transaksi ya.</p>` +
        `<p>Keenam bagian peta potensimu sedang disusun dan biasanya siap dalam beberapa menit.</p>` +
        (app ? `<p><a href="${app}" style="color:#0284C7;font-weight:bold">Buka peta potensimu</a></p>` : "") +
        `<p>Ada pertanyaan? Balas email ini atau hubungi support@nawasena.info.</p><p>— Nawasena</p>`), [k]);
      if (ok) await db.from("pesanan").update({ kwitansi_terkirim: new Date().toISOString() }).eq("id", ps.id);
      return ok;
    };

    if (aksi === "ok") {
      // Sudah lunas: cukup picu ulang penyusunan laporan (berguna kalau laporan macet).
      if (ps.status === "ok") {
        await picuFungsi("laporan-lengkap", { user_id: ps.user_id });
        return json({ ok: true });
      }
      const k = bacaKwitansi(kwitansi);   // wajib, dicek sebelum keputusan disimpan
      if (ps.status !== "menunggu") {
        return json({ galat: "Pesanan ini sudah diputuskan admin lain. Muat ulang untuk melihat status terbaru." }, 409);
      }
      await simpanKwitansi(k);
      if (!(await putuskan("ok"))) {
        return json({ galat: "Pesanan ini sudah diputuskan admin lain. Muat ulang untuk melihat status terbaru." }, 409);
      }
      await picuFungsi("laporan-lengkap", { user_id: ps.user_id });
      const terkirim = await kirimKwitansi(k, `Pembayaran ${ps.kode} sudah dikonfirmasi`);
      return json({ ok: true, email: terkirim });
    }

    if (aksi === "kwitansi") {
      if (ps.status !== "ok") return json({ galat: "Receipt hanya untuk pesanan yang sudah dikonfirmasi" }, 400);
      const k = bacaKwitansi(kwitansi);
      await simpanKwitansi(k);
      const terkirim = await kirimKwitansi(k, `Receipt pembayaran ${ps.kode}`);
      return json({ ok: true, email: terkirim });
    }

    if (aksi === "tolak") {
      const a = String(alasan || "").trim();
      if (!a) return json({ galat: "Alasan penolakan wajib diisi" }, 400);
      if (!(await putuskan("tolak", a))) {
        return json({ galat: "Pesanan ini sudah diputuskan admin lain. Muat ulang untuk melihat status terbaru." }, 409);
      }
      await kirimEmail(ps.profil.email, "Bukti pembayaranmu perlu dikirim ulang", bungkusEmail(
        `<p>Halo ${esc(ps.profil.nama)},</p><p>Bukti pembayaran ${esc(ps.kode)} belum bisa kami konfirmasi: ${esc(a)}</p>` +
        `<p>Kamu bisa kirim ulang buktinya dari halaman pembayaran.</p>` +
        (app ? `<p><a href="${app}" style="color:#0284C7;font-weight:bold">Buka Nawasena</a></p>` : "") + `<p>— Nawasena</p>`));
      return json({ ok: true });
    }

    if (aksi === "batal") {
      if (!(await putuskan("batal"))) {
        return json({ galat: "Keputusan ini sudah tidak bisa dibatalkan: lewat 15 menit, atau bukan keputusanmu." }, 409);
      }
      return json({ ok: true });
    }
    return json({ galat: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    console.error(e);
    return json({ galat: String((e as Error).message || e) }, 500);
  }
});
