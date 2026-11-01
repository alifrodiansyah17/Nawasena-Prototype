-- Proyek Supabase "Microsite NAWASENA" (nstptyfovwkvsatupggu), bukan proyek aplikasi.
-- Isian kuesioner dari link ambassador disimpan dengan sumber = 'ref:KODE'.
create index if not exists kuesioner_sumber_idx on public.kuesioner_alumni (sumber, created_at);
create or replace function public.rekap_referral(p_dari timestamptz default null, p_sampai timestamptz default null)
returns table (kode text, jumlah bigint)
language sql stable security definer set search_path = public as $$
  select upper(substr(sumber, 5)) as kode, count(*) as jumlah
    from public.kuesioner_alumni
   where sumber like 'ref:%'
     and (p_dari is null or created_at >= p_dari)
     and (p_sampai is null or created_at < p_sampai)
   group by 1
$$;
revoke all on function public.rekap_referral(timestamptz, timestamptz) from public;
grant execute on function public.rekap_referral(timestamptz, timestamptz) to anon, authenticated, service_role;
