# Nawasena — Analisis Diri dan Arah Karir (B2C) + Backoffice Pembayaran

Implementasi **PRD Peta Potensimu v3.3**, **Format Laporan Analisis v3.5**, dan **PRD Backoffice Pembayaran**.

Stack: Next.js 15 (App Router) · Supabase (Auth, Postgres, Storage) · Claude API (`claude-sonnet-5-5`) · @react-pdf/renderer.

## Alur pengguna

| Layar | Rute |
|---|---|
| Landing | `/` |
| Buat akun → cek email → verifikasi gagal | `/daftar`, `/daftar/cek-email`, `/daftar/gagal`, `/auth/callback` |
| Login satu kolom (email atau HP) → OTP | `/masuk`, `/masuk/kode` |
| Sudah punya CV? (entry saja) | `/cv` |
| Unggah CV → lampiran | `/cv/unggah`, `/cv/lampiran` |
| CV builder 7 langkah → pratinjau (entry saja) | `/cv/susun`, `/cv/pratinjau` |
| Intro kuis → kuis 6×6 → target karir | `/kuis/intro`, `/kuis`, `/kuis/target` |
| Proses analisis → hasil gratis (Bagian 1) | `/analisis`, `/hasil` |
| Paywall → cara bayar → bayar + unggah bukti → status | `/bayar`, `/bayar/metode`, `/bayar/kirim`, `/bayar/status` |
| Peta lengkap, bagian, detail arah, unduhan | `/peta`, `/peta/[1-6]`, `/peta/5/[n]`, `/api/unduh/peta`, `/api/unduh/cv` |
| Akun dan hapus data | `/akun` |
| Backoffice | `/admin/masuk`, `/admin/mfa`, `/admin/pembayaran`, `/admin/uang-masuk` |

Level (entry/mid/senior) dihitung dari tanggal lahir untuk jalur CV, dan dari lama kerja di CV untuk
pertanyaan target dan komposisi Bagian 5. Level tidak pernah ditampilkan.

## Cara kerja AI (`src/lib/ai.ts`, `src/lib/report.ts`)

Tiga panggilan, sesuai dua tuas margin di §4.2:

1. **Baca CV** (effort `low`) setelah unggah → lama kerja → level CV.
2. **Bagian 1** (effort `medium`) ditunggu di layar proses analisis.
3. **Bagian 2–6** (effort `high`) disusun di belakang (`after()`) begitu Bagian 1 selesai, jadi biasanya
   sudah siap waktu pembayaran dikonfirmasi.

Prompt statis (aturan bahasa §5.3, 36 item, tabel peran) di-cache 1 jam. Keluaran memakai structured
outputs (skema zod di `report-schema.ts`). Server-side fallback (`fallbacks: "default"`) aktif untuk
penolakan model.

Yang **tidak** ditulis model:
- **Arketipe dan pasangan tokoh**: dipilih deterministik dari skor (`archetypes.ts`), pasangan dikurasi manusia.
- **Kisaran gaji**: dari tabel `roles.ts`; model hanya memilih `role_id` dari tabel itu.
- **Label kelompok Bagian 5**: ditentukan dari posisi (3+3 entry, 1+5 mid/senior), `groups.ts`.

Bagian 2–6 tidak pernah dikirim ke browser sebelum pesanan berstatus Terkonfirmasi (`lib/peta.ts`).

## Setup

```bash
npm install
cp .env.example .env.local   # isi semua nilai
```

1. **Supabase**: jalankan `supabase/migrations/0001_init.sql` (SQL editor atau `supabase db push`).
2. **Auth → Email**: aktifkan Email OTP, panjang OTP 6 digit, masa berlaku link 24 jam (86400 dtk).
   Template *Magic Link* harus memuat link `{{ .ConfirmationURL }}` (daftar) **dan** kode `{{ .Token }}` (login).
   Tambahkan `NEXT_PUBLIC_APP_URL/auth/callback` ke Redirect URLs.
3. **Auth → Phone** (login lewat WhatsApp): aktifkan provider Twilio dengan WhatsApp sender.
4. **Auth → MFA**: aktifkan TOTP (wajib untuk backoffice).
5. **Admin pertama**: lihat `supabase/seed_admin.sql`.
6. Gambar QRIS: taruh di `public/qris.png` lalu set `NEXT_PUBLIC_QRIS_IMAGE=/qris.png`.

```bash
npm run dev        # http://localhost:3000
npm test           # unit test logika
npm run typecheck
```

Deploy ke Vercel: `vercel.json` sudah menjadwalkan cron retensi harian (`/api/cron/retensi`, butuh `CRON_SECRET`).
Rute analisis dan peta memakai `maxDuration = 300`.

## Wajib dicek tim sebelum rilis publik

- **Item kuis** masih draf dari prototipe; perlu uji reliabilitas (R1, Fase 0).
- **Angka gaji di `src/lib/roles.ts`** adalah perkiraan awal dan wajib divalidasi (R4).
- **Pasangan tokoh di `src/lib/archetypes.ts`** adalah draf, wajib dikurasi manusia (AC-06.7, R11).
- **Target waktu cek** pembayaran (`NEXT_PUBLIC_REVIEW_TARGET`) masih pertanyaan terbuka di PRD Backoffice.
- Fase 2 (kartu buat dibagikan) belum dibangun; yang ada hanya penggodanya di hasil gratis.

Font PDF (Plus Jakarta Sans, Nunito) di `assets/fonts` berlisensi SIL OFL 1.1.
