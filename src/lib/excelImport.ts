/**
 * Impor dari file Excel lama (Google Sheet yang diunduh sebagai .xlsx).
 *
 * Struktur yang dikenali:
 * - Sheet "PROJECT_SISIPAN_x": satu project. Berisi blok EPI dan AZH.
 *   Tiap blok diawali baris penanda (sel "EPI" / "AZH"), lalu baris
 *   header (mengandung "NAMA PRODUK" dan "BATCH"), lalu baris data.
 *   Bila header punya kolom "BRAND", nilai itu yang dipakai.
 *   Label "LINK FOLDER", "FULL CETAK", "PROJECT SELESAI" dibaca dari
 *   sel di kanannya.
 * - Sheet "SAMPLE_YANG_BELUM_ADA": daftar sampel yang belum ada.
 *
 * Kolom hasil hitungan (STATUS, LANGKAH BERIKUTNYA, TGL BATCH, STATUS
 * DESAIN) diabaikan karena dihitung ulang di aplikasi.
 */
import type { Brand, ItemInput, SampleMissing } from './types';
import { norm } from './rules';

export interface Cell {
  v: unknown;
  /** target hyperlink bila sel berisi link */
  link?: string;
}
export type Grid = Cell[][];

export type ItemRow = Omit<ItemInput, 'project_id'>;
export type SampleRow = Omit<SampleMissing, 'id'>;

export interface ParsedProject {
  sheet: string;
  nama: string;
  link_folder_desain: string | null;
  full_cetak: string | null;
  project_selesai: string | null;
  items: ItemRow[];
  warnings: string[];
}

export interface ParsedWorkbook {
  projects: ParsedProject[];
  samples: SampleRow[];
  sampleWarnings: string[];
  ignoredSheets: string[];
}

// ------------------------------------------------------------- headers

type Field = keyof ItemRow | 'brand';

const HEADER_ALIASES: Record<string, Field> = {
  'BRAND': 'brand',
  'NAMA PRODUK': 'nama_produk',
  'PRODUK': 'nama_produk',
  'NAMA': 'nama_produk',
  'GRAMASI': 'gramasi',
  'NO BATCH': 'no_batch',
  'NOMOR BATCH': 'no_batch',
  'BATCH': 'no_batch',
  'SEDIAAN': 'sediaan',
  'KEBUTUHAN': 'kebutuhan',
  'CEK KEMASAN': 'cek_kemasan',
  'CEK KEMASAN DANAMON': 'cek_kemasan',
  'FILE KEMASAN': 'file_kemasan',
  'LINK FILE': 'file_kemasan',
  'LINK FILE KEMASAN': 'file_kemasan',
  'LINK KEMASAN': 'file_kemasan',
  'KEMASAN': 'kemasan',
  'KELOMPOK KODING': 'kelompok_koding',
  'KELOMPOK': 'kelompok_koding',
  'DISERAHKAN KE KODING': 'diserahkan_ke_koding',
  'KODING KEMASAN': 'koding_kemasan',
  'DISERAHKAN KE PRODUKSI': 'diserahkan_ke_produksi',
  'TANGGAL DISERAHKAN': 'tanggal_diserahkan',
  'TGL DISERAHKAN': 'tanggal_diserahkan',
  'TANGGAL': 'tanggal_diserahkan',
  'STATUS SAMPEL': 'status_sampel',
  'SELESAI': 'selesai',
  'CATATAN': 'catatan',
  'KETERANGAN': 'catatan',
  'CATATAN SAMPEL': 'catatan_sampel',
};

/** Field yang nilainya pilihan (disimpan huruf besar). */
const UPPER_FIELDS = new Set<Field>([
  'brand', 'no_batch', 'sediaan', 'kebutuhan', 'cek_kemasan', 'kemasan', 'kelompok_koding',
  'diserahkan_ke_koding', 'koding_kemasan', 'diserahkan_ke_produksi', 'status_sampel', 'selesai',
]);

const LINK_FIELDS = new Set<Field>(['file_kemasan']);

function headerKey(v: unknown): string {
  return norm(String(v ?? '').replace(/[^A-Za-z0-9 ]+/g, ' '));
}

function isBlankRow(row: Cell[] | undefined): boolean {
  return !row || row.every((c) => text(c) === '');
}

