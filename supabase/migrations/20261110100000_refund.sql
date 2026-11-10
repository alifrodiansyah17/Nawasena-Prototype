-- Flow refund (lihat docs/flow-refund-nawasena.pdf)
--   * Alasan A (nominal): order Ditolak karena "Nominal tidak sesuai tagihan" → refund penuh sebesar nominal yang masuk → bayar ulang (order baru)
--   * Alasan B (analisis): order lunas, analisis gagal setelah 3 kali coba ulang otomatis (Tertunda) → pengguna pilih coba lagi atau refund
--   * Refund selesai → order berstatus 'direfund' (laporan lengkap otomatis terkunci karena sudah_lunas() = false,
--     komisi ambassador batal lewat trigger kunci_komisi, kuota voucher kembali karena order tidak lagi dihitung)
--   * Refund hanya atas pengajuan pengguna, SLA 24 jam, biaya admin ditanggung Nawasena (dicatat di biaya_admin)

-- Percobaan analisis (laporan lengkap) -----------------------------------------
alter table public.laporan_lengkap add column if not exists percobaan int not null default 0;

create or replace function public.hitung_percobaan_lengkap() returns trigger language plpgsql as $$
begin
  -- satu percobaan = setiap kali penyusunan dimulai (kolom mulai berubah)
  if new.status = 'proses' and (tg_op = 'INSERT' or new.mulai is distinct from old.mulai) then
    new.percobaan := coalesce(case when tg_op = 'INSERT' then 0 else old.percobaan end, 0) + 1;
    if new.percobaan > 3 then
      raise exception 'TERTUNDA: analisis sudah dicoba 3 kali. Pengguna perlu memilih coba lagi atau refund.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists laporan_lengkap_percobaan on public.laporan_lengkap;
create trigger laporan_lengkap_percobaan before insert or update on public.laporan_lengkap
  for each row execute function public.hitung_percobaan_lengkap();

-- "Coba lagi" oleh pengguna saat analisis Tertunda: hitungan percobaan diulang (tanpa bayar ulang)
create or replace function public.coba_lagi_analisis() returns json
language plpgsql security definer set search_path = public as $$
declare l public.laporan_lengkap;
begin
  if auth.uid() is null then raise exception 'Harus masuk dulu'; end if;
  if not public.sudah_lunas(auth.uid()) then raise exception 'Pembayaran belum dikonfirmasi'; end if;
  select * into l from public.laporan_lengkap where user_id = auth.uid();
  if not found or l.status <> 'gagal' or l.percobaan < 3 then return json_build_object('ok', false, 'alasan', 'Analisis tidak sedang tertunda'); end if;
  update public.laporan_lengkap set percobaan = 0, galat = null, diubah = now() where user_id = auth.uid();
  return json_build_object('ok', true);
end $$;
revoke all on function public.coba_lagi_analisis() from public, anon;
grant execute on function public.coba_lagi_analisis() to authenticated;

-- Status order 'direfund' ---------------------------------------------------------
alter table public.pesanan drop constraint if exists pesanan_status_check;
alter table public.pesanan add constraint pesanan_status_check check (status in ('belum_bayar', 'menunggu', 'ok', 'tolak', 'kedaluwarsa', 'direfund'));

create or replace function public.catat_riwayat_pesanan() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); jenis text; oleh uuid; olehAdmin uuid := nullif(current_setting('nawasena.oleh', true), '')::uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if new.status = 'kedaluwarsa' then jenis := 'sistem';
  elsif new.status = 'direfund' then jenis := 'admin'; oleh := coalesce(olehAdmin, uid);
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
            when 'direfund' then 'Dana dikembalikan ke pengguna (refund selesai)'
          end);
  return new;
end $$;

