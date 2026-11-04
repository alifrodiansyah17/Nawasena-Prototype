-- Backoffice v2 (2/3): voucher, format order baru, kode unik di nominal, kedaluwarsa 1 jam, riwayat status order.
--   * Order dibuat saat pengguna membuka instruksi bayar: kode NWS + DDMMYY + urutan harian 3 digit (NWS231026003)
--   * Nominal = harga − potongan + urutan (NWS231026003 → Rp49.003), supaya tiap transaksi punya nominal unik
--   * Status: belum_bayar → menunggu (bukti dikirim) → ok / tolak; belum_bayar > 1 jam → kedaluwarsa (order tetap tersimpan)
--   * Voucher: potongan Rp atau %, kuota, masa berlaku; tidak digabung dengan kode referral (pakai salah satu)

create or replace function public.harga_paket() returns int language sql immutable as $$ select 49000 $$;

-- Voucher ----------------------------------------------------------------------
create table if not exists public.voucher (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique check (kode ~ '^[A-Z0-9]{4,20}$'),
  nama text,
  jenis text not null check (jenis in ('nominal', 'persen')),
  nilai int not null check (nilai > 0),
  kuota int check (kuota is null or kuota > 0),
  mulai timestamptz not null default now(),
  berakhir timestamptz not null,
  aktif boolean not null default true,
  catatan text,
  dibuat timestamptz not null default now(),
  dibuat_oleh uuid,
  check (berakhir > mulai),
  check (jenis <> 'persen' or nilai <= 90),
  check (jenis <> 'nominal' or nilai <= 48000)
);
alter table public.voucher enable row level security;
drop policy if exists "voucher r" on public.voucher;
drop policy if exists "voucher c" on public.voucher;
drop policy if exists "voucher u" on public.voucher;
drop policy if exists "voucher d" on public.voucher;
create policy "voucher r" on public.voucher for select to authenticated using (public.izin('voucher', 'r') or public.izin('keuangan', 'r'));
create policy "voucher c" on public.voucher for insert to authenticated with check (public.izin('voucher', 'c'));
create policy "voucher u" on public.voucher for update to authenticated using (public.izin('voucher', 'u')) with check (public.izin('voucher', 'u'));
create policy "voucher d" on public.voucher for delete to authenticated using (public.izin('voucher', 'd'));
grant select, insert, update, delete on public.voucher to authenticated;
drop trigger if exists audit_voucher on public.voucher;
create trigger audit_voucher after insert or update or delete on public.voucher for each row execute function public.audit_perubahan('voucher');

alter table public.profil add column if not exists voucher_id uuid references public.voucher(id) on delete set null;

-- Pesanan ----------------------------------------------------------------------
alter table public.pesanan drop constraint if exists pesanan_status_check;
alter table public.pesanan add constraint pesanan_status_check check (status in ('belum_bayar', 'menunggu', 'ok', 'tolak', 'kedaluwarsa'));
alter table public.pesanan alter column dikirim drop not null;
alter table public.pesanan alter column dikirim drop default;
alter table public.pesanan add column if not exists harga int;
alter table public.pesanan add column if not exists kode_unik int;
alter table public.pesanan add column if not exists kedaluwarsa timestamptz;
alter table public.pesanan add column if not exists voucher_id uuid references public.voucher(id);
alter table public.pesanan add column if not exists kode_voucher text;
update public.pesanan set harga = nominal + coalesce(potongan, 0) where harga is null;
create index if not exists pesanan_status_idx on public.pesanan(status, kedaluwarsa);
create index if not exists pesanan_user_dibuat_idx on public.pesanan(user_id, dibuat desc);
create index if not exists pesanan_voucher_idx on public.pesanan(voucher_id);

create table if not exists public.urutan_pesanan (tanggal date primary key, terakhir int not null default 0);
alter table public.urutan_pesanan enable row level security;

