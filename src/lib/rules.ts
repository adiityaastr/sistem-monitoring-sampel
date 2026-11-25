/**
 * Aturan otomatis. Semua nilai di sini DIHITUNG di aplikasi, tidak
 * disimpan ke database. Fungsi-fungsinya murni agar mudah diuji.
 */

/** Field item yang dibutuhkan aturan. */
export interface RuleInput {
  nama_produk?: string | null;
  no_batch?: string | null;
  kebutuhan?: string | null;
  cek_kemasan?: string | null;
  status_desain_manual?: string | null;
  file_kemasan?: string | null;
  kemasan?: string | null;
  diserahkan_ke_koding?: string | null;
  koding_kemasan?: string | null;
  diserahkan_ke_produksi?: string | null;
  status_sampel?: string | null;
  selesai?: string | null;
}

export const SUDAH = 'SUDAH';
export const BELUM = 'BELUM';

/** Normalisasi untuk perbandingan: trim + huruf besar; kosong → ''. */
export function norm(v: string | null | undefined): string {
  return (v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

const isSudah = (v: string | null | undefined) => norm(v) === SUDAH;

// ---------------------------------------------------------------------
// 1. Tanggal batch
// ---------------------------------------------------------------------

/**
 * Ambil tanggal dari 6 digit terakhir no_batch (format DDMMYY).
 * "SKD 130426" → 13 April 2026. Mengembalikan null bila tidak valid.
 */
export function parseBatchDate(noBatch: string | null | undefined): Date | null {
  const m = /(\d{2})(\d{2})(\d{2})\D*$/.exec((noBatch ?? '').trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = 2000 + Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const d = new Date(year, month - 1, day);
  // tolak tanggal yang "meluber", mis. 310226 → 3 Maret
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

/** Format DD/MM/YYYY. */
export function formatDate(d: Date | null): string {
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function batchDateLabel(noBatch: string | null | undefined): string {
  return formatDate(parseBatchDate(noBatch));
}

// ---------------------------------------------------------------------
// 2. STATUS DESAIN
// ---------------------------------------------------------------------

export const DESAIN_SUDAH_ADA = 'SUDAH ADA';
export const DESAIN_BELUM_ADA = 'BELUM ADA';

export function statusDesain(item: RuleInput): string {
  const manual = norm(item.status_desain_manual);
  if (manual) return manual;
  if (
    (item.file_kemasan ?? '').trim() !== '' ||
    isSudah(item.selesai) ||
    norm(item.kebutuhan) === 'TIDAK PERLU'
  ) {
    return DESAIN_SUDAH_ADA;
  }
  return DESAIN_BELUM_ADA;
}

// ---------------------------------------------------------------------
// 3. STATUS (status kemasan)
// ---------------------------------------------------------------------

export function statusKemasan(item: RuleInput): string {
  const kebutuhan = norm(item.kebutuhan);
  if (isSudah(item.selesai)) return 'SELESAI';
  if (!kebutuhan) return 'BELUM DITENTUKAN';
  if (kebutuhan === 'TIDAK PERLU') return 'AMAN';
  if (!isSudah(item.cek_kemasan)) return 'CEK KEMASAN DANAMON';
  if (norm(item.kemasan) === 'PERLU CETAK') return 'PROSES CETAK';
  return `PROSES ${kebutuhan}`;
}

// ---------------------------------------------------------------------
// 4. LANGKAH BERIKUTNYA
// ---------------------------------------------------------------------

export const STEP = {
  SERAHKAN_KODING: 'SERAHKAN KE KODING',
  TUNGGU_KODING: 'TUNGGU KODING',
  SIAP_PRODUKSI: 'SIAP DISERAHKAN KE PRODUKSI',
  TUNGGU_SAMPEL: 'TUNGGU SAMPEL DARI PRODUKSI',
  BUAT_DESAIN: 'BUAT DESAIN DULU',
  SELESAI: 'SELESAI',
} as const;

export type Step = (typeof STEP)[keyof typeof STEP];

/** Urutan tahap untuk pengurutan default tabel. */
export const STEP_ORDER: Step[] = [
  STEP.SERAHKAN_KODING,
  STEP.TUNGGU_KODING,
  STEP.SIAP_PRODUKSI,
  STEP.TUNGGU_SAMPEL,
  STEP.BUAT_DESAIN,
  STEP.SELESAI,
];

export function langkahBerikutnya(item: RuleInput): Step {
  if (norm(item.status_sampel) === 'SAMPEL JADI') return STEP.SELESAI;
  if (isSudah(item.diserahkan_ke_produksi)) return STEP.TUNGGU_SAMPEL;
  if (statusDesain(item) !== DESAIN_SUDAH_ADA) return STEP.BUAT_DESAIN;
  if (isSudah(item.koding_kemasan)) return STEP.SIAP_PRODUKSI;
  if (isSudah(item.diserahkan_ke_koding)) return STEP.TUNGGU_KODING;
  return STEP.SERAHKAN_KODING;
}

// ---------------------------------------------------------------------
// 5. Urutan default
// ---------------------------------------------------------------------

const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });

export function compareItems(a: RuleInput, b: RuleInput): number {
  const sa = STEP_ORDER.indexOf(langkahBerikutnya(a));
  const sb = STEP_ORDER.indexOf(langkahBerikutnya(b));
  if (sa !== sb) return sa - sb;
  const n = collator.compare(norm(a.nama_produk), norm(b.nama_produk));
  if (n !== 0) return n;
  return collator.compare(norm(a.no_batch), norm(b.no_batch));
}

export function sortItems<T extends RuleInput>(items: T[]): T[] {
  return [...items].sort(compareItems);
}

// ---------------------------------------------------------------------
// Turunan untuk tampilan
// ---------------------------------------------------------------------

export interface Derived {
  tanggalBatch: string;
  statusDesain: string;
  status: string;
  langkah: Step;
}

export function derive(item: RuleInput): Derived {
  return {
    tanggalBatch: batchDateLabel(item.no_batch),
    statusDesain: statusDesain(item),
    status: statusKemasan(item),
    langkah: langkahBerikutnya(item),
  };
}

/** Kategori kebutuhan untuk rekap (kosong → BELUM DITENTUKAN). */
export const REKAP_KEBUTUHAN = [
  'BUAT BARU',
  'GANTI CODING',
  'GANTI KEMASAN',
  'PERBAIKI DESAIN',
  'TIDAK PERLU',
  'BELUM DITENTUKAN',
] as const;

export function kebutuhanKategori(item: RuleInput): string {
  return norm(item.kebutuhan) || 'BELUM DITENTUKAN';
}
