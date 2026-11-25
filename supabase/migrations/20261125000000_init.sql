-- =====================================================================
-- Monitoring Sisipan & Sampel — skema awal
-- Jalankan di Supabase: SQL Editor > New query > tempel > Run
-- (atau `supabase db push` bila memakai Supabase CLI)
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Anggota tim (whitelist). Hanya email yang terdaftar & aktif di sini
-- yang boleh membaca/menulis data, walaupun sudah bisa login.
-- ---------------------------------------------------------------------
create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  nama        text,
  role        text not null default 'member' check (role in ('admin', 'member')),
  aktif       boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index if not exists team_members_email_lower_idx
  on public.team_members (lower(email));

-- Fungsi bantu RLS. SECURITY DEFINER agar bisa membaca team_members
-- tanpa rekursi policy.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.team_members tm
    where lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and tm.aktif
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.team_members tm
    where lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and tm.aktif
      and tm.role = 'admin'
  );
$$;

revoke execute on function public.is_member() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_member() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- Pilihan dropdown
-- ---------------------------------------------------------------------
create table if not exists public.master_options (
  id          uuid primary key default gen_random_uuid(),
  kategori    text not null check (kategori in ('status', 'sediaan', 'kebutuhan', 'kemasan', 'status_sampel')),
  nilai       text not null,
  urutan      integer not null default 0,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (kategori, nilai)
);

-- ---------------------------------------------------------------------
-- Project Sisipan
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id                 uuid primary key default gen_random_uuid(),
  nama               text not null unique,
  link_folder_desain text,
  full_cetak         text not null default 'BELUM',
  project_selesai    text not null default 'BELUM',
  created_at         timestamptz not null default now(),
  updated_by         text,
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Item (produk per batch dalam project)
-- ---------------------------------------------------------------------
create table if not exists public.items (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references public.projects(id) on delete cascade,
  brand                   text not null check (brand in ('EPI', 'AZH')),
  nama_produk             text not null,
  gramasi                 text,
  no_batch                text,
  sediaan                 text,
  kebutuhan               text,
  cek_kemasan             text default 'BELUM',
  status_desain_manual    text,
  file_kemasan            text,
  kemasan                 text,
  kelompok_koding         text,
  diserahkan_ke_koding    text default 'BELUM',
  koding_kemasan          text default 'BELUM',
  diserahkan_ke_produksi  text default 'BELUM',
  tanggal_diserahkan      date,
  status_sampel           text,
  selesai                 text default 'BELUM',
  catatan                 text,
  catatan_sampel          text,
  created_at              timestamptz not null default now(),
  updated_by              text,
  updated_at              timestamptz not null default now()
);

-- Cegah duplikat project + brand + no_batch
create unique index if not exists items_project_brand_batch_uniq
  on public.items (project_id, brand, no_batch);

create index if not exists items_project_idx on public.items (project_id);

-- ---------------------------------------------------------------------
-- Sampel yang belum ada
-- ---------------------------------------------------------------------
create table if not exists public.sample_missing (
  id           uuid primary key default gen_random_uuid(),
  brand        text not null check (brand in ('EPI', 'AZH')),
  nama_produk  text not null,
  gramasi      text,
  no_batch     text,
  sediaan      text,
  cek_kemasan  text default 'BELUM',
  kemasan      text,
  selesai      text default 'BELUM',
  created_at   timestamptz not null default now(),
  updated_by   text,
  updated_at   timestamptz not null default now()
);

create unique index if not exists sample_missing_brand_produk_batch_uniq
  on public.sample_missing (brand, nama_produk, no_batch);

-- ---------------------------------------------------------------------
-- Trigger: isi updated_at & updated_by otomatis
-- ---------------------------------------------------------------------
create or replace function public.set_audit_fields()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt() ->> 'email', new.updated_by);
  return new;
end;
$$;

drop trigger if exists trg_items_audit on public.items;
create trigger trg_items_audit before insert or update on public.items
  for each row execute function public.set_audit_fields();

drop trigger if exists trg_projects_audit on public.projects;
create trigger trg_projects_audit before insert or update on public.projects
  for each row execute function public.set_audit_fields();

