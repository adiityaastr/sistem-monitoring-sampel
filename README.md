# Monitoring Sisipan & Sampel

Aplikasi web untuk tim desain kemasan (brand **EPI** dan **AZH**) yang menggantikan Google Sheet monitoring sisipan dan sampel.

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Database & login:** Supabase (Postgres + Supabase Auth)
- **Hosting:** Netlify (deploy otomatis dari GitHub)

## Fitur

| Halaman | Isi |
| --- | --- |
| **Project** | Kartu tiap Sisipan: jumlah item per tahap, progres sampel jadi, status Full Cetak dan Project Selesai. |
| **Detail Project** | Tabel EPI dan AZH. Sel diedit langsung, filter per kolom, cari nama/batch, bulk edit, Rekap Monitoring, ekspor Excel. |
| **List Koding** | Kelompokkan otomatis (maks. 10 item, satu produk tidak dipecah), ubah kelompok manual, tandai sudah diserahkan, cetak, ekspor Excel. |
| **Sampel Belum Ada** | Tabel sampel yang belum ada, dengan filter dan edit langsung. |
| **Impor** | Impor file .xlsx lama, tampilkan pratinjau, lalu simpan. Duplikat (project + brand + no batch) dilewati. |
| **Pengaturan** | Kelola pilihan dropdown (master_options) dan anggota tim. |

### Aturan otomatis

Nilai berikut dihitung di aplikasi dan tidak disimpan ke database (`src/lib/rules.ts`, `src/lib/koding.ts`):

1. **Tanggal batch** diambil dari 6 digit terakhir `no_batch` (DDMMYY). Contoh: `SKD 130426` → 13/04/2026.
2. **Status Desain** memakai `status_desain_manual` bila diisi. Jika tidak: **SUDAH ADA** bila ada file kemasan, Selesai = SUDAH, atau Kebutuhan = TIDAK PERLU. Selain itu **BELUM ADA**.
3. **Status** diperiksa berurutan: SELESAI → BELUM DITENTUKAN → AMAN → CEK KEMASAN DANAMON → PROSES CETAK → PROSES + kebutuhan.
4. **Langkah Berikutnya** diperiksa berurutan: SELESAI → TUNGGU SAMPEL DARI PRODUKSI → BUAT DESAIN DULU → SIAP DISERAHKAN KE PRODUKSI → TUNGGU KODING → SERAHKAN KE KODING.
5. **Urutan tabel** mengikuti tahap (SERAHKAN KE KODING, TUNGGU KODING, SIAP DISERAHKAN KE PRODUKSI, TUNGGU SAMPEL DARI PRODUKSI, BUAT DESAIN DULU, SELESAI), lalu nama produk, lalu no batch.

Di kolom **Status Desain**, pilih *SUDAH ADA* atau *BELUM ADA* untuk menimpa hasil otomatis (ditandai huruf **M**). Pilih *OTOMATIS* untuk kembali ke hasil otomatis.

**Kelompokkan otomatis** hanya memproses item dengan langkah *SERAHKAN KE KODING* yang belum punya kelompok. Nomor kelompok melanjutkan nomor terbesar yang sudah ada. Jika produk yang sama sudah punya kelompok yang belum diserahkan, batch barunya ikut masuk ke kelompok itu. Jika satu produk punya lebih dari 10 batch, produk itu mendapat satu kelompok sendiri dan aplikasi menampilkan peringatan.

---

## Cara deploy

### 1. Buat project Supabase

1. Masuk ke <https://supabase.com>, lalu klik **New project**. Pilih region terdekat, misalnya *Southeast Asia (Singapore)*.
2. Tunggu sampai project siap.
3. Buka **Project Settings → API**, lalu catat:
   - **Project URL**, contoh `https://abcd1234.supabase.co`
   - **anon public key**

> Jangan pernah memakai `service_role` key di aplikasi ini.

### 2. Jalankan migrasi database

1. Di Supabase, buka **SQL Editor → New query**.
2. Salin seluruh isi `supabase/migrations/20261125000000_init.sql`, tempel, lalu klik **Run**.
   Migrasi ini membuat tabel, Row Level Security, trigger audit (`updated_by`/`updated_at`), pilihan dropdown bawaan, dan Realtime untuk tabel `items`.
3. Buka `supabase/seed.sql` dan **ganti `admin@contoh.com` dengan email Anda**. Lalu jalankan file itu di SQL Editor dengan cara yang sama.
   Seed ini mendaftarkan Anda sebagai admin pertama dan mengisi contoh data SISIPAN 13. Kalau tidak mau data contoh, cukup jalankan bagian *1) Admin pertama*.

Jika memakai Supabase CLI: `supabase link --project-ref <ref>` lalu `supabase db push`.

#### Keamanan (RLS)

- Pengguna yang belum login tidak bisa membaca atau menulis apa pun.
- Pengguna yang sudah login hanya bisa mengakses data jika emailnya terdaftar dan aktif di tabel `team_members`, yang dikelola di menu **Pengaturan → Anggota Tim**. Jadi orang yang berhasil mendaftar sendiri tetap tidak bisa melihat data.
- Hanya **admin** yang boleh mengubah pilihan dropdown dan anggota tim.

