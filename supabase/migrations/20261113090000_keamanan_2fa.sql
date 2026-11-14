-- Keamanan login: password + verifikasi dua langkah (kode email atau Authenticator/TOTP) untuk pengguna dan backoffice,
-- serta masa berlaku akun backoffice.
--
-- Cara kerja: semua login lewat edge function `login`. Fungsi itu memeriksa password (cek_sandi), lalu kode kedua,
-- baru kemudian membuat izin_login sekali pakai dan meminta sesi ke Supabase Auth. Hook token (hook_token) menolak
-- semua penerbitan token yang tidak punya izin_login atau bukan perpanjangan sesi yang sudah lolos dua langkah,
-- sehingga login langsung ke Supabase Auth (password grant / OTP) tidak menghasilkan sesi.
-- Hook ini AKTIF setelah dipasang di Dashboard: Authentication → Hooks → Custom Access Token → public.hook_token.

-- ---------------------------------------------------------------- tabel (hanya service role / auth)
create table if not exists public.metode_2fa (
  user_id uuid primary key references auth.users(id) on delete cascade,
  metode text not null check (metode in ('email', 'totp')),
  totp_rahasia text,                    -- base32, hanya dibaca edge function (service role)
  totp_langkah bigint,                  -- langkah TOTP terakhir yang dipakai (cegah kode dipakai ulang)
  diubah timestamptz not null default now()
);
create table if not exists public.tantangan_login (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,      -- sha256 dari token yang dipegang browser
  jenis text not null check (jenis in ('login', 'daftar', 'reset', 'atur_totp')),
  peran text not null default 'pengguna' check (peran in ('pengguna', 'admin')),
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  tahap text not null,                  -- email | totp | pilih | email_baru | totp_baru | sandi_baru | selesai
  kode_hash text,
  kode_dikirim timestamptz,
  percobaan int not null default 0,
  totp_baru text,
  kedaluwarsa timestamptz not null default now() + interval '15 minutes',
  dibuat timestamptz not null default now()
);
create index if not exists tantangan_login_user on public.tantangan_login (user_id);
create table if not exists public.izin_login (
  user_id uuid primary key references auth.users(id) on delete cascade,
  berlaku timestamptz not null
);
create table if not exists public.sesi_2fa (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  dibuat timestamptz not null default now()
);
create table if not exists public.percobaan_login (
  id bigserial primary key,
  kunci text not null,                  -- akun (email/HP) atau user id
  berhasil boolean not null,
  waktu timestamptz not null default now()
);
create index if not exists percobaan_login_kunci on public.percobaan_login (kunci, waktu desc);

alter table public.metode_2fa enable row level security;
alter table public.tantangan_login enable row level security;
alter table public.izin_login enable row level security;
alter table public.sesi_2fa enable row level security;
alter table public.percobaan_login enable row level security;
revoke all on public.metode_2fa, public.tantangan_login, public.izin_login, public.sesi_2fa, public.percobaan_login from anon, authenticated;

-- ---------------------------------------------------------------- masa berlaku akun backoffice
alter table public.admin add column if not exists berlaku_sampai timestamptz;   -- null = tanpa batas

create or replace function public.admin_berlaku(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin where user_id = p_user and aktif and (berlaku_sampai is null or berlaku_sampai > now()))
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.admin_berlaku(auth.uid()) and public.sesi_admin_ok()
$$;

create or replace function public.izin(p_menu text, p_aksi text default 'r') returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin a join public.peran p on p.id = a.peran_id
                 where a.user_id = auth.uid() and a.aktif and (a.berlaku_sampai is null or a.berlaku_sampai > now())
                   and coalesce(p.izin -> p_menu, '[]'::jsonb) ? p_aksi)
     and public.sesi_admin_ok()
$$;

create or replace function public.profil_admin() returns json
language sql stable security definer set search_path = public, auth as $$
  select json_build_object('user_id', a.user_id, 'nama', a.nama, 'email', a.email, 'aktif', a.aktif,
           'peran', p.nama, 'izin', coalesce(p.izin, '{}'::jsonb),
           'berlaku_sampai', a.berlaku_sampai, 'kedaluwarsa', a.berlaku_sampai is not null and a.berlaku_sampai <= now(),
           'metode_2fa', (select m.metode from public.metode_2fa m where m.user_id = a.user_id),
           'sesi_mulai', (select s.created_at from auth.sessions s where s.id::text = coalesce(auth.jwt() ->> 'session_id', '')),
           'sesi_ok', public.sesi_admin_ok())
    from public.admin a left join public.peran p on p.id = a.peran_id
   where a.user_id = auth.uid()
