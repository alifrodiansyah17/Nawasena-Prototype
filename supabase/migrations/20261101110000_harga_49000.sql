-- Harga laporan lengkap naik dari Rp25.000 ke Rp49.000 (pesanan lama yang sudah lunas tidak berubah).
alter table public.pesanan alter column nominal set default 49000;
alter table public.ambassador drop constraint if exists ambassador_potongan_check;
alter table public.ambassador add constraint ambassador_potongan_check check (potongan >= 0 and potongan < 49000);
-- kirim_bukti: sama seperti 20261101090000_ambassador.sql, hanya harga := 49000
create or replace function public.kirim_bukti(p_metode text, p_bukti_path text, p_bukti_nama text)
returns public.pesanan language plpgsql security definer set search_path = public as $$
declare r public.pesanan; harga int := 49000; amb uuid; pot int := 0;
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
