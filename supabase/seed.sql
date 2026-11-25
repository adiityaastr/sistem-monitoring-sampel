-- =====================================================================
-- Seed data contoh — beberapa item dari SISIPAN 13
-- Jalankan SETELAH migrasi.
-- GANTI email admin di bawah dengan email yang Anda pakai untuk login.
-- =====================================================================

-- 1) Admin pertama
insert into public.team_members (email, nama, role)
values ('admin@contoh.com', 'Admin', 'admin')
on conflict (email) do nothing;

-- 2) Project contoh
insert into public.projects (nama, link_folder_desain, full_cetak, project_selesai)
values ('SISIPAN 13', 'https://drive.google.com/drive/folders/contoh-sisipan-13', 'BELUM', 'BELUM')
on conflict (nama) do nothing;

-- 3) Item contoh (mencakup setiap tahap Langkah Berikutnya)
insert into public.items (
  project_id, brand, nama_produk, gramasi, no_batch, sediaan, kebutuhan, cek_kemasan,
  file_kemasan, kemasan, kelompok_koding, diserahkan_ke_koding, koding_kemasan,
  diserahkan_ke_produksi, tanggal_diserahkan, status_sampel, selesai, catatan
)
select p.id, v.brand, v.nama_produk, v.gramasi, v.no_batch, v.sediaan, v.kebutuhan, v.cek_kemasan,
       v.file_kemasan, v.kemasan, v.kelompok_koding, v.diserahkan_ke_koding, v.koding_kemasan,
       v.diserahkan_ke_produksi, v.tanggal_diserahkan::date, v.status_sampel, v.selesai, v.catatan
from public.projects p
cross join (values
  ('EPI', 'MADU HERBAL ANAK',   '150 ML', 'MHA 130426', 'COL',          'GANTI CODING',    'SUDAH', 'https://drive.google.com/file/d/contoh1', 'TIDAK PERLU',   null,       'BELUM', 'BELUM', 'BELUM', null,         'BELUM DIBUAT',    'BELUM', null),
  ('EPI', 'MADU HERBAL ANAK',   '150 ML', 'MHA 140426', 'COL',          'GANTI CODING',    'SUDAH', 'https://drive.google.com/file/d/contoh1', 'TIDAK PERLU',   null,       'BELUM', 'BELUM', 'BELUM', null,         'BELUM DIBUAT',    'BELUM', null),
  ('EPI', 'KAPSUL TEMULAWAK',   '60 KPS', 'KTL 020526', 'KAPSUL',       'BUAT BARU',       'BELUM', null,                                       'PERLU CETAK',   null,       'BELUM', 'BELUM', 'BELUM', null,         'BELUM DIBUAT',    'BELUM', 'Menunggu foto produk'),
  ('EPI', 'SERBUK JAHE MERAH',  '10 SCT', 'SJM 250326', 'COD (SACHET)', 'GANTI KEMASAN',   'SUDAH', 'https://drive.google.com/file/d/contoh2', 'SUDAH DICETAK', 'KODING 1', 'SUDAH', 'BELUM', 'BELUM', null,         'BELUM DIBUAT',    'BELUM', null),
  ('EPI', 'TEH DAUN KELOR',     '20 TB',  'TDK 010426', 'TEH',          'TIDAK PERLU',     'SUDAH', null,                                       'TIDAK PERLU',   'KODING 1', 'SUDAH', 'SUDAH', 'SUDAH', '2026-04-20', 'SAMPEL JADI',     'SUDAH', null),
  ('AZH', 'SALEP KULIT HERBAL', '15 G',   'SKD 130426', 'SEMI SOLID',   'PERBAIKI DESAIN', 'SUDAH', 'https://drive.google.com/file/d/contoh3', 'PERLU CETAK',   'KODING 1', 'SUDAH', 'SUDAH', 'BELUM', null,         'BELUM DIBUAT',    'BELUM', null),
  ('AZH', 'SALEP KULIT HERBAL', '15 G',   'SKD 150426', 'SEMI SOLID',   'PERBAIKI DESAIN', 'SUDAH', 'https://drive.google.com/file/d/contoh3', 'PERLU CETAK',   'KODING 1', 'SUDAH', 'SUDAH', 'SUDAH', '2026-04-22', 'PROSES PRODUKSI', 'BELUM', null),
  ('AZH', 'KAPSUL KUNYIT ASAM', '30 KPS', 'KKA 080426', 'KAPSUL',       null,              'BELUM', null,                                       null,            null,       'BELUM', 'BELUM', 'BELUM', null,         null,              'BELUM', 'Kebutuhan belum diputuskan'),
  ('AZH', 'SERBUK TEMU IRENG',  '200 G',  'STI 110426', 'SERBUK',       'GANTI CODING',    'SUDAH', 'https://drive.google.com/file/d/contoh4', 'TIDAK PERLU',   null,       'BELUM', 'BELUM', 'BELUM', null,         'BELUM DIBUAT',    'BELUM', null)
) as v(brand, nama_produk, gramasi, no_batch, sediaan, kebutuhan, cek_kemasan, file_kemasan, kemasan,
       kelompok_koding, diserahkan_ke_koding, koding_kemasan, diserahkan_ke_produksi, tanggal_diserahkan,
       status_sampel, selesai, catatan)
where p.nama = 'SISIPAN 13'
on conflict (project_id, brand, no_batch) do nothing;

-- 4) Sampel yang belum ada
insert into public.sample_missing (brand, nama_produk, gramasi, no_batch, sediaan, cek_kemasan, kemasan, selesai)
values
  ('EPI', 'MINYAK URUT HERBAL', '60 ML',  'MUH 050326', 'COL',    'SUDAH', 'PERLU CETAK',   'BELUM'),
  ('AZH', 'KAPSUL DAUN SIRSAK', '60 KPS', 'KDS 120326', 'KAPSUL', 'BELUM', 'TIDAK PERLU',   'BELUM'),
  ('AZH', 'TEH HIJAU MELATI',   '25 TB',  'THM 200226', 'TEH',    'SUDAH', 'SUDAH DICETAK', 'SUDAH')
on conflict (brand, nama_produk, no_batch) do nothing;
