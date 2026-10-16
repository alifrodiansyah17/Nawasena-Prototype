-- Persetujuan pengolahan data pribadi (UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi).
-- profil.setuju_data = waktu pengguna mencentang persetujuan. Kosong = belum pernah setuju
-- (akun lama): aplikasi meminta persetujuan dulu sebelum lanjut.
alter table public.profil add column if not exists setuju_data timestamptz;
alter table public.profil add column if not exists setuju_versi text;

drop function if exists public.simpan_profil(text, date, text);
create or replace function public.simpan_profil(p_nama text, p_tgl_lahir date, p_hp text, p_setuju boolean default false)
returns public.profil
language plpgsql security definer set search_path = public
as $$
declare r public.profil; em text; nhp text := public.normal_hp(p_hp);
begin
  if auth.uid() is null then raise exception 'Harus masuk dulu'; end if;
  if coalesce(trim(p_nama), '') = '' then raise exception 'Nama panggilan wajib diisi'; end if;
  if length(nhp) < 10 then raise exception 'Nomor WhatsApp belum benar'; end if;
  select lower(email) into em from auth.users where id = auth.uid();
  if exists(select 1 from public.profil where hp = nhp and id <> auth.uid()) then
    raise exception 'HP_TERPAKAI';
  end if;
  insert into public.profil (id, nama, tgl_lahir, hp, email, setuju_data, setuju_versi)
  values (auth.uid(), trim(p_nama), p_tgl_lahir, nhp, em,
          case when p_setuju then now() end, case when p_setuju then '2026-10-17' end)
  on conflict (id) do update set nama = excluded.nama, tgl_lahir = excluded.tgl_lahir, hp = excluded.hp,
    setuju_data = coalesce(public.profil.setuju_data, excluded.setuju_data),
    setuju_versi = coalesce(public.profil.setuju_versi, excluded.setuju_versi)
  returning * into r;
  return r;
end $$;
revoke all on function public.simpan_profil(text, date, text, boolean) from public, anon;
grant execute on function public.simpan_profil(text, date, text, boolean) to authenticated, service_role;

-- Akun lama yang belum pernah setuju: catat persetujuan dari layar persetujuan.
create or replace function public.setujui_data()
returns public.profil
language plpgsql security definer set search_path = public
as $$
declare r public.profil;
begin
  if auth.uid() is null then raise exception 'Harus masuk dulu'; end if;
  update public.profil set setuju_data = coalesce(setuju_data, now()), setuju_versi = coalesce(setuju_versi, '2026-10-17')
  where id = auth.uid() returning * into r;
  return r;
end $$;
revoke all on function public.setujui_data() from public, anon;
grant execute on function public.setujui_data() to authenticated, service_role;