### 3. Atur login (Supabase Auth)

1. Buka **Authentication → URL Configuration**:
   - **Site URL**: URL Netlify Anda, misalnya `https://monitoring-sisipan.netlify.app` (isi setelah langkah 5).
   - **Redirect URLs**: tambahkan URL yang sama, plus `http://localhost:5173` untuk pengembangan lokal.
2. Anggota tim bisa masuk dengan dua cara:
   - **Link email (magic link):** di halaman login pilih *Link email*. Tidak perlu kata sandi.
   - **Kata sandi:** admin membuat user di **Authentication → Users → Add user** (centang *Auto Confirm User*).
3. Setiap anggota baru juga harus ditambahkan emailnya di **Pengaturan → Anggota Tim** di aplikasi.

### 4. Push ke GitHub

```bash
git init -b main
git add .
git commit -m "Monitoring Sisipan & Sampel"
git remote add origin https://github.com/<akun>/<nama-repo>.git
git push -u origin main
```

`.env` dan `.env.local` sudah masuk `.gitignore`, jadi kunci tidak ikut ter-push.

### 5. Hubungkan repo ke Netlify

1. Masuk ke <https://app.netlify.com>, lalu pilih **Add new site → Import an existing project → GitHub**, dan pilih repo ini.
2. Pengaturan build terbaca otomatis dari `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Redirect SPA: `/*  /index.html  200`
3. Sebelum deploy, buka **Site configuration → Environment variables** dan tambahkan:

   | Key | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Project URL dari langkah 1 |
   | `VITE_SUPABASE_ANON_KEY` | anon public key dari langkah 1 |

4. Klik **Deploy**. Setelah selesai, salin URL situs ke **Site URL** dan **Redirect URLs** di Supabase (langkah 3).

> Variabel `VITE_*` dimasukkan ke aplikasi saat build. Setelah mengubahnya, jalankan **Deploys → Trigger deploy → Clear cache and deploy site**.

Setiap kali Anda push ke branch `main`, Netlify otomatis membangun dan men-deploy ulang aplikasi.

---

## Pengembangan lokal

Butuh Node.js 18 atau lebih baru.

```bash
npm install
cp .env.example .env.local   # isi URL & anon key Supabase
npm run dev                  # http://localhost:5173
npm test                     # unit test aturan otomatis
npm run build                # build produksi ke dist/
```

## Impor dari Google Sheet lama

1. Di Google Sheet, pilih **File → Download → Microsoft Excel (.xlsx)**.
2. Di aplikasi, buka menu **Impor** lalu pilih file tersebut.
3. Struktur yang dikenali:
   - **Sheet `PROJECT_SISIPAN_x`** menjadi satu project bernama `SISIPAN x`. Setiap blok diawali baris berisi `EPI` atau `AZH`, diikuti baris header yang memuat **NAMA PRODUK** dan **NO BATCH**, lalu baris data. Kalau header punya kolom **BRAND**, nilai kolom itu yang dipakai. Label `LINK FOLDER`, `FULL CETAK`, dan `PROJECT SELESAI` dibaca dari sel di sebelah kanannya.
   - **Sheet `SAMPLE_YANG_BELUM_ADA`** menjadi daftar sampel yang belum ada.
   - Kolom hasil rumus (STATUS, LANGKAH BERIKUTNYA, STATUS DESAIN, tanggal batch) diabaikan karena dihitung ulang oleh aplikasi.
   - Link di sel (hyperlink) pada kolom FILE KEMASAN ikut terbaca.
4. Periksa pratinjau. Baris berlabel *SUDAH ADA* atau *GANDA* tidak akan disimpan. Hilangkan centang pada sheet yang tidak ingin diimpor, lalu klik **Simpan ke database**.

Mengimpor file yang sama dua kali aman, karena baris duplikat selalu dilewati.

## Struktur repo

```
├── netlify.toml                 # build + redirect SPA
├── supabase/
│   ├── migrations/…_init.sql    # skema, RLS, trigger, opsi bawaan
│   └── seed.sql                 # admin pertama + contoh SISIPAN 13
└── src/
    ├── lib/
    │   ├── rules.ts             # aturan otomatis (+ rules.test.ts)
    │   ├── koding.ts            # pengelompokan koding (+ koding.test.ts)
    │   ├── excelImport.ts       # parser .xlsx lama (+ excelImport.test.ts)
    │   ├── excelExport.ts       # ekspor .xlsx & rekap
    │   ├── columns.ts           # urutan kolom tabel = urutan ekspor
    │   ├── data.ts              # akses Supabase
    │   └── useItems.ts          # state item + simpan optimistik + realtime
    ├── components/              # tabel, sel editable, auth, layout, UI
    └── pages/                   # Project, Detail, Koding, Sampel, Impor, Pengaturan
```
