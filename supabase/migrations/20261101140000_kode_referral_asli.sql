-- Link boleh acak (tautan), tapi kode referral yang dilihat user selalu kode asli ambassador (mis. PRISKA72).
create or replace function public.cek_kode_referral(p_kode text) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select json_build_object('valid', true, 'kode', a.kode, 'potongan', a.potongan)
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
  update public.profil set ambassador_id = a.id, kode_referral = a.kode where id = auth.uid();
  return json_build_object('valid', true, 'kode', a.kode, 'potongan', a.potongan);
end $$;

create or replace function public.info_referral() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select json_build_object('kode', a.kode, 'potongan', case when a.aktif then a.potongan else 0 end)
       from public.profil p join public.ambassador a on a.id = p.ambassador_id where p.id = auth.uid()),
    json_build_object('kode', null, 'potongan', 0))
$$;
