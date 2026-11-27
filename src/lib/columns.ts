import type { Item, OptionKategori } from './types';
import { derive, type Derived } from './rules';

export type ColType = 'text' | 'select' | 'link' | 'date' | 'computed' | 'desain' | 'kelompok';

export interface ItemColumn {
  key: string;
  label: string;
  /** tahap proses, untuk header berkelompok */
  group: string;
  type: ColType;
  field?: keyof Item;
  kategori?: OptionKategori;
  /** lebar minimum sel (kelas Tailwind) */
  width?: string;
}

/**
 * Urutan kolom mengikuti proses. Dipakai bersama oleh tabel, filter,
 * bulk edit, dan ekspor Excel agar urutannya selalu sama.
 */
export const ITEM_COLUMNS: ItemColumn[] = [
  { key: 'nama_produk', label: 'Nama Produk', group: 'Identitas', type: 'text', field: 'nama_produk', width: 'min-w-[200px]' },
  { key: 'gramasi', label: 'Gramasi', group: 'Identitas', type: 'text', field: 'gramasi', width: 'min-w-[90px]' },
  { key: 'no_batch', label: 'No Batch', group: 'Identitas', type: 'text', field: 'no_batch', width: 'min-w-[120px]' },
  { key: 'tanggal_batch', label: 'Tgl Batch', group: 'Identitas', type: 'computed', width: 'min-w-[96px]' },
  { key: 'sediaan', label: 'Sediaan', group: 'Identitas', type: 'select', field: 'sediaan', kategori: 'sediaan', width: 'min-w-[130px]' },
  { key: 'kebutuhan', label: 'Kebutuhan', group: 'Kebutuhan', type: 'select', field: 'kebutuhan', kategori: 'kebutuhan', width: 'min-w-[150px]' },
  { key: 'cek_kemasan', label: 'Cek Kemasan', group: 'Kebutuhan', type: 'select', field: 'cek_kemasan', kategori: 'status', width: 'min-w-[110px]' },
  { key: 'status_desain', label: 'Status Desain', group: 'Desain', type: 'desain', field: 'status_desain_manual', width: 'min-w-[130px]' },
  { key: 'file_kemasan', label: 'File Kemasan', group: 'Desain', type: 'link', field: 'file_kemasan', width: 'min-w-[150px]' },
  { key: 'kemasan', label: 'Kemasan', group: 'Kemasan', type: 'select', field: 'kemasan', kategori: 'kemasan', width: 'min-w-[140px]' },
  { key: 'kelompok_koding', label: 'Kelompok Koding', group: 'Koding', type: 'kelompok', field: 'kelompok_koding', width: 'min-w-[110px]' },
  { key: 'diserahkan_ke_koding', label: 'Diserahkan ke Koding', group: 'Koding', type: 'select', field: 'diserahkan_ke_koding', kategori: 'status', width: 'min-w-[110px]' },
  { key: 'tanggal_diserahkan_koding', label: 'Tgl Serah ke Koding', group: 'Koding', type: 'date', field: 'tanggal_diserahkan_koding', width: 'min-w-[130px]' },
  { key: 'koding_kemasan', label: 'Koding Kemasan', group: 'Koding', type: 'select', field: 'koding_kemasan', kategori: 'status', width: 'min-w-[110px]' },
  { key: 'tanggal_terima_koding', label: 'Tgl Terima dari Koding', group: 'Koding', type: 'date', field: 'tanggal_terima_koding', width: 'min-w-[130px]' },
  { key: 'diserahkan_ke_produksi', label: 'Diserahkan ke Produksi', group: 'Produksi', type: 'select', field: 'diserahkan_ke_produksi', kategori: 'status', width: 'min-w-[110px]' },
  { key: 'tanggal_diserahkan', label: 'Tgl Serah ke Produksi', group: 'Produksi', type: 'date', field: 'tanggal_diserahkan', width: 'min-w-[130px]' },
  { key: 'status_sampel', label: 'Status Sampel', group: 'Produksi', type: 'select', field: 'status_sampel', kategori: 'status_sampel', width: 'min-w-[140px]' },
  { key: 'tanggal_terima_produksi', label: 'Tgl Terima dari Produksi', group: 'Produksi', type: 'date', field: 'tanggal_terima_produksi', width: 'min-w-[130px]' },
  { key: 'selesai', label: 'Selesai', group: 'Selesai', type: 'select', field: 'selesai', kategori: 'status', width: 'min-w-[100px]' },
  { key: 'status', label: 'Status', group: 'Ringkasan', type: 'computed', width: 'min-w-[170px]' },
  { key: 'langkah', label: 'Langkah Berikutnya', group: 'Ringkasan', type: 'computed', width: 'min-w-[200px]' },
  { key: 'catatan', label: 'Catatan', group: 'Catatan', type: 'text', field: 'catatan', width: 'min-w-[180px]' },
  { key: 'catatan_sampel', label: 'Catatan Sampel', group: 'Catatan', type: 'text', field: 'catatan_sampel', width: 'min-w-[180px]' },
];

/** Kolom yang bisa diubah sekaligus lewat bulk edit. */
export const BULK_COLUMNS = ITEM_COLUMNS.filter((c) => c.field && c.key !== 'nama_produk' && c.key !== 'no_batch');

export const DESAIN_OPTIONS = ['SUDAH ADA', 'BELUM ADA'];

/** Nilai teks sebuah sel (untuk filter, pencarian & ekspor). */
export function cellText(col: ItemColumn, item: Item, d: Derived = derive(item)): string {
  switch (col.key) {
    case 'tanggal_batch':
      return d.tanggalBatch;
    case 'status_desain':
      return d.statusDesain;
    case 'status':
      return d.status;
    case 'langkah':
      return d.langkah;
    default:
      if (col.type === 'date' && col.field) return formatIsoDate(item[col.field] as string | null);
      return col.field ? String(item[col.field] ?? '') : '';
  }
}

/** "2026-04-13" → "13/04/2026" */
export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
