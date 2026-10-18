-- Receipt (kwitansi) pembayaran: wajib diunggah admin saat mengonfirmasi, lalu dikirim ke email pengguna.
-- File disimpan di bucket privat `kwitansi` dengan path <user_id>/<pesanan_id>-<waktu>.<ext>.
-- Unggahan dilakukan fungsi `konfirmasi` (service role), jadi tidak perlu kebijakan insert untuk browser.

alter table public.pesanan add column if not exists kwitansi_path text;
alter table public.pesanan add column if not exists kwitansi_nama text;
alter table public.pesanan add column if not exists kwitansi_terkirim timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kwitansi', 'kwitansi', false, 5242880, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- Pengguna boleh membuka receipt miliknya sendiri; admin boleh membuka semua.
drop policy if exists "kwitansi dibaca pemilik" on storage.objects;
create policy "kwitansi dibaca pemilik" on storage.objects for select to authenticated
  using (bucket_id = 'kwitansi' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kwitansi dibaca admin" on storage.objects;
create policy "kwitansi dibaca admin" on storage.objects for select to authenticated
  using (bucket_id = 'kwitansi' and exists (select 1 from public.admin a where a.user_id = auth.uid()));
