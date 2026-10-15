// Konfigurasi terpusat. Angka dan teks yang sering berubah ada di sini,
// supaya tidak perlu menyentuh kode layar (AC-03.6, AC-04.10, AC-05.9).

export const PRICE_IDR = 25_000;
export const PRODUCT_NAME = "Paket Mulai Karir";

// Nomor WhatsApp bantuan: satu konstanta untuk semua layar (AC-03.6).
export const WA_NUMBER = process.env.NEXT_PUBLIC_WA_NUMBER ?? "6281200000000";
export const WA_HELP_TEXT = "Halo Nawasena, aku lagi kesulitan waktu pakai aplikasinya.";
export const WA_HOURS = "Dibalas orang, tiap hari kerja 09.00–18.00";

export function waLink(text = WA_HELP_TEXT) {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
}

// Tujuan bayar (§6.8). Diisi lewat env supaya tidak ada nomor rekening di repo.
export const PAYMENT = {
  qrisImage: process.env.NEXT_PUBLIC_QRIS_IMAGE ?? "/qris-placeholder.svg",
  qrisNmid: process.env.NEXT_PUBLIC_QRIS_NMID ?? "ID0000000000000",
  qrisMerchant: process.env.NEXT_PUBLIC_QRIS_MERCHANT ?? "NAWASENA",
  bankName: process.env.NEXT_PUBLIC_BANK_NAME ?? "BCA",
  bankAccount: process.env.NEXT_PUBLIC_BANK_ACCOUNT ?? "0000000000",
  bankHolder: process.env.NEXT_PUBLIC_BANK_HOLDER ?? "PT Nawasena",
  // Batas waktu bayar sejak pesanan dibuat.
  payWindowHours: 24,
  // Target waktu cek yang dijanjikan ke pengguna (pertanyaan terbuka di PRD Backoffice).
  reviewTarget: process.env.NEXT_PUBLIC_REVIEW_TARGET ?? "maksimal 1 x 24 jam di hari kerja",
};

