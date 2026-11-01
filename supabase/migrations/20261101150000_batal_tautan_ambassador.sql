-- Link acak ambassador dibatalkan: kembali ke ?ref=KODE (kode disembunyikan dari address bar setelah dibuka).
-- Membersihkan sisa migrasi tautan yang sempat dipasang di database.
alter table public.ambassador alter column tautan drop default;
drop index if exists public.ambassador_tautan_idx;
alter table public.ambassador drop column if exists tautan;
alter table public.profil drop column if exists kode_referral;
drop function if exists public.buat_tautan();
-- cek_kode_referral, pakai_kode_referral, info_referral dikembalikan persis seperti 20261101090000_ambassador.sql
