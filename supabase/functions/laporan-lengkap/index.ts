// POST /functions/v1/laporan-lengkap
// Menyusun Bagian 2–6 setelah pembayaran dikonfirmasi. Dibagi tiga potongan supaya tiap panggilan
// selesai di bawah batas 150 detik Supabase Free:
//   1. rencana  → Bagian 2, 3, 4 + enam nama arah + pembuka Bagian 5
//   2. arahA    → rincian arah 1–3                         (jalan bersamaan dengan arahB)
//   3. arahB    → rincian arah 4–6 + tempat kerja + Bagian 6
// Pemicu: fungsi `konfirmasi` (admin), atau aplikasi pengguna kalau statusnya belum/gagal/macet.
import { adminDb, CORS, esc, json, latar, panggilanInternal, penggunaDari, picuFungsi } from "./_shared/umum.ts";
import { bungkusEmail, kirimEmail } from "./_shared/surel.ts";
import { ambilKonteks } from "./_shared/konteks.ts";
import { tanyaClaude } from "./_shared/claude.ts";
import { GAYA, jumlahArahTarget, kelArah, skemaArahA, skemaArahB, skemaRencana, TUGAS_ARAH_A, TUGAS_ARAH_B, TUGAS_RENCANA } from "./_shared/panduan.ts";
import { bahasaTeks, rapikanIsi } from "./_shared/rapikan.ts";

const SEMUA = ["rencana", "arahA", "arahB"];
const LABEL_GAJI = ["a. Saat masuk peran ini:", "b. 2–4 tahun di peran ini:", "c. Senior atau manajer:"];

interface PeranRef { id: string; nama: string; rumpun: string; fungsi: string; gaji_masuk: string; gaji_menengah: string; gaji_senior: string }
const BATAS_MACET_MS = 5 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const db = adminDb();
    const internal = await panggilanInternal(req);

    // ---- potongan tertentu (hanya dari server)
    if (internal && body.langkah && body.user_id) {
      latar(jalankanPotongan(body.user_id, body.langkah));
      return json({ ok: true }, 202);
    }

    // ---- mulai / lanjutkan (pengguna sendiri, atau server dengan user_id)
    let userId: string | null = null;
    if (internal && body.user_id) userId = body.user_id;
    else userId = (await penggunaDari(req))?.id ?? null;
    if (!userId) return json({ galat: "Sesi habis, silakan masuk lagi" }, 401);

    const { data: lunas } = await db.rpc("sudah_lunas", { p_user: userId });
    if (!lunas) return json({ galat: "Pembayaran belum dikonfirmasi" }, 402);

    const { data: row } = await db.from("laporan_lengkap").select("*").eq("user_id", userId).maybeSingle();
    if (row?.status === "siap") return json({ status: "siap" });
    const macet = row?.status === "proses" && Date.now() - new Date(row.diubah).getTime() > BATAS_MACET_MS;
    if (row?.status === "proses" && !macet) return json({ status: "proses" }, 202);

    const st = (row?.bagian_status || {}) as Record<string, string>;
    await db.from("laporan_lengkap").upsert({
      user_id: userId, status: "proses", galat: null, mulai: new Date().toISOString(), diubah: new Date().toISOString(),
      bagian: row?.bagian || {}, bagian_status: Object.fromEntries(Object.entries(st).filter(([, v]) => v === "siap")),
    });
    if (st.rencana !== "siap") await picuFungsi("laporan-lengkap", { user_id: userId, langkah: "rencana" });
    else {
      for (const k of ["arahA", "arahB"]) if (st[k] !== "siap") await picuFungsi("laporan-lengkap", { user_id: userId, langkah: k });
    }
    return json({ status: "proses" }, 202);
  } catch (e) {
    console.error(e);
    return json({ galat: String((e as Error).message || e) }, 500);
  }
});

/** Pelanggaran aturan di rencana: arah 1..N bukan pilihan pengguna, atau 'sdh' Bagian 4 tidak memakai bahasa CV. */
function cekRencana(data: Record<string, unknown>, pilihan: string[], bahasaCv: string): string[] {
  const salah: string[] = [];
  const arah = (Array.isArray(data.arah) ? data.arah : []) as { nama?: string }[];
  const inti = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  pilihan.forEach((p, i) => {
    const nama = String(arah[i]?.nama || "");
    if (!inti(nama).startsWith(inti(p))) salah.push(`arah ${i + 1} harus diawali «${p}» (pilihan pengguna), bukan «${nama}»`);
  });
  const b4 = (data.b4 || {}) as { banding?: { sblm?: string; sdh?: string }[] };
  (b4.banding || []).forEach((b, i) => {
    if (b.sdh && bahasaTeks(b.sdh) !== bahasaCv) salah.push(`b4.banding ${i + 1}: 'sdh' harus bahasa ${bahasaCv}, sama dengan CV`);
  });
  return salah;
}

