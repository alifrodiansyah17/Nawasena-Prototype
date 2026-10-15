-- Nawasena: skema awal (aplikasi pengguna B2C + backoffice pembayaran)
--
-- Prinsip keamanan: semua tabel memakai RLS tanpa policy untuk anon/authenticated,
-- jadi browser tidak bisa membaca atau menulis langsung. Semua akses lewat server
-- Next.js memakai service role SETELAH sesi pengguna diverifikasi.
-- Status pesanan hanya berubah lewat fungsi backoffice (aplikasi pengguna tidak
-- bisa menandai dirinya sendiri lunas).

create extension if not exists pgcrypto;

-- Profil pengguna ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  birth_date date,
  whatsapp text,
  email text,
  age_level text not null default 'entry' check (age_level in ('entry','mid','senior')),
  created_at timestamptz not null default now()
);

-- CV: diunggah atau disusun di aplikasi -------------------------------------------
create table public.cvs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null check (source in ('uploaded','built')),
  file_path text,
  file_name text,
  file_size int,
  mime text,
  text_content text,
  built jsonb,                -- isian CV builder (langkah 1–7)
  builder_step int not null default 1,
  attachment_done boolean not null default false,
  facts jsonb,                -- hasil baca CV (lama kerja, dsb.)
  work_years numeric,
  cv_level text check (cv_level in ('entry','mid','senior')),
  updated_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text,
  file_name text,
  url text,
  created_at timestamptz not null default now()
);
create index on public.attachments(user_id);

-- Kuis -------------------------------------------------------------------------
create table public.assessments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers smallint[] not null default array_fill(null::smallint, array[36]),
  page int not null default 0,
  completed_at timestamptz,
  scores jsonb,
  updated_at timestamptz not null default now()
);

create table public.targets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  text text,
  filled boolean not null default false,
  level text check (level in ('entry','mid','senior')),
  created_at timestamptz not null default now()
);

-- Peta Potensimu -----------------------------------------------------------------
create table public.reports (
  user_id uuid primary key references auth.users(id) on delete cascade,
  archetype text,
  free_status text not null default 'pending' check (free_status in ('pending','generating','ready','error')),
  paid_status text not null default 'pending' check (paid_status in ('pending','generating','ready','error')),
  free jsonb,                 -- Bagian 1 (gratis)
  paid jsonb,                 -- Bagian 2–6 (hanya dikirim ke klien kalau pesanan terkonfirmasi)
  level text,
  error text,
  usage jsonb,
  generated_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Pesanan & pembayaran manual ----------------------------------------------------
create sequence public.order_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default ('NWS-' || to_char(now(), 'YYMMDD') || '-' || nextval('public.order_seq')),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null,
  method text check (method in ('qris','transfer')),
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','pending_review','confirmed','rejected','expired')),
  proof_amount int,           -- nominal di bukti (diisi admin saat cek)
  reject_reason text,
  expires_at timestamptz not null,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders(user_id);
create index on public.orders(status, submitted_at);
-- Satu pesanan aktif per pengguna (pesanan ditolak dipakai ulang).
create unique index orders_one_active on public.orders(user_id)
  where status in ('awaiting_payment','pending_review','confirmed','rejected');

create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  file_path text not null,
  file_name text,
  mime text,
  size int,
  sha256 text,
  uploaded_at timestamptz not null default now()
);
create index on public.payment_proofs(order_id);
create index on public.payment_proofs(sha256);

-- Admin backoffice ---------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'admin' check (role in ('admin','owner')),
  last_list_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- Audit log: append-only (tidak bisa diubah/dihapus, termasuk oleh service role lewat trigger)
create table public.audit_log (
  id bigserial primary key,
  admin_id uuid,
  action text not null,       -- confirm | reject | undo | proof_view | revenue_export | ...
  order_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_log(order_id);

create or replace function public.audit_log_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- Umpan balik di ujung Bagian 6 ---------------------------------------------------
create table public.need_responses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  need text not null,
  tier text,
  price_vote text,
  waitlist boolean not null default false,
  wish text,
  wish_skipped boolean,
  submitted_at timestamptz not null default now()
);

create table public.ratings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  chips text[] not null default '{}',
  text text,
  locked boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Analytics ----------------------------------------------------------------------
create table public.events (
  id bigserial primary key,
  user_id uuid,
  name text not null,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.events(name, created_at);

-- RLS: aktif di semua tabel, tanpa policy publik --------------------------------
alter table public.profiles enable row level security;
alter table public.cvs enable row level security;
alter table public.attachments enable row level security;
alter table public.assessments enable row level security;
alter table public.targets enable row level security;
alter table public.reports enable row level security;
alter table public.orders enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.admins enable row level security;
alter table public.audit_log enable row level security;
alter table public.need_responses enable row level security;
alter table public.ratings enable row level security;
alter table public.events enable row level security;

-- Keputusan backoffice: atomik, "keputusan pertama yang tersimpan menang" ----------
create or replace function public.bo_decide(
  p_order uuid, p_admin uuid, p_action text, p_reason text, p_proof_amount int
) returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if p_action = 'confirm' then
    update orders set status = 'confirmed', decided_at = now(), decided_by = p_admin,
      reject_reason = null, proof_amount = coalesce(p_proof_amount, proof_amount), updated_at = now()
    where id = p_order and status = 'pending_review' returning * into o;
  elsif p_action = 'reject' then
    if p_reason is null then raise exception 'reason required'; end if;
    update orders set status = 'rejected', decided_at = now(), decided_by = p_admin,
      reject_reason = p_reason, proof_amount = coalesce(p_proof_amount, proof_amount), updated_at = now()
    where id = p_order and status = 'pending_review' returning * into o;
  elsif p_action = 'undo' then
    -- Hanya keputusan admin itu sendiri, paling lama 15 menit (BO AC-05.1)
    update orders set status = 'pending_review', decided_at = null, decided_by = null,
      reject_reason = null, updated_at = now()
    where id = p_order and status in ('confirmed','rejected')
      and decided_by = p_admin and decided_at > now() - interval '15 minutes'
    returning * into o;
  else
    raise exception 'unknown action';
  end if;
  if o.id is null then return null; end if;
  insert into audit_log(admin_id, action, order_id, detail)
    values (p_admin, p_action, p_order, jsonb_build_object('reason', p_reason, 'proof_amount', p_proof_amount));
  return o;
end $$;
revoke all on function public.bo_decide from public, anon, authenticated;

-- Storage: semua bucket privat ---------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('cv', 'cv', false, 5242880),
  ('attachments', 'attachments', false, 10485760),
  ('proofs', 'proofs', false, 5242880)
on conflict (id) do nothing;
