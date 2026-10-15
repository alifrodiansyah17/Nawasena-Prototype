-- Membuat akun backoffice (tidak ada pendaftaran mandiri).
-- 1. Buat user di Supabase Dashboard → Authentication → Add user (email kantor).
-- 2. Jalankan ini dengan email tersebut. role 'owner' bisa unduh CSV; 'admin' tidak.
insert into public.admins (user_id, name, email, role)
select id, 'Nama Admin', email, 'owner' from auth.users where email = 'admin@nawasena.id';
