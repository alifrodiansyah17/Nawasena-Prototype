# Nawasena: Free vs Paid

Pembeda versi gratis dan berbayar (Paket Mulai Karir) di aplikasi Nawasena (`apps.nawasena.info`).
Dokumen ini untuk tim bisnis dan tim engineer. Bagian 1 dan 2 untuk semua orang. Bagian 3 untuk engineer.

Kondisi per 4 November 2026, cabang `aplikasi-utama`.

---

## 1. Ringkasan

| | **Free** | **Paid: Paket Mulai Karir** |
|---|---|---|
| Harga | Rp0 | **Rp49.000** sekali bayar (bukan langganan) |
| Harga dengan kode referral | – | Rp49.000 dikurangi potongan ambassador (default Rp5.000, jadi Rp44.000) |
| Isi laporan | **Bagian 1** dari 6 | **Bagian 1–6** lengkap |
| Unduhan PDF | Tidak ada | Peta potensimu (laporan) + CV rapi |
| Kapan keluar | Langsung setelah kuis dan pilih target (disusun AI di latar, biasanya beberapa menit) | Setelah pembayaran dikonfirmasi admin, lalu disusun AI (beberapa menit) |
| Akses ulang | Selama akun ada | Selamanya, tinggal masuk lagi pakai email |

Singkatnya: **Free menjawab "aku ini orang yang seperti apa".** **Paid menjawab "terus aku sebaiknya ke mana, dan gimana caranya".**

---

## 2. Rincian fitur (untuk tim bisnis)

### 2.1 Yang didapat semua pengguna (Free)

| Fitur | Keterangan |
|---|---|
| Daftar akun | Nama, tanggal lahir, WhatsApp, email, persetujuan data pribadi (UU PDP). |
| CV | Unggah CV (PDF). Untuk yang belum punya CV ada **Susun CV** 7 langkah: data diri, pendidikan, pengalaman, organisasi/proyek, keahlian, profil singkat, lalu pratinjau. Bisa tambah lebih dari satu deskripsi per pengalaman. |
| Portofolio (opsional) | Lampiran pendukung, ditanyakan sesuai jenjang. |
| Kuis | 36 pertanyaan cara kerja, 6 halaman. |
| Saran target karir | AI menyarankan 10 role yang cocok dari CV + kuis. Pengguna memilih **1** target. |
| **Laporan Bagian 1: "Kenalan Sama Dirimu"** | Julukan/arketipe (mis. *The Analyst · Pengurai yang Teliti*), 4 hal yang paling "kamu banget", 3 hal yang masih perlu dilatih, 3 ciri cara kerja. Untuk jenjang *entry* ditambah tokoh nyata + tokoh fiksi yang cara kerjanya mirip (disembunyikan untuk mid/senior). |
| Analisis ulang | Kalau pengguna mengubah CV, kuis, atau target, Bagian 1 disusun ulang. Maksimal 3 kali per akun. |

Setelah Bagian 1, pengguna melihat daftar Bagian 2–6 (judul dan ringkasan) dan tombol **"Raih karirmu sekarang"** menuju halaman bayar.

### 2.2 Yang hanya didapat pengguna berbayar (Paid)

| Bagian | Isi | Nilai buat pengguna |
|---|---|---|
| **2. Tipe Karirmu** | Tipe karir sekarang dan yang sedang dituju (I, T, V, π, M, X, atau —), bukti keahlian/keluasan/kepemimpinan dari CV, 2 jalan ke depan. | Tahu posisi dirinya: spesialis, generalis, atau pemimpin. |
| **3. Keunggulan dan Tantanganmu** | 3 angka penting dari CV, 2 keunggulan, 2 tantangan, naskah cerita diri (siapa saya, bukti terkuat, kenapa arah ini), **3 pertanyaan wawancara** + cara menjawab. | Siap wawancara. |
| **4. Catatan buat CV-mu** | 2 contoh kalimat CV asli versus versi yang lebih kuat, 3 perbaikan cepat, 2 perbaikan jangka panjang. | CV langsung bisa diperbaiki. |
| **5. Enam Arah Karir Berikutnya** | 6 peran yang cocok, urut dari yang paling dekat. Tiap peran: fungsi, 5 kompetensi, yang sudah dimiliki, kenapa cocok, hari-harinya, bagian yang menantang, jalur karir, **kisaran gaji (acuan Jakarta)**, industri, yang perlu disiapkan. Plus 4 jenis tempat kerja yang paling cocok (korporat, startup, BUMN, dan lain-lain) dan kata kunci lowongan. | Arah yang konkret, bukan cuma "kamu cocok jadi apa". |
| **6. Langkah Sekarang** | 3 langkah yang bisa dikerjakan minggu ini, batasan hasil, dan penutup. | Ada tindakan nyata. |
| **Unduhan PDF** | *Peta potensimu* (laporan lengkap) dan CV rapi satu kolom (khusus yang menyusun CV di aplikasi). | Bisa disimpan dan dicetak. |