function text(c: Cell | undefined): string {
  if (!c || c.v === null || c.v === undefined) return '';
  if (c.v instanceof Date) return toIsoDate(c.v) ?? '';
  return String(c.v).trim();
}

function brandMarker(row: Cell[]): Brand | null {
  const filled = row.map(text).filter(Boolean);
  if (filled.length === 0 || filled.length > 2) return null;
  for (const t of filled) {
    const m = /\b(EPI|AZH)\b/.exec(norm(t));
    if (m) return m[1] as Brand;
  }
  return null;
}

/** Peta indeks kolom → field bila baris ini adalah header. */
function headerMap(row: Cell[]): Map<number, Field> | null {
  const map = new Map<number, Field>();
  row.forEach((c, i) => {
    const field = HEADER_ALIASES[headerKey(c.v)];
    if (field && ![...map.values()].includes(field)) map.set(i, field);
  });
  const fields = [...map.values()];
  return fields.includes('nama_produk') && fields.includes('no_batch') ? map : null;
}

// --------------------------------------------------------------- dates

export function toIsoDate(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Date | nomor seri Excel | "dd/mm/yyyy" | "yyyy-mm-dd" → "yyyy-mm-dd" */
export function parseDateValue(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return toIsoDate(v);
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return toIsoDate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = String(v).trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    return d.getDate() === Number(m[1]) ? toIsoDate(d) : null;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

// -------------------------------------------------------------- blocks

interface RawRecord {
  values: Partial<Record<Field, string | null>>;
  rowNumber: number;
}

/** Baca semua blok tabel di sebuah grid. */
function readBlocks(grid: Grid, warnings: string[]): { brand: Brand | null; rec: RawRecord }[] {
  const out: { brand: Brand | null; rec: RawRecord }[] = [];
  let brand: Brand | null = null;
  let header: Map<number, Field> | null = null;

  grid.forEach((row, r) => {
    if (isBlankRow(row)) return;
    const marker = brandMarker(row);
    if (marker) {
      brand = marker;
      header = null;
      return;
    }
    const h = headerMap(row);
    if (h) {
      header = h;
      return;
    }
    if (!header) return;

    const values: Partial<Record<Field, string | null>> = {};
    for (const [i, field] of header) {
      const cell = row[i];
      let val: string | null;
      if (field === 'tanggal_diserahkan') {
        val = parseDateValue(cell?.v);
        if (!val && text(cell)) warnings.push(`Baris ${r + 1}: tanggal "${text(cell)}" tidak dikenali, dikosongkan.`);
      } else if (LINK_FIELDS.has(field)) {
        val = cell?.link || text(cell) || null;
      } else {
        val = text(cell) || null;
        if (val && UPPER_FIELDS.has(field)) val = norm(val);
      }
      values[field] = val;
    }
    if (!values.nama_produk) return;
    out.push({ brand, rec: { values, rowNumber: r + 1 } });
  });
  return out;
}

function resolveBrand(blockBrand: Brand | null, values: Partial<Record<Field, string | null>>): Brand | null {
  const b = norm(values.brand);
  if (b === 'EPI' || b === 'AZH') return b;
  return blockBrand;
}

// ----------------------------------------------------- project sheets

export function projectNameFromSheet(sheet: string): string {
  return norm(sheet.replace(/^PROJECT[\s_-]*/i, '').replace(/[_-]+/g, ' '));
}

function findMeta(grid: Grid, labels: string[]): Cell | null {
  for (const row of grid) {
    for (let i = 0; i < row.length; i++) {
      if (labels.includes(headerKey(row[i]?.v))) {
        for (let j = i + 1; j < row.length; j++) if (text(row[j])) return row[j];
        return null;
      }
    }
  }
  return null;
}

export function parseProjectGrid(sheet: string, grid: Grid): ParsedProject {
  const warnings: string[] = [];
  const items: ItemRow[] = [];

  for (const { brand: blockBrand, rec } of readBlocks(grid, warnings)) {
    const brand = resolveBrand(blockBrand, rec.values);
    if (!brand) {
      warnings.push(`Baris ${rec.rowNumber}: brand tidak diketahui (tidak di bawah blok EPI/AZH), dilewati.`);
      continue;
    }
    const v = rec.values;
    items.push({
      brand,
      nama_produk: v.nama_produk!,
      gramasi: v.gramasi ?? null,
      no_batch: v.no_batch ?? null,
      sediaan: v.sediaan ?? null,
      kebutuhan: v.kebutuhan ?? null,
      cek_kemasan: v.cek_kemasan ?? 'BELUM',
      status_desain_manual: null,
      file_kemasan: v.file_kemasan ?? null,
      kemasan: v.kemasan ?? null,
      kelompok_koding: v.kelompok_koding ?? null,
      diserahkan_ke_koding: v.diserahkan_ke_koding ?? 'BELUM',
      koding_kemasan: v.koding_kemasan ?? 'BELUM',
      diserahkan_ke_produksi: v.diserahkan_ke_produksi ?? 'BELUM',
      tanggal_diserahkan: v.tanggal_diserahkan ?? null,
      status_sampel: v.status_sampel ?? null,
      selesai: v.selesai ?? 'BELUM',
      catatan: v.catatan ?? null,
      catatan_sampel: v.catatan_sampel ?? null,
    });
  }

  const link = findMeta(grid, ['LINK FOLDER', 'LINK FOLDER DESAIN', 'FOLDER DESAIN']);
  const full = findMeta(grid, ['FULL CETAK']);
  const done = findMeta(grid, ['PROJECT SELESAI']);

  return {
    sheet,
    nama: projectNameFromSheet(sheet),
    link_folder_desain: link ? link.link || text(link) || null : null,
    full_cetak: full ? norm(text(full)) || null : null,
    project_selesai: done ? norm(text(done)) || null : null,
    items,
    warnings,
  };
}

export function parseSampleGrid(grid: Grid): { samples: SampleRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const samples: SampleRow[] = [];
  for (const { brand: blockBrand, rec } of readBlocks(grid, warnings)) {
    const brand = resolveBrand(blockBrand, rec.values);
    if (!brand) {
      warnings.push(`Baris ${rec.rowNumber}: brand tidak diketahui, dilewati.`);
      continue;
    }
    const v = rec.values;
    samples.push({
      brand,
      nama_produk: v.nama_produk!,
      gramasi: v.gramasi ?? null,
      no_batch: v.no_batch ?? null,
      sediaan: v.sediaan ?? null,
      cek_kemasan: v.cek_kemasan ?? 'BELUM',
      kemasan: v.kemasan ?? null,
      selesai: v.selesai ?? 'BELUM',
    });
  }
  return { samples, warnings };
}

// ---------------------------------------------------------- duplicates

/** Kunci duplikat item: project + brand + no_batch. */
export function itemKey(project: string, brand: string, noBatch: string | null | undefined, namaProduk?: string): string {
  const batch = norm(noBatch);
  // item tanpa no batch: pakai nama produk agar tetap bisa dibedakan
  return `${norm(project)}|${norm(brand)}|${batch || `#${norm(namaProduk)}`}`;
}

export function sampleKey(brand: string, namaProduk: string, noBatch: string | null | undefined): string {
  return `${norm(brand)}|${norm(namaProduk)}|${norm(noBatch)}`;
}

// ------------------------------------------------------------ workbook

export function isProjectSheet(name: string): boolean {
  return /SISIPAN/i.test(name) && !/SAMPLE|SAMPEL/i.test(name);
}

export function isSampleSheet(name: string): boolean {
  return /(SAMPLE|SAMPEL)/i.test(name) && /BELUM/i.test(name);
}

export function parseGrids(sheets: { name: string; grid: Grid }[]): ParsedWorkbook {
  const result: ParsedWorkbook = { projects: [], samples: [], sampleWarnings: [], ignoredSheets: [] };
  for (const { name, grid } of sheets) {
    if (isProjectSheet(name)) {
      result.projects.push(parseProjectGrid(name, grid));
    } else if (isSampleSheet(name)) {
      const { samples, warnings } = parseSampleGrid(grid);
      result.samples.push(...samples);
      result.sampleWarnings.push(...warnings);
    } else {
      result.ignoredSheets.push(name);
    }
  }
  return result;
}

/** Baca file .xlsx (browser) memakai SheetJS. */
export async function readWorkbookFile(file: File): Promise<ParsedWorkbook> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const sheets = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const grid: Grid = [];
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let r = range.s.r; r <= range.e.r; r++) {
        const row: Cell[] = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          row[c - range.s.c] = { v: cell ? cell.v : null, link: cell?.l?.Target };
        }
        grid.push(row);
      }
    }
    return { name, grid };
  });
  return parseGrids(sheets);
}