drop policy if exists "pesanan sendiri atau admin" on public.pesanan;
create policy "pesanan sendiri atau admin" on public.pesanan for select using (
  user_id = auth.uid() or public.izin('order', 'r') or public.izin('keuangan', 'r') or public.izin('ambassador', 'r') or public.izin('audit', 'r'));

-- Voucher: hitungan pemakaian dan validasi
create or replace function public.voucher_terpakai(p_voucher uuid, p_kecuali uuid default null) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.pesanan
   where voucher_id = p_voucher and (p_kecuali is null or user_id <> p_kecuali)
     and (status in ('ok', 'menunggu') or (status = 'belum_bayar' and kedaluwarsa > now()))
$$;

create or replace function public.potongan_voucher(v public.voucher) returns int
language sql immutable as $$
  select least(case when v.jenis = 'persen' then round(public.harga_paket() * v.nilai / 100.0)::int else v.nilai end,
               public.harga_paket() - 1000)
$$;

create or replace function public.alasan_voucher(v public.voucher, p_user uuid) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not v.aktif then return 'Voucher ' || v.kode || ' sudah tidak aktif'; end if;
  if now() < v.mulai then return 'Voucher ' || v.kode || ' baru berlaku mulai ' || to_char(v.mulai at time zone 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI') || ' WIB'; end if;
  if now() > v.berakhir then return 'Voucher ' || v.kode || ' sudah kedaluwarsa'; end if;
  if v.kuota is not null and public.voucher_terpakai(v.id, p_user) >= v.kuota then return 'Kuota voucher ' || v.kode || ' sudah habis'; end if;
  return null;
end $$;

-- Potongan yang berlaku untuk pengguna: voucher (kalau masih valid) atau kode referral ambassador
create or replace function public.hitung_potongan(p_user uuid)
returns table (potongan int, ambassador_id uuid, voucher_id uuid, kode text, jenis text)
language plpgsql stable security definer set search_path = public as $$
declare p public.profil; v public.voucher; a public.ambassador;
begin
  select * into p from public.profil pr where pr.id = p_user;
  if p.voucher_id is not null then
    select * into v from public.voucher vv where vv.id = p.voucher_id;
    if found and public.alasan_voucher(v, p_user) is null then
      return query select public.potongan_voucher(v), null::uuid, v.id, v.kode, 'voucher'::text; return;
    end if;
  end if;
  if p.ambassador_id is not null then
    select * into a from public.ambassador aa where aa.id = p.ambassador_id and aa.aktif;
    if found then return query select a.potongan, a.id, null::uuid, coalesce(p.kode_referral, a.kode), 'referral'::text; return; end if;
  end if;
  return query select 0, null::uuid, null::uuid, null::text, null::text;
end $$;

create or replace function public.info_referral() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('kode', h.kode, 'potongan', h.potongan, 'jenis', h.jenis) from public.hitung_potongan(auth.uid()) h
$$;

-- Order aktif (belum dibayar) ikut diperbarui kalau pengguna mengganti kode
create or replace function public.segarkan_pesanan_aktif(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.pesanan ps
     set potongan = h.potongan, ambassador_id = h.ambassador_id, voucher_id = h.voucher_id,
         kode_voucher = case when h.jenis = 'voucher' then h.kode end,
         nominal = coalesce(ps.harga, public.harga_paket()) - h.potongan + coalesce(ps.kode_unik, 0)
    from public.hitung_potongan(p_user) h
   where ps.user_id = p_user and ps.status = 'belum_bayar' and ps.kedaluwarsa > now()
$$;

-- Satu kotak kode di aplikasi: voucher atau kode referral ambassador (tidak digabung)
create or replace function public.pakai_kode(p_kode text) returns json
language plpgsql security definer set search_path = public as $$
declare k text := upper(trim(coalesce(p_kode, ''))); v public.voucher; a public.ambassador; alasan text; h record;
begin
  if auth.uid() is null then raise exception 'Harus masuk dulu'; end if;
  if public.sudah_lunas(auth.uid()) then raise exception 'Kode tidak bisa diubah setelah pembayaran dikonfirmasi'; end if;
  if exists(select 1 from public.pesanan where user_id = auth.uid() and status = 'menunggu') then
    raise exception 'Bukti bayarmu sedang dicek, jadi kodenya belum bisa diubah';
  end if;
  if k = '' then
    update public.profil set voucher_id = null, ambassador_id = null, kode_referral = null where id = auth.uid();
  else
    select * into v from public.voucher where kode = k;
    if found then
      alasan := public.alasan_voucher(v, auth.uid());
      if alasan is not null then raise exception '%', alasan; end if;
      update public.profil set voucher_id = v.id, ambassador_id = null, kode_referral = null where id = auth.uid();
    else
      select * into a from public.ambassador where (kode = k or tautan = lower(k)) and aktif limit 1;
      if not found then raise exception 'Kode % tidak ditemukan atau sudah tidak berlaku', k; end if;
      update public.profil set ambassador_id = a.id, kode_referral = k, voucher_id = null where id = auth.uid();
    end if;
  end if;
  perform public.segarkan_pesanan_aktif(auth.uid());
  select * into h from public.hitung_potongan(auth.uid());
  return json_build_object('valid', h.kode is not null, 'dihapus', k = '', 'kode', h.kode, 'potongan', h.potongan, 'jenis', h.jenis);
end $$;

-- Kompatibilitas aplikasi versi lama
create or replace function public.pakai_kode_referral(p_kode text) returns json
language sql security definer set search_path = public as $$ select public.pakai_kode(p_kode) $$;

-- Kedaluwarsa: order belum dibayar lebih dari 1 jam (dipanggil cron tiap 5 menit, dan saat order dibuka)
create or replace function public.kedaluwarsakan_pesanan(p_user uuid default null) returns int
language sql security definer set search_path = public as $$
  with x as (
    update public.pesanan set status = 'kedaluwarsa'
     where status = 'belum_bayar' and kedaluwarsa <= now() and (p_user is null or user_id = p_user)
    returning 1)
  select count(*)::int from x
$$;

-- Buat (atau lanjutkan) order saat pengguna membuka instruksi bayar
create or replace function public.buat_pesanan(p_metode text) returns public.pesanan
language plpgsql security definer set search_path = public as $$
declare r public.pesanan; uid uuid := auth.uid(); tgl date := (now() at time zone 'Asia/Jakarta')::date; n int; h record;
begin
  if uid is null then raise exception 'Harus masuk dulu'; end if;
  if p_metode not in ('qris', 'transfer') then raise exception 'Metode tidak dikenal'; end if;
  perform public.kedaluwarsakan_pesanan(uid);
  select * into r from public.pesanan where user_id = uid and status in ('ok', 'menunggu', 'belum_bayar', 'tolak')
   order by (status = 'ok') desc, dibuat desc limit 1;
  if found then
    if r.status in ('ok', 'menunggu') then return r; end if;
    if r.status = 'belum_bayar' then perform public.segarkan_pesanan_aktif(uid); end if;
    update public.pesanan set metode = p_metode where id = r.id returning * into r;
    return r;
  end if;
  select * into h from public.hitung_potongan(uid);
  insert into public.urutan_pesanan as u (tanggal, terakhir) values (tgl, 1)
    on conflict (tanggal) do update set terakhir = u.terakhir + 1
    returning terakhir into n;
  insert into public.pesanan (kode, user_id, harga, potongan, kode_unik, nominal, metode, status, kedaluwarsa, dibuat, dikirim,
                              ambassador_id, voucher_id, kode_voucher)
  values ('NWS' || to_char(tgl, 'DDMMYY') || lpad(n::text, 3, '0'), uid, public.harga_paket(), h.potongan, n,
          public.harga_paket() - h.potongan + n, p_metode, 'belum_bayar', now() + interval '1 hour', now(), null,
          h.ambassador_id, h.voucher_id, case when h.jenis = 'voucher' then h.kode end)
  returning * into r;
  return r;
end $$;

-- Kirim bukti bayar untuk order yang sedang berjalan.
-- Order yang sudah kedaluwarsa (< 24 jam) tetap menerima bukti, untuk pengguna yang sudah terlanjur bayar.
create or replace function public.kirim_bukti(p_metode text, p_bukti_path text, p_bukti_nama text) returns public.pesanan
language plpgsql security definer set search_path = public as $$
declare r public.pesanan; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Harus masuk dulu'; end if;
  if p_metode not in ('qris', 'transfer') then raise exception 'Metode tidak dikenal'; end if;
  if p_bukti_path is null or p_bukti_path not like uid::text || '/%' then raise exception 'Bukti tidak valid'; end if;
  perform public.kedaluwarsakan_pesanan(uid);
  select * into r from public.pesanan where user_id = uid order by dibuat desc limit 1 for update;
  if found and r.status = 'ok' then return r; end if;
  if not found or (r.status = 'kedaluwarsa' and r.kedaluwarsa < now() - interval '24 hours') then
    r := public.buat_pesanan(p_metode);   -- aplikasi versi lama: order dibuat sekalian
  end if;
  update public.pesanan
     set metode = p_metode, bukti_path = p_bukti_path, bukti_nama = p_bukti_nama, status = 'menunggu',
         alasan = null, dikirim = now(), dicek = null, dicek_oleh = null
   where id = r.id returning * into r;
  return r;
end $$;

-- Riwayat status order ------------------------------------------------------------
create table if not exists public.riwayat_pesanan (
  id bigserial primary key,
  pesanan_id uuid not null references public.pesanan(id) on delete cascade,
  kode text,
  status_lama text,
  status_baru text not null,
  nominal int,
  oleh uuid,
  oleh_jenis text,          -- user | admin | sistem
  catatan text,
  waktu timestamptz not null default now()
);
create index if not exists riwayat_pesanan_idx on public.riwayat_pesanan(pesanan_id, waktu);
create index if not exists riwayat_pesanan_waktu_idx on public.riwayat_pesanan(waktu desc);
alter table public.riwayat_pesanan enable row level security;
drop policy if exists "riwayat dibaca" on public.riwayat_pesanan;
create policy "riwayat dibaca" on public.riwayat_pesanan for select to authenticated
  using (public.izin('order', 'r') or public.izin('audit', 'r') or public.izin('keuangan', 'r'));
grant select on public.riwayat_pesanan to authenticated;

create or replace function public.catat_riwayat_pesanan() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); jenis text; oleh uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if new.status = 'kedaluwarsa' then jenis := 'sistem';
  elsif uid is not null and uid = new.user_id then jenis := 'user'; oleh := uid;
  elsif new.status in ('ok', 'tolak') and new.dicek_oleh is not null then jenis := 'admin'; oleh := new.dicek_oleh;
  elsif tg_op = 'UPDATE' and old.status in ('ok', 'tolak') and new.status = 'menunggu' then jenis := 'admin'; oleh := coalesce(uid, old.dicek_oleh);
  elsif uid is not null then jenis := 'admin'; oleh := uid;
  else jenis := 'sistem';
  end if;
  insert into public.riwayat_pesanan (pesanan_id, kode, status_lama, status_baru, nominal, oleh, oleh_jenis, catatan)
  values (new.id, new.kode, case when tg_op = 'UPDATE' then old.status end, new.status, new.nominal, oleh, jenis,
          case new.status
            when 'belum_bayar' then 'Order dibuat, menunggu pembayaran'
            when 'menunggu' then case when tg_op = 'UPDATE' and old.status in ('ok', 'tolak') then 'Keputusan dibatalkan admin' else 'Bukti bayar dikirim' end
            when 'ok' then 'Pembayaran dikonfirmasi'
            when 'tolak' then 'Ditolak: ' || coalesce(new.alasan, '')
            when 'kedaluwarsa' then 'Tidak dibayar dalam 1 jam'
          end);
  return new;
end $$;
drop trigger if exists pesanan_riwayat on public.pesanan;
create trigger pesanan_riwayat after insert or update of status on public.pesanan
  for each row execute function public.catat_riwayat_pesanan();

-- Riwayat untuk order lama (sebelum fitur ini)
insert into public.riwayat_pesanan (pesanan_id, kode, status_lama, status_baru, nominal, oleh, oleh_jenis, catatan, waktu)
select p.id, p.kode, null, 'menunggu', p.nominal, p.user_id, 'user', 'Bukti bayar dikirim', coalesce(p.dikirim, p.dibuat)
  from public.pesanan p where not exists (select 1 from public.riwayat_pesanan r where r.pesanan_id = p.id);
insert into public.riwayat_pesanan (pesanan_id, kode, status_lama, status_baru, nominal, oleh, oleh_jenis, catatan, waktu)
select p.id, p.kode, 'menunggu', p.status, p.nominal, p.dicek_oleh, 'admin',
       case p.status when 'ok' then 'Pembayaran dikonfirmasi' else 'Ditolak: ' || coalesce(p.alasan, '') end, p.dicek
  from public.pesanan p where p.status in ('ok', 'tolak') and p.dicek is not null
   and not exists (select 1 from public.riwayat_pesanan r where r.pesanan_id = p.id and r.status_baru = p.status);

-- Keputusan admin juga masuk audit trail
create or replace function public.putuskan_pesanan(
  p_pesanan uuid, p_admin uuid, p_aksi text, p_alasan text default null, p_nominal int default null
) returns public.pesanan
language plpgsql security definer set search_path = public as $$
declare r public.pesanan; lama public.pesanan;
begin
  select * into lama from pesanan where id = p_pesanan;
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
  perform public.tulis_audit(p_admin, 'order', case p_aksi when 'ok' then 'konfirmasi' when 'tolak' then 'tolak' else 'batal' end,
    'pesanan', r.id::text, r.kode || ' · ' || r.nominal || coalesce(' · ' || p_alasan, ''),
    jsonb_build_object('status', lama.status), jsonb_build_object('status', r.status, 'alasan', r.alasan));
  return r;
end $$;
revoke all on function public.putuskan_pesanan(uuid, uuid, text, text, int) from public, anon, authenticated;

-- Rekap pemakaian voucher untuk backoffice
create or replace function public.rekap_voucher()
returns table (voucher_id uuid, terpakai bigint, berjalan bigint, potongan bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.izin('voucher', 'r') or public.izin('keuangan', 'r')) then raise exception 'Khusus admin'; end if;
  return query
  select v.id,
         (select count(*) from pesanan p where p.voucher_id = v.id and p.status = 'ok'),
         (select count(*) from pesanan p where p.voucher_id = v.id and (p.status = 'menunggu' or (p.status = 'belum_bayar' and p.kedaluwarsa > now()))),
         (select coalesce(sum(p.potongan), 0) from pesanan p where p.voucher_id = v.id and p.status = 'ok')
    from voucher v;
end $$;

revoke all on function public.buat_pesanan(text) from public, anon;
revoke all on function public.pakai_kode(text) from public, anon;
revoke all on function public.hitung_potongan(uuid) from public, anon, authenticated;
revoke all on function public.segarkan_pesanan_aktif(uuid) from public, anon, authenticated;
revoke all on function public.alasan_voucher(public.voucher, uuid) from public, anon, authenticated;
revoke all on function public.voucher_terpakai(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rekap_voucher() from public, anon;
grant execute on function public.buat_pesanan(text) to authenticated;
grant execute on function public.pakai_kode(text) to authenticated;
grant execute on function public.kedaluwarsakan_pesanan(uuid) to authenticated;
grant execute on function public.rekap_voucher() to authenticated;
grant execute on function public.harga_paket() to anon, authenticated;
