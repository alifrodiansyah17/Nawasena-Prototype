-- Refund kelebihan/kekurangan bayar dipisah dari status order.
-- Setiap penolakan "Nominal tidak sesuai tagihan" mencatat satu transfer_salah (nominal yang benar-benar masuk).
-- Refund karena nominal menempel ke transfer_salah itu, jadi pengguna bisa mengajukan refund DAN bayar ulang
-- (unggah bukti yang sesuai) bersamaan. Refund nominal yang selesai tidak mengubah status order;
-- hanya refund karena analisis gagal yang membuat order jadi 'direfund' (akses laporan lengkap ditutup).

create table if not exists public.transfer_salah (
  id uuid primary key default gen_random_uuid(),
  pesanan_id uuid not null references public.pesanan(id),
  user_id uuid not null references public.profil(id) on delete cascade,
  nominal int not null check (nominal > 0),          -- nominal yang masuk di mutasi
  tagihan int not null,                              -- nominal order saat itu
  dicatat timestamptz not null default now(),
  dicatat_oleh uuid
);
create index if not exists transfer_salah_user on public.transfer_salah (user_id, dicatat desc);
alter table public.transfer_salah enable row level security;
drop policy if exists "lihat transfer salah" on public.transfer_salah;
create policy "lihat transfer salah" on public.transfer_salah for select
  using (user_id = auth.uid() or public.izin('order', 'r') or public.izin('refund', 'r') or public.izin('keuangan', 'r'));

alter table public.refund add column if not exists transfer_salah_id uuid references public.transfer_salah(id);

-- satu refund aktif per transfer salah (nominal) atau per order (analisis)
drop index if exists public.refund_satu_aktif;
create unique index if not exists refund_satu_aktif on public.refund (coalesce(transfer_salah_id, pesanan_id), alasan)
  where status in ('diajukan', 'diproses', 'selesai');

-- catat transfer salah saat admin menolak karena nominal
create or replace function public.putuskan_pesanan(p_pesanan uuid, p_admin uuid, p_aksi text, p_alasan text default null, p_nominal integer default null)
returns public.pesanan language plpgsql security definer set search_path = public as $$
declare r public.pesanan; lama public.pesanan;
begin
  select * into lama from pesanan where id = p_pesanan;
  if p_aksi = 'ok' then
    update pesanan set status = 'ok', alasan = null, dicek = now(), dicek_oleh = p_admin,
      nominal_bukti = coalesce(p_nominal, nominal_bukti)
    where id = p_pesanan and status = 'menunggu' returning * into r;
  elsif p_aksi = 'tolak' then
    if coalesce(trim(p_alasan), '') = '' then raise exception 'Alasan penolakan wajib diisi'; end if;
    if trim(p_alasan) ilike 'Nominal tidak sesuai%' and coalesce(p_nominal, 0) <= 0 then
      raise exception 'Isi nominal yang masuk di mutasi. Nominal ini yang direfund penuh ke pengguna.';
    end if;
    update pesanan set status = 'tolak', alasan = trim(p_alasan), dicek = now(), dicek_oleh = p_admin,
      nominal_bukti = coalesce(p_nominal, nominal_bukti)
    where id = p_pesanan and status = 'menunggu' returning * into r;
    if r.id is not null and trim(p_alasan) ilike 'Nominal tidak sesuai%' then
      insert into transfer_salah (pesanan_id, user_id, nominal, tagihan, dicatat_oleh) values (r.id, r.user_id, p_nominal, r.nominal, p_admin);
    end if;
  elsif p_aksi = 'batal' then
    update pesanan set status = 'menunggu', alasan = null, dicek = null, dicek_oleh = null
    where id = p_pesanan and status in ('ok', 'tolak')
      and dicek_oleh = p_admin and dicek > now() - interval '15 minutes'
    returning * into r;
    -- penolakan nominal yang dibatalkan: hapus catatan transfer salahnya selama belum ada refund
    if r.id is not null and lama.status = 'tolak' then
      delete from transfer_salah t where t.pesanan_id = r.id and t.dicatat_oleh = p_admin and t.dicatat > now() - interval '15 minutes'
        and not exists (select 1 from refund f where f.transfer_salah_id = t.id);
    end if;
  else
    raise exception 'Aksi tidak dikenal';
  end if;
  if r.id is null then return null; end if;
  insert into audit_admin (admin_id, aksi, pesanan_id, detail)
  values (p_admin, p_aksi, p_pesanan, jsonb_build_object('alasan', p_alasan, 'nominal_bukti', p_nominal));
  perform public.tulis_audit(p_admin, 'order', case p_aksi when 'ok' then 'konfirmasi' when 'tolak' then 'tolak' else 'batal' end,
    'pesanan', r.id::text, r.kode || ' · ' || r.nominal || coalesce(' · ' || p_alasan, '') || coalesce(' · masuk ' || p_nominal, ''),
    jsonb_build_object('status', lama.status), jsonb_build_object('status', r.status, 'alasan', r.alasan));
  return r;
