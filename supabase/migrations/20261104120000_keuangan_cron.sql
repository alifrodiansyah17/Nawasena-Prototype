-- Backoffice v2 (3/3): hasil rekonsiliasi laporan eksternal (GoPay Merchant) + jadwal kedaluwarsa order.

create table if not exists public.rekonsiliasi (
  id uuid primary key default gen_random_uuid(),
  dibuat timestamptz not null default now(),
  dibuat_oleh uuid default auth.uid(),
  sumber text not null default 'gopay',
  nama_file text,
  dari date,
  sampai date,
  ringkasan jsonb not null default '{}'::jsonb,
  detail jsonb not null default '[]'::jsonb
);
create index if not exists rekonsiliasi_dibuat_idx on public.rekonsiliasi(dibuat desc);
alter table public.rekonsiliasi enable row level security;
drop policy if exists "rekon r" on public.rekonsiliasi;
drop policy if exists "rekon c" on public.rekonsiliasi;
drop policy if exists "rekon d" on public.rekonsiliasi;
create policy "rekon r" on public.rekonsiliasi for select to authenticated using (public.izin('keuangan', 'r'));
create policy "rekon c" on public.rekonsiliasi for insert to authenticated with check (public.izin('keuangan', 'c'));
create policy "rekon d" on public.rekonsiliasi for delete to authenticated using (public.izin('keuangan', 'd'));
grant select, insert, delete on public.rekonsiliasi to authenticated;
drop trigger if exists audit_rekon on public.rekonsiliasi;
create trigger audit_rekon after insert or delete on public.rekonsiliasi for each row execute function public.audit_perubahan('keuangan');

-- Order belum dibayar > 1 jam otomatis jadi kedaluwarsa (tiap 5 menit)
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'nawasena-kedaluwarsa';
select cron.schedule('nawasena-kedaluwarsa', '*/5 * * * *', 'select public.kedaluwarsakan_pesanan()');

-- Putus semua sesi login akun (dipakai fungsi akun-admin saat akun dinonaktifkan / sandi direset)
create or replace function public.putus_sesi(p_user uuid) returns int
language sql security definer set search_path = public, auth as $$
  with x as (delete from auth.sessions where user_id = p_user returning 1) select count(*)::int from x
$$;
revoke all on function public.putus_sesi(uuid) from public, anon, authenticated;
grant execute on function public.putus_sesi(uuid) to service_role;
grant execute on function public.tulis_audit(uuid, text, text, text, text, text, jsonb, jsonb) to service_role;
