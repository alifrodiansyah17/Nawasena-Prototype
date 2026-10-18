/* ============================================================
 * KONFIGURASI NAWASENA — isi bagian ini sebelum deploy.
 * File ini boleh publik: kunci "anon/publishable" memang untuk browser,
 * data tetap dilindungi Row Level Security di Supabase.
 * ============================================================ */
window.NAWASENA_CONFIG = {
  // Supabase → Project Settings → API
  SUPABASE_URL: 'https://qgauvnqescvpyyyhpzws.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYXV2bnFlc2N2cHl5eWhwendzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDA2NTUsImV4cCI6MjEwNzYxNjY1NX0.s1K0ck0zL9kaULTIVoC8kv8cVfBCWD2Pvj_FIbtOrqI',

  // Harga Paket Mulai Karir (harus sama dengan fungsi kirim_bukti di database)
  HARGA: 25000,

  // Uji coba: tampilkan label 'tidak perlu transfer sungguhan' di layar pembayaran
  MODE_UJI_COBA: true,

  // Pembayaran manual
  QRIS_GAMBAR: 'aset/qris.png',          // QRIS statis GoPay Merchant Nawasena (dipotong dari poster aslinya)
  QRIS_NAMA: 'NAWASENA, EDUKASI',
  QRIS_NMID: 'ID1026615276171',
  // Metode pembayaran yang ditampilkan. Untuk menyalakan lagi transfer bank: ['qris', 'transfer']
  METODE_BAYAR: ['qris'],
  BANK_NAMA: 'Bank BCA',
  BANK_NOMOR: '1234567890',
  BANK_ATAS_NAMA: 'Nawasena Indonesia',

  // Kontak bantuan (WhatsApp, format 62…)
  WHATSAPP: '6281567666969',
  EMAIL_DUKUNGAN: 'support@nawasena.info',

  // Lama pengecekan pembayaran yang dijanjikan ke pengguna
  JANJI_CEK: '1×24 jam di hari kerja',

  // Cara masuk:
  //   false = daftar dan login pakai kata sandi, tanpa email apa pun (matikan "Confirm email" di Supabase)
  //   true  = kode 6 angka dikirim ke email (perlu SMTP sendiri, lihat README)
  VERIFIKASI_EMAIL: true,

  // Keluar otomatis kalau tidak ada aktivitas selama sekian menit. Pindah aplikasi atau menutup tab
  // tidak langsung mengeluarkan pengguna; yang dihitung waktu sejak aktivitas terakhir.
  // 30 menit = batas atas rekomendasi OWASP untuk aplikasi berisiko rendah–menengah (15–30 menit).
  BATAS_DIAM_MENIT: 30,

  // Isi true untuk mencoba aplikasi tanpa Supabase (data palsu di browser, tanpa AI)
  MODE_DEMO: false
};
