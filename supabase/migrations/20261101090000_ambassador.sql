-- Program ambassador referral.
--  * ambassador          : data ambassador + kode referral unik, komisi per paid user, potongan harga untuk user berkode
--  * target_ambassador   : target pengisian kuesioner microsite per periode (hitungannya dari proyek Supabase microsite)
--  * pembayaran_komisi   : catatan komisi yang sudah dibayarkan ke ambassador
--  * profil.ambassador_id: ambassador yang kodenya dipakai user (sekali pasang, tidak bisa diganti setelah lunas)
--  * pesanan             : potongan dan ambassador dicatat saat bukti dikirim; komisi dikunci saat pesanan dikonfirmasi

create table if not exists public.ambassador (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique check (kode ~ '^[A-Z0-9]{4,12}$'),
  nama text not null check (length(trim(nama)) > 0),
  email text,
  hp text,
  kampus text,
  catatan text,
  komisi int not null default 5000 check (komisi >= 0),
  potongan int not null default 5000 check (potongan >= 0 and potongan < 25000),
  aktif boolean not null default true,
  dibuat timestamptz not null default now(),
  dibuat_oleh uuid
);

create table if not exists public.target_ambassador (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassador(id) on delete cascade,
  mulai date not null,
  selesai date not null,
  target int not null check (target > 0),
  dibuat timestamptz not null default now(),
  check (selesai >= mulai)
);
create index if not exists target_ambassador_idx on public.target_ambassador(ambassador_id, mulai desc);

create table if not exists public.pembayaran_komisi (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassador(id) on delete cascade,
  jumlah int not null check (jumlah > 0),
  dibayar date not null default (now() at time zone 'Asia/Jakarta')::date,
  catatan text,
  dibuat timestamptz not null default now(),
  dibuat_oleh uuid
);
create index if not exists pembayaran_komisi_idx on public.pembayaran_komisi(ambassador_id, dibayar desc);

alter table public.profil add column if not exists ambassador_id uuid references public.ambassador(id);
alter table public.pesanan add column if not exists ambassador_id uuid references public.ambassador(id);
alter table public.pesanan add column if not exists potongan int not null default 0;
alter table public.pesanan add column if not exists komisi int;
create index if not exists profil_ambassador_idx on public.profil(ambassador_id);
create index if not exists pesanan_ambassador_idx on public.pesanan(ambassador_id);

-- Hanya admin yang membaca dan mengubah data ambassador
alter table public.ambassador enable row level security;
alter table public.target_ambassador enable row level security;
alter table public.pembayaran_komisi enable row level security;
create or replace function public.adalah_admin() returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.admin where user_id = auth.uid()) $$;
drop policy if exists "ambassador admin" on public.ambassador;
create policy "ambassador admin" on public.ambassador for all to authenticated using (public.adalah_admin()) with check (public.adalah_admin());
drop policy if exists "target admin" on public.target_ambassador;
create policy "target admin" on public.target_ambassador for all to authenticated using (public.adalah_admin()) with check (public.adalah_admin());
drop policy if exists "komisi admin" on public.pembayaran_komisi;
create policy "komisi admin" on public.pembayaran_komisi for all to authenticated using (public.adalah_admin()) with check (public.adalah_admin());

-- Cek kode dari aplikasi (tanpa membuka daftar ambassador): valid + besar potongan
create or replace function public.cek_kode_referral(p_kode text) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select json_build_object('valid', true, 'kode', a.kode, 'potongan', a.potongan)
       from public.ambassador a where a.kode = upper(trim(p_kode)) and a.aktif),
    json_build_object('valid', false))
$$;

-- Pasang kode ke akun sendiri. Bisa diganti selama belum ada pembayaran yang lunas.
create or replace function public.pakai_kode_referral(p_kode text) returns json
language plpgsql security definer set search_path = public as $$
declare a public.ambassador;
begin
  if auth.uid() is null then raise exception 'Harus masuk dulu'; end if;
  if exists(select 1 from public.pesanan where user_id = auth.uid() and status = 'ok') then
    raise exception 'Kode referral tidak bisa diubah setelah pembayaran dikonfirmasi';
  end if;
  if coalesce(trim(p_kode), '') = '' then
    update public.profil set ambassador_id = null where id = auth.uid();
    return json_build_object('valid', false, 'dihapus', true);
  end if;
  select * into a from public.ambassador where kode = upper(trim(p_kode)) and aktif;
  if not found then raise exception 'Kode referral tidak ditemukan atau sudah tidak aktif'; end if;
  update public.profil set ambassador_id = a.id where id = auth.uid();
  return json_build_object('valid', true, 'kode', a.kode, 'potongan', a.potongan);