> **Catatan gaji:** kisaran gaji diambil dari tabel referensi Nawasena (acuan Jakarta), **bukan ditulis AI**. Di aplikasi dan PDF selalu tampil catatan bahwa angka ini bukan tawaran gaji dan di kota lain bisa jauh lebih rendah.

### 2.3 Alur pembayaran

1. Pengguna membaca Bagian 1 dan klik **Raih karirmu sekarang**.
2. Di halaman bayar, pengguna boleh memasukkan **kode referral**. Harga langsung turun dan potongannya terlihat.
3. Pengguna membayar lewat **QRIS** atau **transfer bank**, lalu mengunggah bukti bayar.
4. Admin mengecek di backoffice (`/admin`), mengunggah receipt (wajib), lalu **Konfirmasi**.
5. Pengguna menerima **email receipt** dan laporan lengkap mulai disusun otomatis.
6. Kalau ditolak, pengguna melihat alasannya dan bisa mengirim ulang bukti.

Belum ada pembayaran otomatis (payment gateway). Semua pembayaran dikonfirmasi manual oleh admin.

### 2.4 Referral ambassador

| | |
|---|---|
| Link | `nawasena.me/xxxxxx` (microsite) dan `apps.nawasena.info/xxxxxx` (aplikasi). Kode 6 huruf acak, tidak menyebut nama ambassador. |
| Potongan untuk user | Diatur per ambassador di backoffice (default Rp5.000). |
| Komisi ambassador | Diatur per ambassador (default Rp5.000 per paid user). Nilai komisi dikunci saat pembayaran dikonfirmasi. |
| Batas | Kode tidak bisa diganti setelah pembayaran dikonfirmasi. |

### 2.5 Metrik yang bisa dipantau

- **Konversi free ke paid** = jumlah pesanan `status = ok` ÷ jumlah pengguna yang Bagian 1-nya siap.
- **Drop-off di halaman bayar** = pengguna yang membuka halaman bayar tetapi tidak mengirim bukti.
- **Waktu konfirmasi** = selisih `pesanan.dikirim` dan `pesanan.dicek`.
- **Kontribusi ambassador** = paid user per ambassador (backoffice → Ambassador).

---

## 3. Detail teknis (untuk engineer)

### 3.1 Penanda "paid"

Satu-satunya sumber kebenaran: **ada baris `public.pesanan` milik user dengan `status = 'ok'`**.

```sql
-- public.sudah_lunas(p_user uuid) → boolean   (security definer)
select exists(select 1 from public.pesanan where user_id = p_user and status = 'ok')
```

Status pesanan: `menunggu` (bukti terkirim) → `ok` (dikonfirmasi) / `tolak` (ditolak).
Hanya admin (lewat edge function `konfirmasi`) yang bisa mengubah status ke `ok`.

### 3.2 Data dan pembatas akses

| Data | Tabel | Dibuat oleh | Siapa bisa baca (RLS) |
|---|---|---|---|
| Bagian 1 (free) | `laporan` (`bagian1` jsonb, `status`) | Edge function `analisis` | `user_id = auth.uid()` |
| Bagian 2–6 (paid) | `laporan_lengkap` (`bagian` jsonb, `status`, `bagian_status`) | Edge function `laporan-lengkap` | `user_id = auth.uid() AND sudah_lunas(auth.uid())` |
| Pesanan | `pesanan` | RPC `kirim_bukti` (user), `konfirmasi` (admin) | Pemilik atau admin |
| Gaji | `peran_referensi` (`gaji_masuk`, `gaji_menengah`, `gaji_senior`) | Diisi tim | Dibaca server saja |

