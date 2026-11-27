-- Tanggal hasil diterima kembali:
--   tanggal_terima_koding    = tanggal kemasan hasil koding diterima dari tim koding
--   tanggal_terima_produksi  = tanggal sampel diterima dari produksi
alter table public.items
  add column if not exists tanggal_terima_koding date,
  add column if not exists tanggal_terima_produksi date;

comment on column public.items.tanggal_terima_koding is 'Tanggal hasil koding diterima dari tim koding';
comment on column public.items.tanggal_terima_produksi is 'Tanggal sampel diterima dari produksi';