drop trigger if exists trg_sample_missing_audit on public.sample_missing;
create trigger trg_sample_missing_audit before insert or update on public.sample_missing
  for each row execute function public.set_audit_fields();

-- ---------------------------------------------------------------------
-- Row Level Security
-- Hanya user yang login DAN terdaftar aktif di team_members yang boleh
-- membaca & menulis. Pengguna anonim tidak mendapat akses apa pun.
-- ---------------------------------------------------------------------
alter table public.team_members   enable row level security;
alter table public.master_options enable row level security;
alter table public.projects       enable row level security;
alter table public.items          enable row level security;
alter table public.sample_missing enable row level security;

-- team_members: user login boleh melihat barisnya sendiri (cek status
-- keanggotaan); anggota boleh melihat semua; hanya admin yang menulis.
drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select to authenticated
  using (public.is_member() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists team_members_admin_insert on public.team_members;
create policy team_members_admin_insert on public.team_members
  for insert to authenticated with check (public.is_admin());

drop policy if exists team_members_admin_update on public.team_members;
create policy team_members_admin_update on public.team_members
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists team_members_admin_delete on public.team_members;
create policy team_members_admin_delete on public.team_members
  for delete to authenticated using (public.is_admin());

-- master_options: anggota membaca, admin mengelola
drop policy if exists master_options_select on public.master_options;
create policy master_options_select on public.master_options
  for select to authenticated using (public.is_member());

drop policy if exists master_options_admin_insert on public.master_options;
create policy master_options_admin_insert on public.master_options
  for insert to authenticated with check (public.is_admin());

drop policy if exists master_options_admin_update on public.master_options;
create policy master_options_admin_update on public.master_options
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists master_options_admin_delete on public.master_options;
create policy master_options_admin_delete on public.master_options
  for delete to authenticated using (public.is_admin());

-- projects, items, sample_missing: semua anggota boleh baca & tulis
drop policy if exists projects_member_all on public.projects;
create policy projects_member_all on public.projects
  for all to authenticated
  using (public.is_member()) with check (public.is_member());

drop policy if exists items_member_all on public.items;
create policy items_member_all on public.items
  for all to authenticated
  using (public.is_member()) with check (public.is_member());

drop policy if exists sample_missing_member_all on public.sample_missing;
create policy sample_missing_member_all on public.sample_missing
  for all to authenticated
  using (public.is_member()) with check (public.is_member());

-- Cabut akses anon secara eksplisit
revoke all on public.team_members, public.master_options, public.projects,
  public.items, public.sample_missing from anon;

-- ---------------------------------------------------------------------
-- Pilihan dropdown bawaan
-- ---------------------------------------------------------------------
insert into public.master_options (kategori, nilai, urutan) values
  ('status', 'SUDAH', 1),
  ('status', 'BELUM', 2),
  ('status', 'SISIPAN TAMBAHAN', 3),
  ('sediaan', 'COD', 1),
  ('sediaan', 'COD (SACHET)', 2),
  ('sediaan', 'COL', 3),
  ('sediaan', 'KAPSUL', 4),
  ('sediaan', 'SERBUK', 5),
  ('sediaan', 'SEMI SOLID', 6),
  ('sediaan', 'TEH', 7),
  ('kebutuhan', 'BUAT BARU', 1),
  ('kebutuhan', 'GANTI CODING', 2),
  ('kebutuhan', 'GANTI KEMASAN', 3),
  ('kebutuhan', 'PERBAIKI DESAIN', 4),
  ('kebutuhan', 'TIDAK PERLU', 5),
  ('kemasan', 'PERLU CETAK', 1),
  ('kemasan', 'TIDAK PERLU', 2),
  ('kemasan', 'SUDAH DICETAK', 3),
  ('status_sampel', 'BELUM DIBUAT', 1),
  ('status_sampel', 'PROSES PRODUKSI', 2),
  ('status_sampel', 'SAMPEL JADI', 3)
on conflict (kategori, nilai) do nothing;

-- ---------------------------------------------------------------------
-- Realtime: perubahan item langsung tampil di layar anggota lain
-- (RLS tetap berlaku untuk realtime)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
     ) then
    alter publication supabase_realtime add table public.items;
  end if;
end;
$$;
