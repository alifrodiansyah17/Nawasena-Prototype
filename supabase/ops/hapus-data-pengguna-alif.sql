-- Hapus data PENGGUNA milik Alif (alifwahyur@gmail.com), tapi akun ADMIN-nya tetap.
-- Yang tetap: login (auth.users) dan baris di tabel admin, jadi backoffice masih bisa dibuka.
-- Yang terhapus: profil pengguna beserta semua turunannya (cascade): cv, lampiran, jawaban, laporan,
--               laporan_lengkap, pesanan + bukti_bayar, masukan.
-- Jalankan sekali di Supabase → SQL Editor. Satu transaksi: kalau ada yang gagal, tidak ada yang terhapus.
begin;

delete from public.profil
  where id = (select id from auth.users where email = 'alifwahyur@gmail.com');

-- Cek: akun Alif masih ada dan masih admin, tapi profil pengguna sudah kosong.
select u.email,
       (a.user_id is not null) as masih_admin,
       (p.id is not null)      as masih_ada_profil
from auth.users u
left join public.admin a  on a.user_id = u.id
left join public.profil p on p.id = u.id
where u.email = 'alifwahyur@gmail.com';

commit;

-- Catatan:
-- * Berkas lama Alif di Storage tidak ikut terhapus lewat SQL. Hapus lewat dashboard Storage:
--   folder edaeec3c-7a5f-4eb5-af2d-3fdeb9d6d72b di bucket "cv" dan "bukti".
-- * Log audit admin (audit_admin) sengaja dibiarkan, karena itu catatan tindakan admin, bukan data pengguna.
-- * Kalau nanti Alif membuka aplikasi pengguna dengan akun yang sama, aplikasi akan meminta isi profil lagi dari awal.
