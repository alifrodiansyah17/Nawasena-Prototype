-- Link ambassador yang tidak kelihatan sebagai referral: nawasena.me/k7q2xp, apps.nawasena.info/k7q2xp
-- "tautan" = 6 huruf/angka acak per ambassador. Kode nama (mis. PRISKA72) tetap berlaku untuk diketik manual.
create or replace function public.buat_tautan() returns text language plpgsql volatile set search_path = public as $$
declare abjad text := 'abcdefghjkmnpqrstuvwxyz23456789'; t text;
begin
  loop
    t := '';
    for i in 1..6 loop t := t || substr(abjad, 1 + floor(random() * length(abjad))::int, 1); end loop;
    exit when not exists(select 1 from public.ambassador where tautan = t or kode = upper(t));
  end loop;
  return t;
end $$;

alter table public.ambassador add column if not exists tautan text;
update public.ambassador set tautan = public.buat_tautan() where tautan is null;
alter table public.ambassador alter column tautan set default public.buat_tautan();
alter table public.ambassador alter column tautan set not null;
alter table public.ambassador drop constraint if exists ambassador_tautan_check;
alter table public.ambassador add constraint ambassador_tautan_check check (tautan ~ '^[a-z0-9]{6}$');
create unique index if not exists ambassador_tautan_idx on public.ambassador(tautan);

-- kode yang dipakai user apa adanya (kode nama atau kode link), supaya yang ditampilkan ke user tidak membuka nama ambassador
alter table public.profil add column if not exists kode_referral text;

create or replace function public.cek_kode_referral(p_kode text) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select json_build_object('valid', true, 'kode', upper(trim(p_kode)), 'potongan', a.potongan)
       from public.ambassador a
      where (a.kode = upper(trim(p_kode)) or a.tautan = lower(trim(p_kode))) and a.aktif limit 1),
    json_build_object('valid', false))
$$;

create or replace function public.pakai_kode_referral(p_kode text) returns json
language plpgsql security definer set search_path = public as $$
declare a public.ambassador; k text := upper(trim(coalesce(p_kode, '')));
begin
  if auth.uid() is null then raise exception 'Harus masuk dulu'; end if;
  if exists(select 1 from public.pesanan where user_id = auth.uid() and status = 'ok') then
    raise exception 'Kode referral tidak bisa diubah setelah pembayaran dikonfirmasi';
  end if;
  if k = '' then
    update public.profil set ambassador_id = null, kode_referral = null where id = auth.uid();
    return json_build_object('valid', false, 'dihapus', true);
  end if;
  select * into a from public.ambassador where (kode = k or tautan = lower(k)) and aktif limit 1;
  if not found then raise exception 'Kode referral tidak ditemukan atau sudah tidak aktif'; end if;
  update public.profil set ambassador_id = a.id, kode_referral = k where id = auth.uid();
  return json_build_object('valid', true, 'kode', k, 'potongan', a.potongan);
end $$;

create or replace function public.info_referral() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select json_build_object('kode', coalesce(p.kode_referral, a.kode), 'potongan', case when a.aktif then a.potongan else 0 end)
       from public.profil p join public.ambassador a on a.id = p.ambassador_id where p.id = auth.uid()),
    json_build_object('kode', null, 'potongan', 0))
$$;
revoke all on function public.buat_tautan() from public, anon;
grant execute on function public.buat_tautan() to authenticated, service_role;