end $$;

-- Syarat refund:
--  1. analisis: order terakhir lunas dan analisis lengkap Tertunda (3x gagal), belum ada refund analisis aktif
--  2. nominal : ada transfer salah yang belum punya refund aktif/selesai (tidak peduli status order sekarang)
create or replace function public.syarat_refund(p_user uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare o public.pesanan; l public.laporan_lengkap; t public.transfer_salah;
begin
  select * into o from public.pesanan where user_id = p_user order by dibuat desc limit 1;
  if found and o.status = 'ok' then
    select * into l from public.laporan_lengkap where user_id = p_user;
    if found and public.analisis_tertunda(l)
       and not exists (select 1 from public.refund where pesanan_id = o.id and alasan = 'analisis' and status in ('diajukan', 'diproses', 'selesai')) then
      return json_build_object('boleh', true, 'alasan', 'analisis', 'nominal', o.nominal, 'pesanan_id', o.id, 'kode_order', o.kode);
    end if;
  end if;
  select ts.* into t from public.transfer_salah ts
   where ts.user_id = p_user
     and not exists (select 1 from public.refund f where f.transfer_salah_id = ts.id and f.status in ('diajukan', 'diproses', 'selesai'))
   order by ts.dicatat desc limit 1;
  if found then
    select * into o from public.pesanan where id = t.pesanan_id;
    return json_build_object('boleh', true, 'alasan', 'nominal', 'nominal', t.nominal, 'tagihan', t.tagihan, 'pesanan_id', t.pesanan_id,
      'kode_order', o.kode, 'transfer_salah_id', t.id, 'jenis', case when t.nominal > t.tagihan then 'lebih' else 'kurang' end);
  end if;
  return json_build_object('boleh', false);
end $$;

create or replace function public.ajukan_refund(p_user uuid, p_jenis text, p_nama text, p_nomor text, p_pemilik text, p_milik_lain boolean)
returns public.refund language plpgsql security definer set search_path = public as $$
declare s json; r public.refund; n int; kodeOrder text;
begin
  s := public.syarat_refund(p_user);
  if not (s ->> 'boleh')::boolean then raise exception '%', coalesce(s ->> 'alasan_tidak', 'Tidak ada transaksi yang perlu direfund'); end if;
  if p_jenis not in ('bank', 'ewallet') then raise exception 'Pilih rekening bank atau e-wallet'; end if;
  if coalesce(trim(p_nama), '') = '' then raise exception 'Pilih bank atau e-wallet tujuan'; end if;
  if regexp_replace(coalesce(p_nomor, ''), '\D', '', 'g') !~ '^\d{8,20}$' then raise exception 'Nomor rekening / nomor HP belum benar'; end if;
  if length(trim(coalesce(p_pemilik, ''))) < 3 then raise exception 'Isi nama pemilik rekening / e-wallet'; end if;
  kodeOrder := s ->> 'kode_order';
  select count(*) into n from public.refund where pesanan_id = (s ->> 'pesanan_id')::uuid;
  insert into public.refund (kode, pesanan_id, user_id, alasan, nominal, tujuan_jenis, tujuan_nama, tujuan_nomor, tujuan_pemilik, milik_lain, transfer_salah_id)
  values ('RF-' || kodeOrder || case when n > 0 then '-' || (n + 1) else '' end, (s ->> 'pesanan_id')::uuid, p_user, s ->> 'alasan',
          (s ->> 'nominal')::int, p_jenis, trim(p_nama), regexp_replace(p_nomor, '\D', '', 'g'), trim(p_pemilik), coalesce(p_milik_lain, false),
          nullif(s ->> 'transfer_salah_id', '')::uuid)
  returning * into r;
  return r;
end $$;

-- Refund nominal salah tidak mengubah status order (pengguna mungkin sudah bayar ulang dan terkonfirmasi).
create or replace function public.selesaikan_refund(p_admin uuid, p_id uuid, p_bukti_path text, p_bukti_nama text,
  p_tanggal date, p_nominal int, p_biaya int) returns public.refund
language plpgsql security definer set search_path = public as $$
declare r public.refund; lama text;
begin
  select * into r from public.refund where id = p_id for update;
  if not found then raise exception 'Refund tidak ditemukan'; end if;
  if r.status not in ('diajukan', 'diproses') then raise exception 'Refund ini sudah %', r.status; end if;
  if coalesce(p_bukti_path, '') = '' then raise exception 'Bukti transfer refund wajib diunggah'; end if;
  if p_nominal is distinct from r.nominal then raise exception 'Nominal transfer harus sama dengan nominal refund (refund penuh %)', r.nominal; end if;
  if p_biaya is null or p_biaya < 0 then raise exception 'Isi biaya admin transfer (0 kalau gratis)'; end if;
  lama := r.status;
  update public.refund set status = 'selesai', selesai = now(), selesai_oleh = p_admin, bukti_path = p_bukti_path, bukti_nama = p_bukti_nama,
         tanggal_transfer = coalesce(p_tanggal, (now() at time zone 'Asia/Jakarta')::date), nominal_transfer = p_nominal, biaya_admin = p_biaya,
         diproses = coalesce(diproses, now()), diproses_oleh = coalesce(diproses_oleh, p_admin)
   where id = p_id returning * into r;
  if r.alasan = 'analisis' then
    perform set_config('nawasena.oleh', p_admin::text, true);
    update public.pesanan set status = 'direfund' where id = r.pesanan_id and status = 'ok';
    perform set_config('nawasena.oleh', '', true);
  end if;
  perform public.tulis_audit(p_admin, 'refund', 'selesai', 'refund', r.id::text,
    r.kode || ' · ' || r.nominal || ' ke ' || r.tujuan_nama || ' · biaya admin ' || p_biaya,
    jsonb_build_object('status', lama), jsonb_build_object('status', 'selesai', 'tanggal_transfer', r.tanggal_transfer, 'biaya_admin', p_biaya));
  return r;
end $$;

create or replace function public.info_refund() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('syarat', public.syarat_refund(auth.uid()),
    'refund', (select row_to_json(r) from (select id, kode, pesanan_id, alasan, nominal, status, tujuan_jenis, tujuan_nama,
                 right(tujuan_nomor, 4) as nomor_akhir, tujuan_pemilik, diajukan, batas_sla, diproses, selesai, tanggal_transfer,
                 bukti_path, ditolak, alasan_tolak, transfer_salah_id
               from public.refund where user_id = auth.uid() order by diajukan desc limit 1) r))
$$;

revoke all on function public.syarat_refund(uuid) from public, anon, authenticated;
revoke all on function public.ajukan_refund(uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.selesaikan_refund(uuid, uuid, text, text, date, int, int) from public, anon, authenticated;
revoke all on function public.putuskan_pesanan(uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.info_refund() to authenticated;

-- data lama: penolakan nominal yang sudah ada dicatat sebagai transfer salah
insert into public.transfer_salah (pesanan_id, user_id, nominal, tagihan, dicatat, dicatat_oleh)
select p.id, p.user_id, p.nominal_bukti, p.nominal, coalesce(p.dicek, now()), p.dicek_oleh
from public.pesanan p
where p.status = 'tolak' and p.alasan ilike 'Nominal tidak sesuai%' and coalesce(p.nominal_bukti, 0) > 0
  and not exists (select 1 from public.transfer_salah t where t.pesanan_id = p.id);
update public.refund f set transfer_salah_id = t.id from public.transfer_salah t
 where f.alasan = 'nominal' and f.transfer_salah_id is null and t.pesanan_id = f.pesanan_id;

alter publication supabase_realtime add table public.transfer_salah;
