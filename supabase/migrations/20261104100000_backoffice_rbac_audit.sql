-- Backoffice v2 (1/3): RBAC (role + akun), sesi admin 24 jam, audit trail.
--   * peran            : role dengan izin per menu {"menu": ["r","c","u","d"]}
--   * admin            : + email, hp, peran_id, aktif, masuk_terakhir
--   * izin(menu, aksi) : dipakai RLS dan edge function; false kalau sesi admin sudah > 24 jam
--   * audit_log        : catatan aktivitas admin (append-only)
-- Menu: order, voucher, keuangan, ambassador, akun, audit

create table if not exists public.peran (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique check (length(trim(nama)) > 0),
  deskripsi text,
  izin jsonb not null default '{}'::jsonb,
  sistem boolean not null default false,
  dibuat timestamptz not null default now()
);

alter table public.admin add column if not exists email text;
alter table public.admin add column if not exists hp text;
alter table public.admin add column if not exists peran_id uuid references public.peran(id);
alter table public.admin add column if not exists aktif boolean not null default true;
alter table public.admin add column if not exists dibuat timestamptz not null default now();
alter table public.admin add column if not exists masuk_terakhir timestamptz;

insert into public.peran (nama, deskripsi, izin, sistem) values
  ('Super admin', 'Semua menu, semua aksi',
   '{"order":["r","c","u","d"],"voucher":["r","c","u","d"],"keuangan":["r","c","u","d"],"ambassador":["r","c","u","d"],"akun":["r","c","u","d"],"audit":["r","c","u","d"]}', true),
  ('Operation', 'Authorize order dan voucher', '{"order":["r","u"],"voucher":["r","c","u","d"]}', false),
  ('Finance', 'Laporan keuangan dan rekonsiliasi', '{"keuangan":["r","c"]}', false)
on conflict (nama) do nothing;

-- Admin yang sudah ada jadi Super admin
update public.admin a set peran_id = (select id from public.peran where nama = 'Super admin'),
       email = coalesce(a.email, u.email)
  from auth.users u where u.id = a.user_id and a.peran_id is null;

-- Sesi admin berlaku 24 jam sejak login (bukan sejak token terakhir diperbarui)
create or replace function public.sesi_admin_ok() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce((select s.created_at > now() - interval '24 hours' from auth.sessions s
                    where s.id::text = coalesce(auth.jwt() ->> 'session_id', '')), false)
$$;

create or replace function public.izin(p_menu text, p_aksi text default 'r') returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin a join public.peran p on p.id = a.peran_id
                 where a.user_id = auth.uid() and a.aktif and coalesce(p.izin -> p_menu, '[]'::jsonb) ? p_aksi)
     and public.sesi_admin_ok()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin where user_id = auth.uid() and aktif) and public.sesi_admin_ok()
$$;

create or replace function public.adalah_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.izin('ambassador', 'r')
$$;

-- Data akun admin yang sedang login (untuk backoffice: menu yang boleh dibuka + awal sesi)
create or replace function public.profil_admin() returns json
language sql stable security definer set search_path = public, auth as $$
  select json_build_object('user_id', a.user_id, 'nama', a.nama, 'email', a.email, 'aktif', a.aktif,
           'peran', p.nama, 'izin', coalesce(p.izin, '{}'::jsonb),
           'sesi_mulai', (select s.created_at from auth.sessions s where s.id::text = coalesce(auth.jwt() ->> 'session_id', '')),
           'sesi_ok', public.sesi_admin_ok())
    from public.admin a left join public.peran p on p.id = a.peran_id
   where a.user_id = auth.uid()
$$;

-- Role: dibaca semua admin, diubah hanya yang punya izin menu "akun"
alter table public.peran enable row level security;
drop policy if exists "peran dibaca admin" on public.peran;
create policy "peran dibaca admin" on public.peran for select to authenticated using (public.is_admin());
drop policy if exists "peran dibuat" on public.peran;
create policy "peran dibuat" on public.peran for insert to authenticated with check (public.izin('akun', 'c'));
drop policy if exists "peran diubah" on public.peran;
create policy "peran diubah" on public.peran for update to authenticated using (public.izin('akun', 'u')) with check (public.izin('akun', 'u'));
drop policy if exists "peran dihapus" on public.peran;
create policy "peran dihapus" on public.peran for delete to authenticated using (public.izin('akun', 'd'));