-- Tabel refund ----------------------------------------------------------------------
create table if not exists public.refund (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique,
  pesanan_id uuid not null references public.pesanan(id),
  user_id uuid not null references public.profil(id) on delete cascade,
  alasan text not null check (alasan in ('nominal', 'analisis')),
  nominal int not null check (nominal > 0),
  status text not null default 'diajukan' check (status in ('diajukan', 'diproses', 'selesai', 'ditolak')),
  tujuan_jenis text not null check (tujuan_jenis in ('bank', 'ewallet')),
  tujuan_nama text not null,
  tujuan_nomor text not null,
  tujuan_pemilik text not null,
  milik_lain boolean not null default false,
  diajukan timestamptz not null default now(),
  batas_sla timestamptz not null default now() + interval '24 hours',
  diproses timestamptz, diproses_oleh uuid,
  selesai timestamptz, selesai_oleh uuid,
  bukti_path text, bukti_nama text,
  tanggal_transfer date, nominal_transfer int, biaya_admin int,
  ditolak timestamptz, ditolak_oleh uuid, alasan_tolak text
);
create index if not exists refund_status_idx on public.refund(status, batas_sla);
create index if not exists refund_user_idx on public.refund(user_id, diajukan desc);
create unique index if not exists refund_satu_aktif on public.refund(pesanan_id) where status in ('diajukan', 'diproses', 'selesai');
alter table public.refund enable row level security;
drop policy if exists "refund dibaca" on public.refund;
create policy "refund dibaca" on public.refund for select to authenticated
  using (user_id = auth.uid() or public.izin('refund', 'r') or public.izin('keuangan', 'r'));
grant select on public.refund to authenticated;

-- Pesanan dibaca juga oleh role menu Refund
drop policy if exists "pesanan sendiri atau admin" on public.pesanan;
create policy "pesanan sendiri atau admin" on public.pesanan for select using (
  user_id = auth.uid() or public.izin('order', 'r') or public.izin('keuangan', 'r') or public.izin('ambassador', 'r')
  or public.izin('audit', 'r') or public.izin('refund', 'r'));

