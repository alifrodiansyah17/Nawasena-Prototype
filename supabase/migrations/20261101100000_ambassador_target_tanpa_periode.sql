-- Target pengisian kuesioner microsite cukup satu angka per ambassador (tanpa periode).
-- Progres = total isian dari link ambassador sejak awal program.
-- Tabel target_ambassador (target per periode) tidak dipakai backoffice lagi, dibiarkan untuk kebutuhan nanti.
alter table public.ambassador add column if not exists target_microsite int check (target_microsite is null or target_microsite > 0);