export const PAYMENT_METHODS = [
  { kode: "qris", nama: "QRIS", ket: "Scan pakai m-banking atau e-wallet apa pun" },
  { kode: "transfer", nama: "Transfer bank", ket: "Transfer biasa ke rekening Nawasena" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["kode"];

export const REJECT_REASONS = [
  "Nominal tidak sesuai tagihan",
  "Bukti tidak terbaca",
  "Dana belum masuk ke rekening",
  "Bukti untuk pesanan lain",
] as const;

// Batas file
export const MAX_CV_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const CV_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const ATTACHMENT_EXT = ["pdf", "docx", "pptx", "zip"];
export const PROOF_MIME = ["image/jpeg", "image/png", "application/pdf"];

// Kartu kebutuhan lanjutan (§6.5). Kebutuhan, bukan nama layanan.
export const NEEDS = [
  {
    kode: "mutusin",
    pilih: "Aku butuh dibantu memutuskan arahnya",
    kenapa: "Kamu bilang butuh dibantu memutuskan. Ini yang paling cocok:",
    layanan: "konsultasi",
  },
  {
    kode: "realita",
    pilih: "Aku penasaran sama realita kerjanya",
    kenapa:
      "Buat tahu hari-harinya benar-benar bagaimana, paling cepat ya bertanya langsung ke yang sudah menjalani:",
    layanan: "konsultasi",
  },
  {
    kode: "langkah",
    pilih: "Aku butuh dibantu menyusun langkahnya",
    kenapa: "Menyusun langkah itu gampang kalau arahnya sudah kepilih. Sesi ini mengerjakan dua-duanya:",
    layanan: "konsultasi",
  },
  {
    kode: "bekal",
    pilih: "Aku mau menyiapkan bekal kemampuannya",
    kenapa: "Arah sudah kelihatan, tinggal bekalnya. Ada dua tingkat, pilih yang paling masuk buat kamu:",
    layanan: "jalur",
  },
  {
    kode: "cv",
    pilih: "Aku mau dibantu membenahi CV-ku",
    kenapa: "Catatan di Bagian 4 sudah bisa kamu pakai sekarang. Yang belum ada: alat untuk mengecek ulang hasil revisimu.",
    layanan: "pengoreksi",
  },
  {
    kode: "cukup",
    pilih: "Buat sekarang, segini dulu cukup",
    kenapa: "",
    layanan: null,
  },
] as const;

export const SERVICES = {
  konsultasi: {
    nama: "Konsultasi Karir bareng Expert",
    apa: "Sesi 45 menit sama praktisi yang sudah lama di bidangnya. Bahan obrolannya petamu — enam arah di Bagian 5, plus apa yang kamu ragukan.",
    detail: [
      ["Lama", "45 menit, online"],
      ["Yang menemani", "Praktisi aktif, minimal 5 tahun di bidangnya"],
      ["Yang kamu bawa pulang", "Satu arah terpilih, alasannya, dan langkah 30 hari"],
    ],
    harga: "Rp149.000",
  },
  pengoreksi: {
    nama: "Pengoreksi CV",
    apa: "Kamu revisi CV-mu pakai catatan di Bagian 4, terus kirim lagi ke sini. Sistem mengecek ulang baris per baris: mana yang sudah kena, mana yang masih tugas dan belum jadi hasil.",
    detail: [
      ["Bentuknya", "Revisi sepuasnya sampai bersih"],
      ["Yang dicek", "Keterbacaan ATS, kalimat hasil, keahlian yang bisa diperiksa"],
      ["Yang kamu bawa pulang", "Catatan per baris + CV final siap kirim"],
    ],
    harga: "Rp39.000",
  },
  jalur: {
    nama: "Jalur Belajar Nawasena",
    apa: "Bekal yang belum terkumpul buat arah pilihanmu — diambil dari Bagian 1 dan 5 petamu — diterjemahkan jadi jalur belajar. Ada dua tingkat, bedanya di seberapa jauh kamu mau dibimbing.",
    detail: [],
    harga: "",
    tiers: [
      {
        kode: "ai",
        nama: "Jalur AI Interaktif",
        harga: "Rp99.000",
        satuan: "per bulan",
        ringkas: "Belajar sendiri, ditemani AI",
        isi: [
          "Peta kompetensi dari hasil kuismu",
          "Sesi belajar interaktif yang menyesuaikan level kamu",
          "Latihan dan umpan balik otomatis",
          "Progres terbaca, bisa berhenti kapan saja",
        ],
      },
      {
        kode: "mentor",
        nama: "Jalur Portofolio + Mentor",
        harga: "Rp399.000",
        satuan: "per bulan",
        ringkas: "Semua isi Jalur AI, plus manusia dan bukti kerja",
        isi: [
          "Semua yang ada di Jalur AI Interaktif",
          "Satu proyek nyata yang jadi isi portofoliomu",
          "Satu sesi mentor per bulan, 60 menit",
          "Portofolio ditinjau sebelum kamu pakai melamar",
        ],
      },
    ],
  },
} as const;

export const PRICE_VOTES = ["Kemahalan", "Pas", "Murah, malah"] as const;

// Kartu penilaian (§6.6)
export const STAR_WORDS = ["", "Belum kena", "Masih bisa lebih", "Lumayan", "Bagus", "Bagus banget"];
export const IMPROVE_CHIPS = [
  "Bahasanya",
  "Kedalaman isinya",
  "Akurasi hasilnya",
  "Jumlah arah karirnya",
  "Contoh dan langkah praktisnya",
  "Tampilan dan cara bacanya",
  "Kecepatan mengisinya",
];

// Enam bagian Peta Potensimu (§6.3). Kata "laporan" tidak dipakai di UI.
export const SECTIONS = [
  { no: 1, nama: "Kenalan Sama Dirimu", sub: "Julukan buatmu, yang paling kamu banget, dan yang masih perlu dilatih", warna: "#38BDF8" },
  { no: 2, nama: "Tipe Karirmu", sub: "Spesialis, generalis, atau pemimpin, dan ke mana kamu sedang bergerak", warna: "#009FE3" },
  { no: 3, nama: "Keunggulan dan Tantanganmu", sub: "Yang sudah bisa kamu tunjukkan ke perekrut, dan cara menceritakannya di wawancara", warna: "#0284C7" },
  { no: 4, nama: "Catatan buat CV-mu", sub: "Yang paling cepat terasa efeknya, dan yang bikin CV-mu makin kuat", warna: "#CCA700" },
  { no: 5, nama: "Enam Arah Karir Berikutnya", sub: "Diurutkan dari yang paling dekat dengan bekalmu, plus tempat kerja yang paling pas", warna: "#0284C7" },
  { no: 6, nama: "Langkah yang Bisa Kamu Lakukan Sekarang", sub: "Tiga hal yang bisa kamu kerjakan minggu ini, bukan tahun depan", warna: "#009FE3" },
] as const;

export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
