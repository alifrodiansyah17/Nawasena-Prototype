-- Pengetatan keputusan pembayaran (PRD Backoffice BO-03, BO-04, BO-05, audit):
--   * keputusan pertama yang tersimpan menang (dua admin membuka pesanan yang sama)
--   * Konfirmasi/Tolak hanya dari status Menunggu
--   * Batalkan keputusan hanya oleh admin yang memutuskan, paling lama 15 menit
--   * setiap keputusan masuk audit log yang tidak bisa diubah
--   * riwayat bukti bayar tidak hilang saat pengguna mengirim ulang bukti

-- Nominal yang tertera di bukti (diisi admin saat mengecek, opsional)
alter table public.pesanan add column if not exists nominal_bukti int;

-- Riwayat bukti bayar --------------------------------------------------------------
create table if not exists public.bukti_bayar (
  id uuid primary key default gen_random_uuid(),
  pesanan_id uuid not null references public.pesanan(id) on delete cascade,
  user_id uuid not null,
  metode text,
  bukti_path text not null,
  bukti_nama text,
  dikirim timestamptz not null default now()
);
create index if not exists bukti_bayar_pesanan_idx on public.bukti_bayar(pesanan_id, dikirim desc);
alter table public.bukti_bayar enable row level security;
drop policy if exists "admin baca riwayat bukti" on public.bukti_bayar;
create policy "admin baca riwayat bukti" on public.bukti_bayar for select to authenticated using (public.is_admin());

create or replace function public.catat_bukti() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.bukti_path is not null and (tg_op = 'INSERT' or new.bukti_path is distinct from old.bukti_path) then
    insert into public.bukti_bayar (pesanan_id, user_id, metode, bukti_path, bukti_nama, dikirim)
    values (new.id, new.user_id, new.metode, new.bukti_path, new.bukti_nama, coalesce(new.dikirim, now()));
  end if;
  return new;
end $$;
drop trigger if exists pesanan_catat_bukti on public.pesanan;
create trigger pesanan_catat_bukti after insert or update of bukti_path on public.pesanan
  for each row execute function public.catat_bukti();

-- Bukti yang sudah ada sebelum migrasi ini ikut tercatat
insert into public.bukti_bayar (pesanan_id, user_id, metode, bukti_path, bukti_nama, dikirim)
select p.id, p.user_id, p.metode, p.bukti_path, p.bukti_nama, p.dikirim
from public.pesanan p
where p.bukti_path is not null
  and not exists (select 1 from public.bukti_bayar b where b.pesanan_id = p.id and b.bukti_path = p.bukti_path);

-- Audit log: hanya bisa ditambah ---------------------------------------------------
create table if not exists public.audit_admin (
  id bigserial primary key,
  admin_id uuid,
  aksi text not null,          -- ok | tolak | batal
  pesanan_id uuid,
  detail jsonb not null default '{}',
  dibuat timestamptz not null default now()
);
create index if not exists audit_admin_pesanan_idx on public.audit_admin(pesanan_id);
alter table public.audit_admin enable row level security;
drop policy if exists "admin baca audit" on public.audit_admin;
create policy "admin baca audit" on public.audit_admin for select to authenticated using (public.is_admin());

create or replace function public.audit_admin_tetap() returns trigger language plpgsql as $$
begin
  raise exception 'audit_admin hanya bisa ditambah';
end $$;
drop trigger if exists audit_admin_tetap on public.audit_admin;
create trigger audit_admin_tetap before update or delete on public.audit_admin
  for each row execute function public.audit_admin_tetap();

-- Keputusan atomik. Mengembalikan baris pesanan, atau null kalau keputusan ditolak aturan.
create or replace function public.putuskan_pesanan(
  p_pesanan uuid, p_admin uuid, p_aksi text, p_alasan text default null, p_nominal int default null
) returns public.pesanan
language plpgsql security definer set search_path = public as $$
declare r public.pesanan;
begin
  if p_aksi = 'ok' then
    update pesanan set status = 'ok', alasan = null, dicek = now(), dicek_oleh = p_admin,
      nominal_bukti = coalesce(p_nominal, nominal_bukti)
    where id = p_pesanan and status = 'menunggu' returning * into r;
  elsif p_aksi = 'tolak' then
    if coalesce(trim(p_alasan), '') = '' then raise exception 'Alasan penolakan wajib diisi'; end if;
    update pesanan set status = 'tolak', alasan = trim(p_alasan), dicek = now(), dicek_oleh = p_admin,
      nominal_bukti = coalesce(p_nominal, nominal_bukti)
    where id = p_pesanan and status = 'menunggu' returning * into r;
  elsif p_aksi = 'batal' then
    update pesanan set status = 'menunggu', alasan = null, dicek = null, dicek_oleh = null
    where id = p_pesanan and status in ('ok', 'tolak')
      and dicek_oleh = p_admin and dicek > now() - interval '15 minutes'
    returning * into r;
  else
    raise exception 'Aksi tidak dikenal';
  end if;
  if r.id is null then return null; end if;
  insert into audit_admin (admin_id, aksi, pesanan_id, detail)
  values (p_admin, p_aksi, p_pesanan, jsonb_build_object('alasan', p_alasan, 'nominal_bukti', p_nominal));
  return r;
end $$;
revoke all on function public.putuskan_pesanan(uuid, uuid, text, text, int) from public, anon, authenticated;
