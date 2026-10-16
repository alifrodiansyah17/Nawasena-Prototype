// POST /functions/v1/saran-target — pilihan untuk pertanyaan target karir (layar sesudah kuis).
// Dibaca dari CV (jabatan, jenjang, keahlian) DAN jawaban kuis (minat, cara kerja), lalu 8 pilihan role/pekerjaan
// berikutnya yang cocok untuk orang ini. Tidak ada daftar bawaan: kalau gagal, aplikasi meminta pengguna menulis sendiri.
// _shared/ diambil dari ../laporan-lengkap/_shared saat deploy.
import { adminDb, CORS, json, levelUsia, penggunaDari, umur } from "./_shared/umum.ts";
import { tanyaClaude } from "./_shared/claude.ts";
import { GAYA } from "./_shared/panduan.ts";
import { ambilKonteks, teksDariSusun } from "./_shared/konteks.ts";

const JENJANG = ["belum bekerja", "staf", "senior", "lead/supervisor", "manajer", "kepala/direktur"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const user = await penggunaDari(req);
    if (!user) return json({ galat: "Sesi habis, silakan masuk lagi" }, 401);
    const db = adminDb();
    const [{ data: p }, { data: cv }] = await Promise.all([
      db.from("profil").select("tgl_lahir").eq("id", user.id).maybeSingle(),
      db.from("cv").select("sumber, teks, susun").eq("user_id", user.id).maybeSingle(),
    ]);
    if (!p || !cv) return json({ galat: "Profil atau CV belum ada" }, 400);
    const jenis = levelUsia(p.tgl_lahir) === "entry" ? "pekerjaan" : "role";
    // Konteks lengkap (CV + lampiran + hasil kuis). Kalau kuis belum lengkap, cukup CV.
    let data_orang = "";
    try { data_orang = (await ambilKonteks(db, user.id)).teks; }
    catch {
      const teksCV = (cv.sumber === "susun" ? teksDariSusun(cv.susun) : String(cv.teks || "")).trim().slice(0, 16000);
      data_orang = `Usia: ${umur(p.tgl_lahir)} tahun\n\n=== CV ===\n${teksCV || "(CV kosong atau tidak terbaca)"}`;
    }
    const sesuaikan = `
- WAJIB disesuaikan dengan orang ini, bukan daftar umum. Setiap pilihan harus bisa ditelusuri ke:
  (a) keahlian, bidang, dan pengalaman yang benar-benar ada di CV-nya, DAN
  (b) minat dan cara kerja yang kuat di hasil kuisnya (mis. kuat mengulik data → peran analitis; kuat di orang → peran yang banyak berinteraksi;
      kuat mengambil alih → peran memimpin; nyaman dengan aturan → peran yang rapi dan terstruktur).
- Jangan menyodorkan jabatan pimpinan tinggi (Head, Director, VP, Chief) kecuali CV-nya sudah di jenjang manajer atau di atasnya.
- Jangan menyodorkan bidang yang tidak ada hubungannya dengan CV maupun kuisnya.`;

    const tugas = jenis === "role"
      ? `Tugas: baca jabatan dan jenjang orang ini dari CV, lalu tulis TEPAT 8 pilihan untuk pertanyaan
"Role apa yang ingin kamu capai berikutnya?".
- Semua pilihan adalah langkah BERIKUTNYA dari jabatan sekarang: setara atau 1–2 jenjang di atasnya. Jangan pernah lebih rendah
  dari jenjangnya sekarang, dan jangan jabatan yang sama persis dengan jabatannya sekarang.
- Pilihan 1–4: langkah berikutnya di jalur keahliannya sekarang (naik satu jenjang, atau makin dalam di spesialisasinya).
- Pilihan 5–8: jalur sebelah yang memakai keahliannya dan cocok dengan minat serta cara kerja di kuis, di jenjang setara atau lebih tinggi.${sesuaikan}
- Kalau CV menunjukkan belum pernah bekerja penuh waktu, pilihannya role level awal yang paling dekat dengan pendidikan dan magangnya.
- t = nama role yang benar-benar dipakai di lowongan Indonesia (boleh bahasa Inggris), maksimal 40 huruf.
- k = alasan singkat maksimal 8 kata yang menyebut kaitannya, mis. 'memakai pengalaman risetmu' atau 'cocok dengan sukamu mengulik data'.`
      : `Tugas: baca pendidikan, magang, dan organisasi orang ini dari CV, lalu tulis TEPAT 8 pilihan untuk pertanyaan
"Pekerjaan seperti apa yang ingin kamu coba cari tahu?".
- Pilihan adalah pekerjaan level awal (fresh graduate) yang masuk akal untuk latar belakangnya, dari yang paling dekat
  dengan jurusannya sampai yang memakai pengalaman organisasinya.${sesuaikan}
- Kalau CV menunjukkan dia sudah bekerja penuh waktu, pilihannya langkah berikutnya dari pekerjaannya sekarang, jangan lebih rendah.
- t = nama pekerjaan yang benar-benar dipakai di lowongan Indonesia (boleh bahasa Inggris), maksimal 40 huruf.
- k = gambaran pekerjaannya maksimal 8 kata, mis. 'mengolah data jadi bahan keputusan'.`;

    const { data } = await tanyaClaude<{ peran_kini: string; tahun_kerja: number; jenjang: string; opsi: { t: string; k: string }[] }>({
      system: GAYA,
      pesan: `${data_orang}\n\n${tugas}`,
      skema: {
        type: "object",
        properties: {
          peran_kini: { type: "string", description: "Jabatan penuh waktu sekarang/terakhir dari CV; '' kalau belum pernah bekerja penuh waktu" },
          tahun_kerja: { type: "number", description: "Lama kerja penuh waktu dalam tahun; magang dan organisasi tidak dihitung" },
          jenjang: { type: "string", enum: [...JENJANG] },
          opsi: {
            type: "array", description: "TEPAT 8 pilihan, urut dari yang paling wajar",
            items: { type: "object", properties: { t: { type: "string" }, k: { type: "string" } }, required: ["t", "k"], additionalProperties: false },
          },
        },
        required: ["peran_kini", "tahun_kerja", "jenjang", "opsi"],
        additionalProperties: false,
      },
      maxTokens: 2500,
      effort: "low",
    });
    const kini = String(data.peran_kini || "").trim().toLowerCase();
    const dilihat = new Set<string>();
    const opsi = (Array.isArray(data.opsi) ? data.opsi : [])
      .map((o) => ({ t: String(o?.t || "").trim().slice(0, 60), k: String(o?.k || "").trim().slice(0, 80) }))
      .filter((o) => {
        const kunci = o.t.toLowerCase();
        if (!o.t || kunci === kini || dilihat.has(kunci)) return false;
        dilihat.add(kunci);
        return true;
      })
      .slice(0, 8);
    return json({ jenis, peran_kini: String(data.peran_kini || "").trim(), tahun_kerja: Number(data.tahun_kerja) || 0, jenjang: data.jenjang, opsi });
  } catch (e) {
    console.error(e);
    return json({ galat: String((e as Error).message || e) }, 500);
  }
});
