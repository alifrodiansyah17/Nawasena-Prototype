-- Hapus ambassador dari backoffice.
-- Ditolak kalau sudah ada paid user atau komisi yang dibayar (riwayat keuangan harus tetap utuh) — pakai Nonaktifkan.
-- Kalau belum: kode dilepas dari akun user dan pesanan yang belum lunas, lalu ambassador dihapus.
create or replace function public.hapus_ambassador(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare a public.ambassador; lepas int;
begin
  if not public.adalah_admin() then raise exception 'Khusus admin'; end if;
  select * into a from public.ambassador where id = p_id;
  if not found then raise exception 'Ambassador tidak ditemukan'; end if;
  if exists(select 1 from public.pesanan where ambassador_id = p_id and status = 'ok')
     or exists(select 1 from public.pembayaran_komisi where ambassador_id = p_id) then
    raise exception 'TERPAKAI: % sudah punya paid user atau catatan komisi. Nonaktifkan saja supaya riwayat keuangannya tetap tersimpan.', a.nama;
  end if;
  update public.profil set ambassador_id = null where ambassador_id = p_id;
  get diagnostics lepas = row_count;
  update public.pesanan set ambassador_id = null where ambassador_id = p_id and status <> 'ok';  -- nominal/potongan yang sudah dibayar tidak diubah
  delete from public.ambassador where id = p_id;
  return json_build_object('kode', a.kode, 'nama', a.nama, 'user_dilepas', lepas);
end $$;
revoke all on function public.hapus_ambassador(uuid) from public, anon;
grant execute on function public.hapus_ambassador(uuid) to authenticated, service_role;