$$;

-- ---------------------------------------------------------------- cek password (bcrypt Supabase Auth), hanya service role
create or replace function public.cek_sandi(p_user uuid, p_sandi text) returns boolean
language sql stable security definer set search_path = public, extensions, auth as $$
  select coalesce((select u.encrypted_password is not null and u.encrypted_password <> ''
                          and u.encrypted_password = extensions.crypt(p_sandi, u.encrypted_password)
                     from auth.users u where u.id = p_user), false)
$$;
create or replace function public.punya_sandi(p_user uuid) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce((select u.encrypted_password is not null and u.encrypted_password <> '' from auth.users u where u.id = p_user), false)
$$;
create or replace function public.cari_user_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1
$$;
revoke all on function public.cek_sandi(uuid, text) from public, anon, authenticated;
revoke all on function public.punya_sandi(uuid) from public, anon, authenticated;
revoke all on function public.cari_user_email(text) from public, anon, authenticated;
revoke all on function public.admin_berlaku(uuid) from public, anon, authenticated;

-- status 2FA milik pengguna yang sedang login (untuk layar keamanan akun)
create or replace function public.status_keamanan() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('metode', coalesce((select metode from public.metode_2fa where user_id = auth.uid()), 'email'),
                           'punya_sandi', public.punya_sandi(auth.uid()))
$$;
revoke all on function public.status_keamanan() from public, anon;
grant execute on function public.status_keamanan() to authenticated;

-- ---------------------------------------------------------------- hook token Supabase Auth
create or replace function public.hook_token(event jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (event ->> 'user_id')::uuid;
  sid uuid := nullif(event -> 'claims' ->> 'session_id', '')::uuid;
begin
  -- perpanjangan sesi yang sudah lolos dua langkah
  if sid is not null and exists(select 1 from public.sesi_2fa where session_id = sid and user_id = uid) then
    return event;
  end if;
  -- login baru yang sudah lolos password + kode kedua di edge function `login`
  if exists(select 1 from public.izin_login where user_id = uid and berlaku > now()) then
    delete from public.izin_login where user_id = uid;
    if sid is not null then insert into public.sesi_2fa (session_id, user_id) values (sid, uid) on conflict do nothing; end if;
    return event;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403,
    'message', 'Login harus lewat aplikasi Nawasena dengan verifikasi dua langkah.'));
end $$;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_token(jsonb) to supabase_auth_admin;
revoke all on function public.hook_token(jsonb) from public, anon, authenticated;
grant select, insert, delete on public.sesi_2fa, public.izin_login to supabase_auth_admin;
drop policy if exists "auth hook" on public.sesi_2fa;
create policy "auth hook" on public.sesi_2fa for all to supabase_auth_admin using (true) with check (true);
drop policy if exists "auth hook" on public.izin_login;
create policy "auth hook" on public.izin_login for all to supabase_auth_admin using (true) with check (true);

-- bersih-bersih harian: tantangan kedaluwarsa, catatan percobaan lama, sesi yang sudah dihapus Auth
create or replace function public.bersihkan_login() returns void
language sql security definer set search_path = public, auth as $$
  delete from public.tantangan_login where kedaluwarsa < now() - interval '1 day';
  delete from public.izin_login where berlaku < now();
  delete from public.percobaan_login where waktu < now() - interval '30 days';
  delete from public.sesi_2fa s where not exists (select 1 from auth.sessions a where a.id = s.session_id) and s.dibuat < now() - interval '1 day';
$$;
select cron.schedule('bersihkan-login', '17 3 * * *', 'select public.bersihkan_login()')
  where not exists (select 1 from cron.job where jobname = 'bersihkan-login');

-- Sesi lama (login sebelum fitur ini) tidak dimasukkan ke sesi_2fa: setelah hook aktif, semua orang login ulang
-- dengan password + kode kedua. Pengguna lama yang belum punya password memakai "Lupa / belum punya kata sandi".

-- status 2FA tiap akun backoffice (untuk menu Akun & role)
create or replace function public.status_2fa_admin() returns table (user_id uuid, metode text)
language sql stable security definer set search_path = public as $$
  select a.user_id, m.metode from public.admin a left join public.metode_2fa m on m.user_id = a.user_id
   where public.izin('akun', 'r')
$$;
revoke all on function public.status_2fa_admin() from public, anon;
grant execute on function public.status_2fa_admin() to authenticated;

-- bersihkan_login hanya untuk pg_cron, bukan untuk dipanggil dari browser
revoke all on function public.bersihkan_login() from public, anon, authenticated;