-- Role sistem (Super admin) tidak bisa diubah izinnya, diganti namanya, atau dihapus
create or replace function public.jaga_peran() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.sistem then raise exception 'Role % tidak bisa dihapus', old.nama; end if;
    if exists(select 1 from public.admin where peran_id = old.id) then
      raise exception 'Role % masih dipakai akun. Pindahkan akunnya ke role lain dulu.', old.nama;
    end if;
    return old;
  end if;
  if old.sistem and (new.izin is distinct from old.izin or new.nama is distinct from old.nama or not new.sistem) then
    raise exception 'Role % adalah role sistem: izinnya tidak bisa diubah', old.nama;
  end if;
  new.sistem := old.sistem;
  return new;
end $$;
drop trigger if exists jaga_peran on public.peran;
create trigger jaga_peran before update or delete on public.peran for each row execute function public.jaga_peran();

-- Audit trail -----------------------------------------------------------------
create table if not exists public.audit_log (
  id bigserial primary key,
  waktu timestamptz not null default now(),
  admin_id uuid,
  admin_nama text,
  menu text not null,
  aksi text not null,
  objek text,
  objek_id text,
  ringkas text,
  sebelum jsonb,
  sesudah jsonb
);
create index if not exists audit_log_waktu_idx on public.audit_log(waktu desc);
create index if not exists audit_log_admin_idx on public.audit_log(admin_id, waktu desc);
alter table public.audit_log enable row level security;
drop policy if exists "audit dibaca" on public.audit_log;
create policy "audit dibaca" on public.audit_log for select to authenticated using (public.izin('audit', 'r'));
drop trigger if exists audit_log_tetap on public.audit_log;
create trigger audit_log_tetap before update or delete on public.audit_log
  for each row execute function public.audit_admin_tetap();