Gating dilakukan di **dua lapis server**, bukan hanya di UI:

1. **Pembuatan:** `laporan-lengkap` memanggil `sudah_lunas()` dan menjawab **HTTP 402** kalau belum lunas. Bagian 2–6 tidak pernah dibuat untuk user free, jadi biaya AI tidak keluar.
2. **Pembacaan:** policy RLS di `laporan_lengkap` menolak user yang belum lunas, walaupun barisnya ada.

### 3.3 Alur di klien (`web/aset/app.js`)

| Fungsi | Peran |
|---|---|
| `arahkan()` | Menentukan layar dari data tersimpan. `pesanan.status === 'ok'` mengarah ke `laporan` (6 bagian). Selain itu mengarah ke `hasil` (Bagian 1 + ajakan bayar). |
| `segarkan()` | Dipanggil lewat realtime (`API.pantau`). Pindah `menunggu → berhasil` saat admin mengonfirmasi. |
| `pastikanLengkap()` | Kalau lunas dan laporan lengkap belum siap atau macet, panggil `API.mintaLaporanLengkap()`. Jeda coba ulang naik bertahap: 1, 2, 4, 8, lalu 10 menit. |
| `bukaCetak('laporan' / 'cv')` | Membuka `cetak.html`. Tombolnya hanya ada di layar laporan berbayar (bagian Unduhan). |

### 3.4 Pemakaian AI per pengguna

| Tahap | Edge function | Panggilan AI | Free / Paid |
|---|---|---|---|
| Saran target | `saran-target` | 1 | Free |
| Bagian 1 | `analisis` | 1 (+ maks. 3 kali analisis ulang) | Free |
| Rencana (Bagian 2–4 + 6 arah) | `laporan-lengkap` langkah `rencana` | 1 | Paid |
| Arah 1–3 | `laporan-lengkap` langkah `arahA` | 1 | Paid |
| Arah 4–6 + tempat kerja + Bagian 6 | `laporan-lengkap` langkah `arahB` | 1 | Paid |

Jadi **user free ≈ 2 panggilan AI**, **user paid ≈ 5 panggilan AI**. Biaya AI terbesar hanya keluar setelah ada pemasukan.

### 3.5 Harga dan potongan

- Harga ada di dua tempat dan **harus sama**:
  - `web/config.js` → `HARGA: 49000` (tampilan);
  - RPC `kirim_bukti` → `harga int := 49000` (nominal tagihan yang tercatat).
- Potongan referral dihitung di server (`kirim_bukti`) dari `profil.ambassador_id`, bukan dari klien.
- `MODE_UJI_COBA: false` di `config.js`. Kalau `true`, halaman bayar hanya menampilkan label "tidak perlu transfer sungguhan". Alur dan konfirmasi admin tetap sama.

### 3.6 Kalau mau mengubah apa yang gratis atau berbayar

| Perubahan | Yang disentuh |
|---|---|
| Memindahkan isi Bagian 1 ↔ Bagian 2–6 | Skema `skemaBagian1` / `skemaRencana` / `skemaArahA/B` di `supabase/functions/laporan-lengkap/_shared/panduan.ts` (dipakai juga oleh `analisis`), lalu tampilan di `web/aset/vals.js` + `web/index.html` (`tpl` dan `tpl-desktop`). |
| Membuat unduhan CV gratis | Tambah tombol `unduhCVKlik` di layar `previewcv`. `cetak.html?jenis=cv` hanya butuh data `cv`, tidak butuh status lunas. |
| Mengubah harga | `web/config.js` + migrasi baru untuk `kirim_bukti` (dan batas `ambassador_potongan_check`). |
| Paket bertingkat | Tambah kolom `paket` di `pesanan`, ganti `sudah_lunas()` jadi pengecekan per paket, dan pecah langkah `laporan-lengkap`. |