end $$;

-- Info referral akun sendiri (dipakai aplikasi untuk menampilkan harga)
create or replace function public.info_referral() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select json_build_object('kode', a.kode, 'potongan', case when a.aktif then a.potongan else 0 end)
       from public.profil p join public.ambassador a on a.id = p.ambassador_id where p.id = auth.uid()),
    json_build_object('kode', null, 'potongan', 0))
$$;

-- kirim_bukti: nominal tagihan memakai potongan dari kode referral
create or replace function public.kirim_bukti(p_metode text, p_bukti_path text, p_bukti_nama text)
returns public.pesanan language plpgsql security definer set search_path = public as $$
declare r public.pesanan; harga int := 25000; amb uuid; pot int := 0;
begin
  if auth.uid() is null then raise exception 'Harus masuk dulu'; end if;
  if p_metode not in ('qris', 'transfer') then raise exception 'Metode tidak dikenal'; end if;
  if p_bukti_path is null or p_bukti_path not like auth.uid()::text || '/%' then
    raise exception 'Bukti tidak valid';
  end if;
  select a.id, a.potongan into amb, pot from public.profil p join public.ambassador a on a.id = p.ambassador_id
   where p.id = auth.uid() and a.aktif;
  pot := coalesce(pot, 0);
  select * into r from public.pesanan where user_id = auth.uid() order by dibuat desc limit 1;
  if found and r.status = 'ok' then return r; end if;          -- sudah lunas, tidak perlu bayar lagi
  if found then
    update public.pesanan
       set metode = p_metode, bukti_path = p_bukti_path, bukti_nama = p_bukti_nama,
           status = 'menunggu', alasan = null, dikirim = now(), dicek = null, dicek_oleh = null,
           nominal = harga - pot, potongan = pot, ambassador_id = amb
     where id = r.id returning * into r;
  else
    insert into public.pesanan (kode, user_id, nominal, metode, bukti_path, bukti_nama, potongan, ambassador_id)
    values ('NWS-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-' ||
              lpad((floor(random() * 10000))::int::text, 4, '0'),
            auth.uid(), harga - pot, p_metode, p_bukti_path, p_bukti_nama, pot, amb)
    returning * into r;
  end if;
  return r;
end $$;

-- Komisi dikunci saat pesanan dikonfirmasi (perubahan komisi ambassador sesudahnya tidak mengubah yang lama)
create or replace function public.kunci_komisi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ok' and coalesce(old.status, '') <> 'ok' and new.ambassador_id is not null then
    select komisi into new.komisi from public.ambassador where id = new.ambassador_id;
  elsif new.status <> 'ok' then
    new.komisi := null;
  end if;
  return new;
end $$;
drop trigger if exists pesanan_kunci_komisi on public.pesanan;
create trigger pesanan_kunci_komisi before update of status on public.pesanan
  for each row execute function public.kunci_komisi();

-- Rekap per ambassador untuk backoffice (pendaftar, paid user, komisi, sudah dibayar)
create or replace function public.rekap_ambassador() returns table (
  ambassador_id uuid, pendaftar bigint, paid bigint, komisi bigint, dibayar bigint, terakhir_paid timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.adalah_admin() then raise exception 'Khusus admin'; end if;
  return query
  select a.id,
         (select count(*) from public.profil p where p.ambassador_id = a.id),
         (select count(*) from public.pesanan ps where ps.ambassador_id = a.id and ps.status = 'ok'),
         (select coalesce(sum(ps.komisi), 0) from public.pesanan ps where ps.ambassador_id = a.id and ps.status = 'ok'),
         (select coalesce(sum(k.jumlah), 0) from public.pembayaran_komisi k where k.ambassador_id = a.id),
         (select max(ps.dicek) from public.pesanan ps where ps.ambassador_id = a.id and ps.status = 'ok')
  from public.ambassador a;
end $$;

revoke all on function public.cek_kode_referral(text) from public;
revoke all on function public.pakai_kode_referral(text) from public, anon;
revoke all on function public.info_referral() from public, anon;
revoke all on function public.rekap_ambassador() from public, anon;
grant execute on function public.cek_kode_referral(text) to anon, authenticated, service_role;
grant execute on function public.pakai_kode_referral(text) to authenticated, service_role;
grant execute on function public.info_referral() to authenticated, service_role;
grant execute on function public.rekap_ambassador() to authenticated, service_role;
grant execute on function public.adalah_admin() to authenticated, service_role;
grant select, insert, update, delete on public.ambassador, public.target_ambassador, public.pembayaran_komisi to authenticated;
