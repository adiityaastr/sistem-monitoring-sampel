-- Pisahkan tanggal penyerahan:
--   tanggal_diserahkan         = tanggal diserahkan ke PRODUKSI (kolom lama, maknanya tetap)
--   tanggal_diserahkan_koding  = tanggal diserahkan ke KODING (baru)
alter table public.items
  add column if not exists tanggal_diserahkan_koding date;

comment on column public.items.tanggal_diserahkan is 'Tanggal item diserahkan ke produksi';
comment on column public.items.tanggal_diserahkan_koding is 'Tanggal item diserahkan ke tim koding';
