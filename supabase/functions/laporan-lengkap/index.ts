// POST /functions/v1/laporan-lengkap
// Menyusun Bagian 2–6 setelah pembayaran dikonfirmasi. Dibagi tiga potongan supaya tiap panggilan
// selesai di bawah batas 150 detik Supabase Free:
//   1. rencana  → Bagian 2, 3, 4 + enam nama arah + pembuka Bagian 5
//   2. arahA    → rincian arah 1–3                         (jalan bersamaan dengan arahB)
//   3. arahB    → rincian arah 4–6 + tempat kerja + Bagian 6
// Pemicu: fungsi `konfirmasi` (admin), atau aplikasi pengguna kalau statusnya belum/gagal/macet.
import { adminDb, CORS, esc, json, kirimEmail, latar, panggilanInternal, penggunaDari, picuFungsi } from "./_shared/umum.ts";
import { ambilKonteks } from "./_shared/konteks.ts";
import { tanyaClaude } from "./_shared/claude.ts";
import { GAYA, kelArah, skemaArahA, skemaArahB, skemaRencana, TUGAS_ARAH_A, TUGAS_ARAH_B, TUGAS_RENCANA } from "./_shared/panduan.ts";

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

async function jalankanPotongan(userId: string, langkah: string) {
  const db = adminDb();
  try {
    await db.rpc("tandai_potongan", { p_user: userId, p_kunci: langkah, p_nilai: "proses" });

    const k = await ambilKonteks(db, userId);
    const { data: lap } = await db.from("laporan").select("bagian1").eq("user_id", userId).single();
    const b1 = JSON.stringify(lap?.bagian1 || {});
    const levelCv = (lap?.bagian1 as Record<string, string>)?.level_cv || k.levelUsia;

    // Tabel referensi peran dan gaji (PRD R4): gaji tidak pernah ditulis model.
    const { data: peranRows } = await db.from("peran_referensi").select("id, nama, rumpun, fungsi, gaji_masuk, gaji_menengah, gaji_senior").eq("aktif", true).order("id");
    const peran = (peranRows || []) as PeranRef[];
    if (!peran.length) throw new Error("Tabel peran_referensi kosong");

    let isi: Record<string, unknown> = {};
    if (langkah === "rencana") {
      const tabel = peran.map((p) => `${p.id} | ${p.nama} | ${p.rumpun} | ${p.fungsi}`).join("\n");
      const { data, contoh } = await tanyaClaude<Record<string, unknown>>({
        system: GAYA,
        pesan: `${k.teks}\nLevel dari lama kerja di CV: ${levelCv}\n\n=== BAGIAN 1 YANG SUDAH DIBACA PENGGUNA (konteks, jangan diulang) ===\n${b1}\n\n=== TABEL REFERENSI PERAN (id | nama | rumpun | fungsi) ===\n${tabel}\n\n${TUGAS_RENCANA}`,
        skema: skemaRencana(peran.map((p) => p.id)),
        maxTokens: 16000,
      });
      if (Array.isArray(data.arah)) {
        const dipakai = new Set<string>();
        data.arah = (data.arah as Record<string, unknown>[]).map((a, i) => {
          // peran_id dobel atau di luar tabel dikosongkan; arah itu tampil tanpa kisaran gaji.
          let id = typeof a.peran_id === "string" && peran.some((p) => p.id === a.peran_id) ? a.peran_id : null;
          if (id && dipakai.has(id)) id = null;
          if (id) dipakai.add(id);
          return { ...a, peran_id: id, kel: kelArah(k.targetJenis, i) };
        });
      }
      if (contoh) data.contoh = true;
      isi = { rencana: data };
    } else {
      const { data: ll } = await db.from("laporan_lengkap").select("bagian").eq("user_id", userId).single();
      const rencana = (ll?.bagian as Record<string, unknown>)?.rencana;
      if (!rencana) throw new Error("Rencana belum ada");
      const a = langkah === "arahA";
      const { data } = await tanyaClaude<Record<string, unknown>>({
        system: GAYA,
        pesan: `${k.teks}\nLevel dari lama kerja di CV: ${levelCv}\n\n=== BAGIAN 1 ===\n${b1}\n\n=== RENCANA BAGIAN 2–5 (sudah ditulis, ikuti) ===\n${JSON.stringify(rencana)}\n\n${a ? TUGAS_ARAH_A : TUGAS_ARAH_B}`,
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
      await kirimEmail(k.email, "Peta potensimu sudah lengkap",
        `<p>Halo ${esc(k.nama)},</p><p>Keenam bagian peta potensimu sudah bisa dibaca.</p>` +
        (url ? `<p><a href="${url}">Buka peta potensimu</a></p>` : "") + `<p>— Nawasena</p>`);
    }
  } catch (e) {
    console.error(`potongan ${langkah} gagal`, e);
    await db.rpc("tandai_potongan", {
      p_user: userId, p_kunci: langkah, p_nilai: "gagal",
      p_galat: `${langkah}: ${String((e as Error).message || e)}`.slice(0, 500),
    });
  }
}
