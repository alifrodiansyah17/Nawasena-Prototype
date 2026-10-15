import { z } from "zod/v4";

// Skema keluaran model. Jumlah butir tidak dikunci di skema (structured outputs
// hanya mendukung minItems 0/1); jumlah dijaga di normalize().

const Card = z.object({ judul: z.string(), isi: z.string() });

export const FreeSchema = z.object({
  julukan_sub: z.string().describe("Anak judul arketipe, 2–4 kata, mis. Mengatur dengan Tenang"),
  cara_kerja: z.string().describe("2–3 kalimat yang menggambarkan cara kerja pengguna"),
  paling: z
    .array(z.object({ judul: z.string(), chip: z.string().describe("Asal temuan, mis. 3 dari 3 jawaban di ujung skala"), isi: z.string() }))
    .describe("Tepat 4 butir: Yang paling kamu banget"),
  dilatih: z.array(Card).describe("Tepat 3 butir: Yang masih perlu dilatih"),
  catatan_kolom: z.string().describe("Satu kalimat penutup yang menormalkan dua kolom"),
});
export type FreePart = z.infer<typeof FreeSchema>;

export const TYPES = ["I", "Generalis", "T", "V", "Pi", "M", "X"] as const;
export type CareerType = (typeof TYPES)[number];
export const FITS = ["Paling cocok", "Cocok", "Perlu ditimbang"] as const;
// Helper SDK menurunkan enum jadi deskripsi saja, jadi nilai dijaga di normalizePaid.
const typeField = z.string().describe(`Salah satu persis: ${TYPES.join(", ")}`);

export const PaidSchema = z.object({
  bagian2: z.object({
    tipe_sekarang: typeField,
    tipe_dituju: typeField,
    judul: z.string().describe("Mis. Generalis, dengan peluang jadi π"),
    penjelasan: z.string(),
    keahlian: z.string(),
    keluasan: z.string(),
    sinyal_memimpin: z.string(),
    jalan: z.array(z.object({ ke: typeField, judul: z.string(), isi: z.string(), rujukan: z.string().describe("Mis. Arah 2 dan 3 di Bagian 5") })).describe("Tepat 2 jalan"),
    catatan: z.string(),
  }),
  bagian3: z.object({
    ubin: z.array(z.object({ angka: z.string(), label: z.string() })).describe("Tepat 3 ubin angka dari CV"),
    keunggulan: z.array(Card).describe("2 butir"),
    tantangan: z.array(Card).describe("2 butir"),
    penutup: z.string(),
    cerita60: z.object({ siapa: z.string(), bukti: z.string(), kenapa: z.string() }).describe("Ditulis memakai saya"),
    pertanyaan_untuk: z.string().describe("Mis. Untuk arah nomor 1 dan 2"),
    pertanyaan: z
      .array(z.object({ tanya: z.string(), dicek: z.string(), cerita: z.string(), kurang_kuat: z.string() }))
      .describe("Tepat 3 pertanyaan wawancara"),
  }),
  bagian4: z.object({
    pembuka: z.string(),
    banding: z.array(z.object({ sebelum: z.string().describe("Kalimat ASLI dari CV"), sesudah: z.string() })).describe("2 sandingan"),
    cepat: z.array(Card).describe("3 butir yang paling cepat terasa efeknya"),
    kuat: z.array(Card).describe("2 butir yang bikin CV makin kuat"),
    penutup: z.string(),
  }),
  bagian5: z.object({
    tafsiran_target: z.string().describe("Kosongkan kalau tidak ada target atau target sudah jelas"),
    pembuka: z.string(),
    arah: z
      .array(
        z.object({
          role_id: z.string().describe("WAJIB salah satu id dari tabel referensi peran"),
          label: z.string().describe("Mis. Siap dilamar saat lulus, Bukti terkuat di CV"),
          fungsi: z.string(),
          dibutuhkan: z.string().describe("Keahlian dipisah ' · '"),
          dimiliki: z.string(),
          kenapa: z.string(),
          hari: z.string(),
          menantang: z.string(),
          jalur: z.string().describe("Mis. Analyst → Specialist → Manager"),
          industri_dekat: z.string(),
          industri_alternatif: z.string(),
          disiapkan: z.string(),
        }),
      )
      .describe("Tepat 6 arah, urut sesuai aturan komposisi"),
    penghubung: z.string(),
    kurang_cocok: z.string(),
    tempat: z
      .array(z.object({ nama: z.string(), cocok: z.string().describe(`Salah satu persis: ${FITS.join(", ")}`), isi: z.string() }))
      .describe("4 jenis tempat kerja, urut dari paling cocok"),
    ciri_betah: z.array(z.string()).describe("4 ciri tempat yang bikin betah"),
    kata_cocok: z.array(z.string()).describe("4–5 kata kunci lowongan yang menandakan cocok"),
    kata_tanya: z.array(z.string()).describe("3 kata kunci yang bisa ditanyakan saat wawancara"),
  }),
  bagian6: z.object({
    langkah: z.array(z.string()).describe("Tepat 3 langkah minggu ini"),
    soal_hasil: z.string().describe("Yang perlu kamu tahu soal hasil ini"),
    penutup: z.string(),
  }),
});
export type PaidPart = z.infer<typeof PaidSchema>;

export const FactsSchema = z.object({
  nama: z.string(),
  ringkas: z.string().describe("Satu baris identitas, mis. S1 Teknik Industri · 2 tahun di marketing"),
  lama_kerja_tahun: z.number().describe("Total tahun kerja penuh waktu. Magang dan organisasi kampus TIDAK dihitung. -1 kalau tidak terbaca"),
  pendidikan_terakhir: z.string(),
  bidang_utama: z.array(z.string()),
  terbaca: z.boolean().describe("false kalau isi dokumen bukan CV atau tidak terbaca"),
});
export type CvFacts = z.infer<typeof FactsSchema>;