-- Syarat refund untuk satu pengguna (dipakai server dan aplikasi)
create or replace function public.syarat_refund(p_user uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare o public.pesanan; l public.laporan_lengkap;
begin
  select * into o from public.pesanan where user_id = p_user order by dibuat desc limit 1;
  if not found then return json_build_object('boleh', false); end if;
  if exists(select 1 from public.refund where pesanan_id = o.id and status in ('diajukan', 'diproses', 'selesai')) then
    return json_build_object('boleh', false, 'alasan_tidak', 'Refund untuk order ini sudah diajukan');
  end if;
  if o.status = 'tolak' and o.alasan ilike 'Nominal tidak sesuai%' and coalesce(o.nominal_bukti, 0) > 0 then
    return json_build_object('boleh', true, 'alasan', 'nominal', 'nominal', o.nominal_bukti, 'pesanan_id', o.id, 'kode_order', o.kode);
  end if;
  if o.status = 'ok' then
    select * into l from public.laporan_lengkap where user_id = p_user;
    if found and l.status = 'gagal' and l.percobaan >= 3 then
      return json_build_object('boleh', true, 'alasan', 'analisis', 'nominal', o.nominal, 'pesanan_id', o.id, 'kode_order', o.kode);
    end if;
  end if;
  return json_build_object('boleh', false);
end $$;
revoke all on function public.syarat_refund(uuid) from public, anon, authenticated;
grant execute on function public.syarat_refund(uuid) to service_role;

-- Untuk aplikasi: syarat refund + refund terakhir milik pengguna
create or replace function public.info_refund() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('syarat', public.syarat_refund(auth.uid()),
    'refund', (select row_to_json(r) from (select id, kode, pesanan_id, alasan, nominal, status, tujuan_jenis, tujuan_nama,
                 right(tujuan_nomor, 4) as nomor_akhir, tujuan_pemilik, diajukan, batas_sla, diproses, selesai, tanggal_transfer,
                 bukti_path, ditolak, alasan_tolak
               from public.refund where user_id = auth.uid() order by diajukan desc limit 1) r))
$$;
revoke all on function public.info_refund() from public, anon;
grant execute on function public.info_refund() to authenticated;

create or replace function public.ajukan_refund(p_user uuid, p_jenis text, p_nama text, p_nomor text, p_pemilik text, p_milik_lain boolean)
returns public.refund language plpgsql security definer set search_path = public as $$
declare s json; r public.refund; n int; kodeOrder text;
begin
  s := public.syarat_refund(p_user);
  if not (s ->> 'boleh')::boolean then raise exception '%', coalesce(s ->> 'alasan_tidak', 'Order ini tidak memenuhi syarat refund'); end if;
  if p_jenis not in ('bank', 'ewallet') then raise exception 'Pilih rekening bank atau e-wallet'; end if;
  if coalesce(trim(p_nama), '') = '' then raise exception 'Pilih bank atau e-wallet tujuan'; end if;
  if regexp_replace(coalesce(p_nomor, ''), '\D', '', 'g') !~ '^\d{8,20}$' then raise exception 'Nomor rekening / nomor HP belum benar'; end if;
  if length(trim(coalesce(p_pemilik, ''))) < 3 then raise exception 'Isi nama pemilik rekening / e-wallet'; end if;
  kodeOrder := s ->> 'kode_order';
  select count(*) into n from public.refund where pesanan_id = (s ->> 'pesanan_id')::uuid;
  insert into public.refund (kode, pesanan_id, user_id, alasan, nominal, tujuan_jenis, tujuan_nama, tujuan_nomor, tujuan_pemilik, milik_lain)
  values ('RF-' || kodeOrder || case when n > 0 then '-' || (n + 1) else '' end, (s ->> 'pesanan_id')::uuid, p_user, s ->> 'alasan',
          (s ->> 'nominal')::int, p_jenis, trim(p_nama), regexp_replace(p_nomor, '\D', '', 'g'), trim(p_pemilik), coalesce(p_milik_lain, false))
  returning * into r;
  return r;
end $$;

create or replace function public.proses_refund(p_admin uuid, p_id uuid) returns public.refund
language plpgsql security definer set search_path = public as $$
declare r public.refund;
begin
  update public.refund set status = 'diproses', diproses = now(), diproses_oleh = p_admin
   where id = p_id and status = 'diajukan' returning * into r;
  if r.id is null then raise exception 'Refund ini sudah diproses atau diputuskan admin lain. Muat ulang ya.'; end if;
  perform public.tulis_audit(p_admin, 'refund', 'proses', 'refund', r.id::text, r.kode || ' · ' || r.nominal,
    jsonb_build_object('status', 'diajukan'), jsonb_build_object('status', 'diproses'));
  return r;
end $$;

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
  perform set_config('nawasena.oleh', p_admin::text, true);
  update public.pesanan set status = 'direfund' where id = r.pesanan_id and status in ('ok', 'tolak');
  perform set_config('nawasena.oleh', '', true);
  perform public.tulis_audit(p_admin, 'refund', 'selesai', 'refund', r.id::text,
    r.kode || ' · ' || r.nominal || ' ke ' || r.tujuan_nama || ' · biaya admin ' || p_biaya,
    jsonb_build_object('status', lama), jsonb_build_object('status', 'selesai', 'tanggal_transfer', r.tanggal_transfer, 'biaya_admin', p_biaya));
  return r;
end $$;

create or replace function public.tolak_refund(p_admin uuid, p_id uuid, p_alasan text) returns public.refund
language plpgsql security definer set search_path = public as $$
declare r public.refund; lama text;
begin
  if coalesce(trim(p_alasan), '') = '' then raise exception 'Alasan penolakan wajib diisi'; end if;
  select status into lama from public.refund where id = p_id;
  update public.refund set status = 'ditolak', ditolak = now(), ditolak_oleh = p_admin, alasan_tolak = trim(p_alasan)
   where id = p_id and status in ('diajukan', 'diproses') returning * into r;
  if r.id is null then raise exception 'Refund ini sudah diputuskan. Muat ulang ya.'; end if;
  perform public.tulis_audit(p_admin, 'refund', 'tolak', 'refund', r.id::text, r.kode || ' · ' || trim(p_alasan),
    jsonb_build_object('status', lama), jsonb_build_object('status', 'ditolak', 'alasan', trim(p_alasan)));
  return r;
end $$;

revoke all on function public.ajukan_refund(uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.proses_refund(uuid, uuid) from public, anon, authenticated;
revoke all on function public.selesaikan_refund(uuid, uuid, text, text, date, int, int) from public, anon, authenticated;
revoke all on function public.tolak_refund(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ajukan_refund(uuid, text, text, text, text, boolean) to service_role;
grant execute on function public.proses_refund(uuid, uuid) to service_role;
grant execute on function public.selesaikan_refund(uuid, uuid, text, text, date, int, int) to service_role;
grant execute on function public.tolak_refund(uuid, uuid, text) to service_role;

-- Bukti transfer refund (bucket privat): dibaca pemilik refund atau role menu Refund/Keuangan; diunggah server
insert into storage.buckets (id, name, public) values ('refund', 'refund', false) on conflict (id) do nothing;
drop policy if exists "refund dibaca pemilik atau admin" on storage.objects;
create policy "refund dibaca pemilik atau admin" on storage.objects for select to authenticated
  using (bucket_id = 'refund' and ((storage.foldername(name))[1] = auth.uid()::text or public.izin('refund', 'r') or public.izin('keuangan', 'r')));

-- RBAC: menu Refund
alter table public.peran disable trigger jaga_peran;
update public.peran set izin = izin || '{"refund":["r","c","u","d"]}'::jsonb where nama = 'Super admin';
update public.peran set izin = izin || '{"refund":["r","u"]}'::jsonb where nama = 'Finance' and not (izin ? 'refund');
update public.peran set izin = izin || '{"refund":["r"]}'::jsonb where nama = 'Operation' and not (izin ? 'refund');
alter table public.peran enable trigger jaga_peran;

-- Tertunda juga mencakup percobaan ke-3 yang macet (status proses tanpa kemajuan > 15 menit)
create or replace function public.analisis_tertunda(l public.laporan_lengkap) returns boolean
language sql stable as $$
  select l.percobaan >= 3 and (l.status = 'gagal' or (l.status = 'proses' and l.diubah < now() - interval '15 minutes'))
$$;

create or replace function public.coba_lagi_analisis() returns json
language plpgsql security definer set search_path = public as $$
declare l public.laporan_lengkap;
begin
  if auth.uid() is null then raise exception 'Harus masuk dulu'; end if;
  if not public.sudah_lunas(auth.uid()) then raise exception 'Pembayaran belum dikonfirmasi'; end if;
  select * into l from public.laporan_lengkap where user_id = auth.uid();
  if not found or not public.analisis_tertunda(l) then return json_build_object('ok', false, 'alasan', 'Analisis tidak sedang tertunda'); end if;
  update public.laporan_lengkap set percobaan = 0, status = 'gagal', galat = null, diubah = now() where user_id = auth.uid();
  return json_build_object('ok', true);
end $$;

create or replace function public.syarat_refund(p_user uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare o public.pesanan; l public.laporan_lengkap;
begin
  select * into o from public.pesanan where user_id = p_user order by dibuat desc limit 1;
  if not found then return json_build_object('boleh', false); end if;
  if exists(select 1 from public.refund where pesanan_id = o.id and status in ('diajukan', 'diproses', 'selesai')) then
    return json_build_object('boleh', false, 'alasan_tidak', 'Refund untuk order ini sudah diajukan');
  end if;
  if o.status = 'tolak' and o.alasan ilike 'Nominal tidak sesuai%' and coalesce(o.nominal_bukti, 0) > 0 then
    return json_build_object('boleh', true, 'alasan', 'nominal', 'nominal', o.nominal_bukti, 'pesanan_id', o.id, 'kode_order', o.kode);
  end if;
  if o.status = 'ok' then
    select * into l from public.laporan_lengkap where user_id = p_user;
    if found and public.analisis_tertunda(l) then
      return json_build_object('boleh', true, 'alasan', 'analisis', 'nominal', o.nominal, 'pesanan_id', o.id, 'kode_order', o.kode);
    end if;
  end if;
  return json_build_object('boleh', false);
end $$;
revoke all on function public.syarat_refund(uuid) from public, anon, authenticated;
grant execute on function public.syarat_refund(uuid) to service_role;

-- Status refund ikut realtime supaya layar status di aplikasi berubah sendiri
alter publication supabase_realtime add table public.refund;
