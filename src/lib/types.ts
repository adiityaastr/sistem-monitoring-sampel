export type Brand = 'EPI' | 'AZH';
export const BRANDS: Brand[] = ['EPI', 'AZH'];

export interface Project {
  id: string;
  nama: string;
  link_folder_desain: string | null;
  full_cetak: string;
  project_selesai: string;
  created_at?: string;
  updated_by?: string | null;
  updated_at?: string;
}

export interface Item {
  id: string;
  project_id: string;
  brand: Brand;
  nama_produk: string;
  gramasi: string | null;
  no_batch: string | null;
  sediaan: string | null;
  kebutuhan: string | null;
  cek_kemasan: string | null;
  status_desain_manual: string | null;
  file_kemasan: string | null;
  kemasan: string | null;
  kelompok_koding: string | null;
  diserahkan_ke_koding: string | null;
  koding_kemasan: string | null;
  diserahkan_ke_produksi: string | null;
  /** tanggal diserahkan ke produksi */
  tanggal_diserahkan: string | null;
  /** tanggal diserahkan ke koding */
  tanggal_diserahkan_koding: string | null;
  /** tanggal hasil koding diterima dari tim koding */
  tanggal_terima_koding: string | null;
  /** tanggal sampel diterima dari produksi */
  tanggal_terima_produksi: string | null;
  status_sampel: string | null;
  selesai: string | null;
  catatan: string | null;
  catatan_sampel: string | null;
  updated_by?: string | null;
  updated_at?: string;
}

/** Kolom item yang boleh diisi user (tanpa id & audit). */
export type ItemInput = Omit<Item, 'id' | 'updated_by' | 'updated_at'>;

export interface SampleMissing {
  id: string;
  brand: Brand;
  nama_produk: string;
  gramasi: string | null;
  no_batch: string | null;
  sediaan: string | null;
  cek_kemasan: string | null;
  kemasan: string | null;
  selesai: string | null;
  updated_by?: string | null;
  updated_at?: string;
}

export type OptionKategori = 'status' | 'sediaan' | 'kebutuhan' | 'kemasan' | 'status_sampel';

export interface MasterOption {
  id: string;
  kategori: OptionKategori;
  nilai: string;
  urutan: number;
  aktif: boolean;
}

export interface TeamMember {
  id: string;
  email: string;
  nama: string | null;
  role: 'admin' | 'member';
  aktif: boolean;
}