create or replace function public.tulis_audit(p_admin uuid, p_menu text, p_aksi text, p_objek text, p_objek_id text,
  p_ringkas text, p_sebelum jsonb default null, p_sesudah jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log (admin_id, admin_nama, menu, aksi, objek, objek_id, ringkas, sebelum, sesudah)
  values (p_admin, (select coalesce(nama, email) from public.admin where user_id = p_admin), p_menu, p_aksi,
          p_objek, p_objek_id, left(p_ringkas, 300), p_sebelum, p_sesudah)
$$;
revoke all on function public.tulis_audit(uuid, text, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;

-- Aktivitas dari backoffice (login, logout, ekspor CSV, impor laporan)
create or replace function public.catat_aktivitas(p_menu text, p_aksi text, p_ringkas text default null, p_detail jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.admin where user_id = auth.uid()) then raise exception 'Khusus admin'; end if;
  if p_aksi not in ('login', 'logout', 'ekspor', 'impor', 'sesi_habis') then raise exception 'Aksi tidak dikenal'; end if;
  if p_aksi = 'login' then update public.admin set masuk_terakhir = now() where user_id = auth.uid(); end if;
  perform public.tulis_audit(auth.uid(), coalesce(nullif(p_menu, ''), 'sistem'), p_aksi, null, null, p_ringkas, null, p_detail);
end $$;
revoke all on function public.catat_aktivitas(text, text, text, jsonb) from public, anon;
grant execute on function public.catat_aktivitas(text, text, text, jsonb) to authenticated;

-- Pemicu umum: semua create/update/delete dari admin lewat backoffice tercatat dengan isi sebelum/sesudah
create or replace function public.audit_perubahan() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); baris jsonb := to_jsonb(coalesce(new, old)); nm text;
begin
  if uid is null then return coalesce(new, old); end if;            -- dari server: dicatat oleh fungsinya sendiri
  select coalesce(nama, email) into nm from public.admin where user_id = uid;
  if nm is null then return coalesce(new, old); end if;             -- bukan admin (pengguna aplikasi)
  insert into public.audit_log (admin_id, admin_nama, menu, aksi, objek, objek_id, ringkas, sebelum, sesudah)
  values (uid, nm, tg_argv[0], case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end,
          tg_table_name, coalesce(baris ->> 'id', baris ->> 'user_id'),
          left(coalesce(baris ->> 'kode', baris ->> 'nama', baris ->> 'nama_file', baris ->> 'id'), 300),
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

drop trigger if exists audit_peran on public.peran;
create trigger audit_peran after insert or update or delete on public.peran for each row execute function public.audit_perubahan('akun');
drop trigger if exists audit_ambassador on public.ambassador;
create trigger audit_ambassador after insert or update or delete on public.ambassador for each row execute function public.audit_perubahan('ambassador');
drop trigger if exists audit_komisi on public.pembayaran_komisi;
create trigger audit_komisi after insert or update or delete on public.pembayaran_komisi for each row execute function public.audit_perubahan('ambassador');

-- Ambassador: izin per aksi (sebelumnya semua admin boleh semua)
drop policy if exists "ambassador admin" on public.ambassador;
drop policy if exists "ambassador r" on public.ambassador;
drop policy if exists "ambassador c" on public.ambassador;
drop policy if exists "ambassador u" on public.ambassador;
drop policy if exists "ambassador d" on public.ambassador;
create policy "ambassador r" on public.ambassador for select to authenticated using (public.izin('ambassador', 'r'));
create policy "ambassador c" on public.ambassador for insert to authenticated with check (public.izin('ambassador', 'c'));
create policy "ambassador u" on public.ambassador for update to authenticated using (public.izin('ambassador', 'u')) with check (public.izin('ambassador', 'u'));
create policy "ambassador d" on public.ambassador for delete to authenticated using (public.izin('ambassador', 'd'));
drop policy if exists "komisi admin" on public.pembayaran_komisi;
drop policy if exists "komisi r" on public.pembayaran_komisi;
drop policy if exists "komisi c" on public.pembayaran_komisi;
drop policy if exists "komisi u" on public.pembayaran_komisi;
drop policy if exists "komisi d" on public.pembayaran_komisi;
create policy "komisi r" on public.pembayaran_komisi for select to authenticated using (public.izin('ambassador', 'r') or public.izin('keuangan', 'r'));
create policy "komisi c" on public.pembayaran_komisi for insert to authenticated with check (public.izin('ambassador', 'c') or public.izin('ambassador', 'u'));
create policy "komisi u" on public.pembayaran_komisi for update to authenticated using (public.izin('ambassador', 'u')) with check (public.izin('ambassador', 'u'));
create policy "komisi d" on public.pembayaran_komisi for delete to authenticated using (public.izin('ambassador', 'd'));
drop policy if exists "target admin" on public.target_ambassador;
create policy "target admin" on public.target_ambassador for all to authenticated using (public.izin('ambassador', 'r')) with check (public.izin('ambassador', 'u'));

create or replace function public.hapus_ambassador(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare a public.ambassador; lepas int;
begin
  if not public.izin('ambassador', 'd') then raise exception 'Kamu tidak punya izin menghapus ambassador'; end if;
  select * into a from public.ambassador where id = p_id;
  if not found then raise exception 'Ambassador tidak ditemukan'; end if;
  if exists(select 1 from public.pesanan where ambassador_id = p_id and status = 'ok')
     or exists(select 1 from public.pembayaran_komisi where ambassador_id = p_id) then
    raise exception 'TERPAKAI: % sudah punya paid user atau catatan komisi. Nonaktifkan saja supaya riwayat keuangannya tetap tersimpan.', a.nama;
  end if;
  update public.profil set ambassador_id = null, kode_referral = null where ambassador_id = p_id;
  get diagnostics lepas = row_count;
  update public.pesanan set ambassador_id = null where ambassador_id = p_id and status <> 'ok';
  delete from public.ambassador where id = p_id;
  return json_build_object('kode', a.kode, 'nama', a.nama, 'user_dilepas', lepas);
end $$;

grant execute on function public.izin(text, text) to authenticated;
grant execute on function public.profil_admin() to authenticated;
revoke all on function public.sesi_admin_ok() from public, anon;
grant execute on function public.sesi_admin_ok() to authenticated;
grant select, insert, update, delete on public.peran to authenticated;
grant select on public.audit_log to authenticated;
