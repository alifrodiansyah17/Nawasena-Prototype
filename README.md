# Nawasena — aplikasi utama (Cloudflare Pages + Supabase)

Branch ini menyimpan aplikasi Nawasena yang berjalan di https://nawasena-prototype.pages.dev
(project Supabase "Prototype Nawasena", `qgauvnqescvpyyyhpzws`).

- `web/` — situs statis untuk Cloudflare Pages (unggah folder ini, termasuk `_worker.js` untuk gerbang link).
- `supabase/functions/` — Edge Function yang diubah di branch ini (`konfirmasi`, `laporan-lengkap`).
  Fungsi lain (`masuk`, `analisis`, `profil-cv`) belum disalin ke sini.
- `supabase/migrations/` — migrasi yang ditambahkan di branch ini.

## Perubahan 15 Oktober 2026

1. **Gaji dari tabel referensi (PRD R4).** Tabel baru `peran_referensi` (58 peran). Saat menyusun rencana,
   model wajib memilih `peran_id` dari tabel itu untuk tiap arah; kisaran gaji di Bagian 5 diisi sistem
   dari tabel, bukan ditulis model. Angka awal adalah perkiraan dan wajib divalidasi tim; ubah langsung
   di tabel tanpa deploy ulang.
2. **Keputusan pembayaran lebih aman (PRD Backoffice).** Fungsi database `putuskan_pesanan`:
   keputusan pertama yang tersimpan menang, Konfirmasi/Tolak hanya dari status Menunggu,
   Batalkan hanya oleh admin yang memutuskan dan paling lama 15 menit.
3. **Audit log** `audit_admin` (tidak bisa diubah atau dihapus) untuk setiap keputusan.
4. **Riwayat bukti bayar** `bukti_bayar`: bukti lama tidak hilang saat pengguna mengirim ulang.
5. Kolom `pesanan.nominal_bukti` (opsional, untuk nominal yang tertera di bukti).
6. `web/aset/admin.js`: tombol "Batalkan keputusan" hanya muncul untuk keputusan sendiri < 15 menit.

Semua perubahan database dan Edge Function sudah diterapkan ke project Supabase.
Perubahan `web/` perlu di-deploy ulang ke Cloudflare Pages.

## Penyedia AI: Claude atau Gemini (16 Okt 2026)

Semua panggilan AI (`analisis`, `profil-cv`, `laporan-lengkap`) lewat `_shared/claude.ts`, yang sekarang
bisa memakai **Claude API** atau **Gemini API**. Isi file ini sama di ketiga fungsi.

| Secret (Supabase → Edge Functions → Secrets) | Isi |
|---|---|
| `GEMINI_API_KEY` | Kunci Gemini dari Google AI Studio |
| `AI_PROVIDER` | Opsional: `gemini` atau `claude`. Kosong = Claude kalau `ANTHROPIC_API_KEY` ada, kalau tidak Gemini |
| `GEMINI_MODEL` | Opsional, bawaan `gemini-3.5-flash` |
| `GEMINI_MODEL_CADANGAN` | Opsional, bawaan `gemini-2.5-flash`; dipakai otomatis kalau model utama penuh (503/429) |
| `MODE_AI` | `contoh` = paksa mode contoh walaupun kunci ada |

Tanpa kunci sama sekali, aplikasi tetap memakai isi contoh (seperti sebelumnya).
Skema JSON dikirim sebagai `responseJsonSchema`; kalau ditolak, dicoba ulang dengan mode JSON biasa.
Gaji tetap dari `peran_referensi` (model hanya memilih `peran_id`).

Uji 16 Okt (CV fiktif): Bagian 1 ±17 dtk (2.5-flash) / ±46 dtk (3.5-flash); rencana Bagian 2–5 ±40–50 dtk.
Semua di bawah batas 150 detik Supabase Free. 3.5-flash lebih patuh aturan bahasa (tidak menulis skor mentah).
