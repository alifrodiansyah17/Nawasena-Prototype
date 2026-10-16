-- Kosongkan database Nawasena, sisakan hanya akun Kemal (kemalwit.work@gmail.com).
-- Jalankan sekali di Supabase → SQL Editor. Semua dalam satu transaksi: kalau ada yang gagal, tidak ada yang terhapus.
begin;

-- 1. Akun Alif dan Wahyu beserta semua datanya.
--    Menghapus auth.users ikut menghapus (cascade) profil, admin, cv, lampiran, jawaban, laporan,
--    laporan_lengkap, pesanan, bukti_bayar, dan masukan milik mereka.
update public.pesanan set dicek_oleh = null
  where dicek_oleh in ('edaeec3c-7a5f-4eb5-af2d-3fdeb9d6d72b', '028710bb-3df1-45e2-8610-f9c293b1837b');
delete from auth.users
  where id in ('edaeec3c-7a5f-4eb5-af2d-3fdeb9d6d72b', '028710bb-3df1-45e2-8610-f9c293b1837b');

-- 2. Log audit admin (1 baris, keputusan Alif). Tabel ini sengaja tidak bisa dihapus,
--    jadi pengamannya dimatikan sebentar lalu dinyalakan lagi.
alter table public.audit_admin disable trigger audit_admin_tetap;
delete from public.audit_admin;
alter table public.audit_admin enable trigger audit_admin_tetap;

-- 3. Cek: harus tersisa 1 akun (Kemal).
select u.email, p.nama from auth.users u left join public.profil p on p.id = u.id;

commit;
