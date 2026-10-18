// POST /functions/v1/saran-target — rekomendasi role untuk layar "Kami rasa kamu bakal cocok di sini" (sesudah kuis).
// Dibaca dari CV (jabatan, jenjang, keahlian) DAN jawaban kuis (minat, cara kerja), lalu 10 role umum yang cocok,
// masing-masing dengan alasan singkat. Pengguna memilih sampai 6; kalau gagal, aplikasi menampilkan daftar umum.
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
- Jangan menyodorkan bidang yang tidak ada hubungannya dengan CV maupun kuisnya.`;

    const tugas = `Tugas: susun TEPAT 10 rekomendasi role untuk layar "Kami rasa kamu bakal cocok di sini".
Pengguna akan memilih sampai 6, dan tiap pilihan dibahas sebagai satu arah karir di laporannya.
- t = nama role UMUM tanpa jenjang (mis. 'Business Analyst', 'Product Management', 'Financial Analyst', 'Digital Marketing'),
  yang benar-benar dipakai di lowongan Indonesia, maksimal 32 huruf. Jangan tulis 'Senior', 'Junior', 'Head', 'Lead', 'Manager', atau nama perusahaan.
- k = alasan singkat maksimal 10 kata yang menyebut kaitannya dengan CV atau kuisnya, mis. 'memakai pengalaman risetmu di CV' atau 'cocok dengan sukamu mengulik data'.
- Urutkan dari yang paling cocok. Campur: sebagian di bidang yang sudah dia jalani, sebagian bidang sebelah yang cocok dengan minat dan cara kerjanya.
- ${jenis === "role" ? "Orang ini sudah cukup lama berkarir: pilih role yang masuk akal untuk langkah berikutnya dari pengalamannya." : "Orang ini di awal karir: pilih role yang bisa dimasuki lulusan baru dengan latar belakangnya."}${sesuaikan}`;

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
            type: "array", description: "TEPAT 10 rekomendasi, urut dari yang paling cocok",
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
      .map((o) => ({ t: String(o?.t || "").trim().slice(0, 48), k: String(o?.k || "").trim().slice(0, 90) }))
      .filter((o) => {
        const kunci = o.t.toLowerCase();
        if (!o.t || kunci === kini || dilihat.has(kunci)) return false;
        dilihat.add(kunci);
        return true;
      })
      .slice(0, 10);
    return json({ jenis, peran_kini: String(data.peran_kini || "").trim(), tahun_kerja: Number(data.tahun_kerja) || 0, jenjang: data.jenjang, opsi });
  } catch (e) {
    console.error(e);
    return json({ galat: String((e as Error).message || e) }, 500);
  }
});