// Tipe karir tidak boleh "mundur": tuju dan bentuk tiap jalan minimal setingkat dengan posisi sekarang.
const TINGKAT: Record<string, number> = { "—": 0, I: 1, T: 1, V: 2, "π": 2, M: 3, X: 3 };
function rapikanTipe(b2?: Record<string, unknown>) {
  if (!b2) return;
  const kamu = typeof b2.kamu === "string" && b2.kamu in TINGKAT ? b2.kamu : "—";
  const maju = (k: unknown) => (typeof k === "string" && k in TINGKAT && TINGKAT[k] >= TINGKAT[kamu] ? k : kamu);
  b2.kamu = kamu;
  b2.tuju = maju(b2.tuju);
  if (Array.isArray(b2.jalan)) b2.jalan = (b2.jalan as Record<string, unknown>[]).map((j) => ({ ...j, bentuk: maju(j.bentuk) }));
  if (typeof b2.catatan === "string") b2.catatan = b2.catatan.replace(/^\s*yang perlu kamu timbang\s*(adalah|:)?\s*/i, "");
}

async function jalankanPotongan(userId: string, langkah: string) {
  const db = adminDb();
  try {
    await db.rpc("tandai_potongan", { p_user: userId, p_kunci: langkah, p_nilai: "proses" });

    const k = await ambilKonteks(db, userId);
    const { data: lap } = await db.from("laporan").select("bagian1").eq("user_id", userId).single();
    const b1 = JSON.stringify(lap?.bagian1 || {});
    const levelCv = (lap?.bagian1 as Record<string, string>)?.level_cv || k.levelUsia;
    // Fakta yang sudah tampil di sampul dan Bagian 1: semua bagian lain wajib memakai angka yang sama.
    const bg1 = (lap?.bagian1 || {}) as { tahun_kerja?: number; peran_kini?: string };
    const bahasaCv = bahasaTeks(k.teks.split("=== CV")[1]?.split("=== LAMPIRAN")[0] || "");
    const pilihan = k.targetDaftar.slice(0, jumlahArahTarget(k.targetDaftar.length));
    const fakta = `=== FAKTA TETAP (sudah tampil di sampul dan Bagian 1; wajib sama di semua bagian) ===\n` +
      (bg1.peran_kini ? `Jabatan sekarang: ${bg1.peran_kini}\nLama pengalaman kerja penuh waktu: ${Math.round(Number(bg1.tahun_kerja) || 0)} tahun (tulis angka ini, bukan angka lain dari CV)\n` : "Belum pernah bekerja penuh waktu.\n") +
      `Bahasa CV: ${bahasaCv}` + (pilihan.length && k.targetJenis ? `\nArah 1 sampai ${pilihan.length} WAJIB: ${pilihan.map((x, i) => `${i + 1}. ${x}`).join("; ")}` : "");

    // Tabel referensi peran dan gaji (PRD R4): gaji tidak pernah ditulis model.
    const { data: peranRows } = await db.from("peran_referensi").select("id, nama, rumpun, fungsi, gaji_masuk, gaji_menengah, gaji_senior").eq("aktif", true).order("id");
    const peran = (peranRows || []) as PeranRef[];
    if (!peran.length) throw new Error("Tabel peran_referensi kosong");

    let isi: Record<string, unknown> = {};
    if (langkah === "rencana") {
      const tabel = peran.map((p) => `${p.id} | ${p.nama} | ${p.rumpun} | ${p.fungsi}`).join("\n");
      const { data, contoh } = await tanyaClaude<Record<string, unknown>>({
        system: GAYA,
        pesan: `${k.teks}\nLevel dari lama kerja di CV: ${levelCv}\n\n${fakta}\n\n=== BAGIAN 1 YANG SUDAH DIBACA PENGGUNA (konteks, jangan diulang) ===\n${b1}\n\n=== TABEL REFERENSI PERAN (id | nama | rumpun | fungsi) ===\n${tabel}\n\n${TUGAS_RENCANA}`,
        skema: skemaRencana(peran.map((p) => p.id)),
        maxTokens: 16000,
      });
      // Cek dua aturan yang sering dilanggar model; kalau dilanggar, minta tulis ulang sekali dengan catatan perbaikannya.
      const salah = cekRencana(data, pilihan, bahasaCv);
      if (salah.length && !contoh) {
        console.warn("rencana diulang:", salah.join(" | "));
        const ulang = await tanyaClaude<Record<string, unknown>>({
          system: GAYA,
          pesan: `${k.teks}\nLevel dari lama kerja di CV: ${levelCv}\n\n${fakta}\n\n=== BAGIAN 1 YANG SUDAH DIBACA PENGGUNA (konteks, jangan diulang) ===\n${b1}\n\n=== TABEL REFERENSI PERAN (id | nama | rumpun | fungsi) ===\n${tabel}\n\n${TUGAS_RENCANA}\n\nPERBAIKAN WAJIB (versi sebelumnya salah di sini):\n- ${salah.join("\n- ")}`,
          skema: skemaRencana(peran.map((p) => p.id)),
          maxTokens: 16000,
        }).catch((e) => { console.error("ulang rencana gagal", e); return null; });
        if (ulang && cekRencana(ulang.data, pilihan, bahasaCv).length <= salah.length) Object.assign(data, ulang.data);
      }
      if (Array.isArray(data.arah)) {
        const dipakai = new Set<string>();
        data.arah = (data.arah as Record<string, unknown>[]).map((a, i) => {
          // peran_id dobel atau di luar tabel dikosongkan; arah itu tampil tanpa kisaran gaji.
          let id = typeof a.peran_id === "string" && peran.some((p) => p.id === a.peran_id) ? a.peran_id : null;
          if (id && dipakai.has(id)) id = null;
          if (id) dipakai.add(id);
          return { ...a, peran_id: id, kel: kelArah(k.targetJenis, i, k.targetDaftar.length) };
        });
      }
      rapikanTipe(data.b2 as Record<string, unknown> | undefined);
      if (contoh) data.contoh = true;
      isi = { rencana: data };
    } else {
      const { data: ll } = await db.from("laporan_lengkap").select("bagian").eq("user_id", userId).single();
      const rencana = (ll?.bagian as Record<string, unknown>)?.rencana;
      if (!rencana) throw new Error("Rencana belum ada");
      const a = langkah === "arahA";
      const { data } = await tanyaClaude<Record<string, unknown>>({
        system: GAYA,
        pesan: `${k.teks}\nLevel dari lama kerja di CV: ${levelCv}\n\n${fakta}\n\n=== BAGIAN 1 ===\n${b1}\n\n=== RENCANA BAGIAN 2–5 (sudah ditulis, ikuti) ===\n${JSON.stringify(rencana)}\n\n${a ? TUGAS_ARAH_A : TUGAS_ARAH_B}`,
        skema: a ? skemaArahA() : skemaArahB(),
        maxTokens: 16000,
      });
      // Isi kisaran gaji dari tabel, menurut peran_id di rencana (arahA = arah 1–3, arahB = arah 4–6).
      const arahRencana = ((rencana as Record<string, unknown>).arah || []) as { peran_id?: string | null }[];
      const geser = a ? 0 : 3;
      if (Array.isArray(data.peran)) {
        data.peran = (data.peran as Record<string, unknown>[]).map((p, i) => {
          const ref = peran.find((r) => r.id === arahRencana[i + geser]?.peran_id);
          if (!ref) return p;
          return { ...p, gaji: [ref.gaji_masuk, ref.gaji_menengah, ref.gaji_senior].map((v, j) => ({ k: LABEL_GAJI[j], v })) };
        });
      }
      isi = { [langkah]: data };
    }

    isi = rapikanIsi(isi);   // buang kode internal kuis dan kurung siku di sekitar angka
    const { data: hasil, error } = await db.rpc("simpan_potongan", { p_user: userId, p_kunci: langkah, p_isi: isi, p_semua: SEMUA });
    if (error) throw error;

    if (langkah === "rencana") {
      await Promise.all([
        picuFungsi("laporan-lengkap", { user_id: userId, langkah: "arahA" }),
        picuFungsi("laporan-lengkap", { user_id: userId, langkah: "arahB" }),
      ]);
    }
    if (hasil === "siap") {
      const url = Deno.env.get("APP_URL") || "";
      await kirimEmail(k.email, "Peta potensimu sudah lengkap", bungkusEmail(
        `<p>Halo ${esc(k.nama)},</p><p>Keenam bagian peta potensimu sudah bisa dibaca.</p>` +
        (url ? `<p><a href="${url}" style="color:#0284C7;font-weight:bold">Buka peta potensimu</a></p>` : "") + `<p>— Nawasena</p>`));
    }
  } catch (e) {
    console.error(`potongan ${langkah} gagal`, e);
    await db.rpc("tandai_potongan", {
      p_user: userId, p_kunci: langkah, p_nilai: "gagal",
      p_galat: `${langkah}: ${String((e as Error).message || e)}`.slice(0, 500),
    });
  }
}
