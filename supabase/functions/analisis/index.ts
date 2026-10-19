// POST /functions/v1/analisis
// Dipanggil aplikasi setelah kuis selesai. Menyusun Bagian 1 (gratis) di latar belakang,
// lalu aplikasi memantau tabel `laporan` sampai status = 'siap'.
// _shared/ diambil dari ../laporan-lengkap/_shared saat deploy (contoh_laporan.ts cukup versi Bagian 1).
import { adminDb, CORS, json, latar, penggunaDari } from "./_shared/umum.ts";
import { ambilKonteks } from "./_shared/konteks.ts";
import { tanyaClaude } from "./_shared/claude.ts";
import { GAYA, skemaBagian1, TUGAS_BAGIAN1 } from "./_shared/panduan.ts";
import { rapikanIsi } from "./_shared/rapikan.ts";

const BATAS_MACET_MS = 4 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const user = await penggunaDari(req);
    if (!user) return json({ galat: "Sesi habis, silakan masuk lagi" }, 401);
    const db = adminDb();

    const { data: lap } = await db.from("laporan").select("status, mulai, ulang").eq("user_id", user.id).maybeSingle();
    let ulang = lap?.ulang ?? 0;
    if (lap?.status === "siap") {
      // Sudah jadi. Susun ulang hanya kalau datanya berubah sesudah analisis terakhir dimulai
      // (pengguna mundur dari hasil/bayar lalu mengganti CV, lampiran, jawaban, atau target).
      if (!(await adaPerubahan(db, user.id, lap.mulai))) return json({ status: "siap" });
      const batas = Number(Deno.env.get("BATAS_ANALISIS_ULANG") ?? "3");
      if (ulang >= batas) {
        return json({ status: "siap", catatan: "Analisismu sudah diperbarui " + batas + " kali, jadi yang tampil masih hasil terakhir. Kalau perlu diperbarui lagi, hubungi kami lewat WhatsApp ya." });
      }
      ulang += 1;
    }
    if (lap?.status === "proses" && lap.mulai && Date.now() - new Date(lap.mulai).getTime() < BATAS_MACET_MS) {
      return json({ status: "proses" }, 202);
    }

    // Validasi cepat sebelum mulai: CV dan 36 jawaban harus ada
    const [{ data: cv }, { data: jw }] = await Promise.all([
      db.from("cv").select("user_id").eq("user_id", user.id).maybeSingle(),
      db.from("jawaban").select("data").eq("user_id", user.id).maybeSingle(),
    ]);
    if (!cv) return json({ galat: "CV belum ada" }, 400);
    const arr = (jw?.data as number[]) || [];
    if (arr.length < 36 || arr.slice(0, 36).some((x) => !(x >= 1 && x <= 4))) return json({ galat: "Kuis belum selesai" }, 400);

    await db.from("laporan").upsert({ user_id: user.id, status: "proses", mulai: new Date().toISOString(), galat: null, ulang, diubah: new Date().toISOString() });
    // Laporan lengkap (kalau sudah ada) ikut disusun ulang dari analisis yang baru
    if (ulang > (lap?.ulang ?? 0)) {
      await db.from("laporan_lengkap").update({ status: "belum", bagian_status: {}, galat: null, diubah: new Date().toISOString() }).eq("user_id", user.id);
    }
    latar(susunBagian1(user.id));
    return json({ status: "proses" }, 202);
  } catch (e) {
    console.error(e);
    return json({ galat: String((e as Error).message || e) }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function adaPerubahan(db: any, userId: string, sejak: string | null): Promise<boolean> {
  if (!sejak) return false;
  const t = new Date(sejak).getTime();
  const [{ data: cv }, { data: jw }, { data: lp }] = await Promise.all([
    db.from("cv").select("diubah").eq("user_id", userId).maybeSingle(),
    db.from("jawaban").select("diubah").eq("user_id", userId).maybeSingle(),
    db.from("lampiran").select("dibuat").eq("user_id", userId).order("dibuat", { ascending: false }).limit(1),
  ]);
  const waktu = [cv?.diubah, jw?.diubah, lp?.[0]?.dibuat].filter(Boolean).map((x: string) => new Date(x).getTime());
  return waktu.some((x) => x > t);
}

async function susunBagian1(userId: string) {
  const db = adminDb();
  try {
    const k = await ambilKonteks(db, userId);
    const { data: tokoh } = await db.from("tokoh").select("id, jenis, nama, keterangan, cocok_untuk").eq("aktif", true);
    const nyata = (tokoh || []).filter((t) => t.jenis === "nyata");
    const fiksi = (tokoh || []).filter((t) => t.jenis === "fiksi");
    if (!nyata.length || !fiksi.length) throw new Error("Tabel tokoh kosong. Jalankan 002_tokoh_awal.sql");
    const daftarTokoh = (tokoh || []).map((t) => `- id=${t.id} · ${t.jenis} · ${t.nama} (${t.keterangan}): ${t.cocok_untuk}`).join("\n");

    // deno-lint-ignore no-explicit-any
    const { data, contoh } = await tanyaClaude<Record<string, any>>({
      system: GAYA,
      pesan: `${k.teks}\n\n=== DAFTAR TOKOH PEMBANDING (pilih dari sini saja) ===\n${daftarTokoh}\n\n${TUGAS_BAGIAN1}`,
      skema: skemaBagian1(nyata.map((t) => t.id), fiksi.map((t) => t.id)),
      maxTokens: 12000,
    });

    const tn = nyata.find((t) => t.id === data.tokoh_nyata?.id) || nyata[0];
    const tf = fiksi.find((t) => t.id === data.tokoh_fiksi?.id) || fiksi[0];
    const bagian1 = rapikanIsi({
      ...data,
      peran_kini: (data.tahun_kerja ?? 0) > 0 ? String(data.peran_kini || "").trim() : "",
      tokoh_nyata: { nama: tn.nama, peran: tn.keterangan, why: data.tokoh_nyata?.why || "" },
      tokoh_fiksi: { nama: tf.nama, asal: tf.keterangan, why: data.tokoh_fiksi?.why || "" },
      paling: (data.paling || []).slice(0, 4),
      dilatih: (data.dilatih || []).slice(0, 3),
      level_cv: (data.tahun_kerja ?? 0) < 3 ? "entry" : (data.tahun_kerja < 8 ? "mid" : "senior"),
      contoh: !!contoh,
    });   // rapikanIsi: buang kode internal kuis dan kurung siku di sekitar angka
    await db.from("laporan").update({
      status: "siap", skor: k.skor, bagian1, galat: null, diubah: new Date().toISOString(),
    }).eq("user_id", userId);
  } catch (e) {
    console.error("bagian1 gagal", e);
    await db.from("laporan").update({ status: "gagal", galat: String((e as Error).message || e).slice(0, 500), diubah: new Date().toISOString() }).eq("user_id", userId);
  }
}
