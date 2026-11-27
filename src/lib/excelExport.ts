import { cellText, ITEM_COLUMNS } from './columns';
import { compareKelompok } from './koding';
import { derive, kebutuhanKategori, norm, REKAP_KEBUTUHAN, sortItems } from './rules';
import { BRANDS, type Item, type Project } from './types';

function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'export';
}

/** Ekspor satu project: sheet EPI, AZH (urutan kolom = tabel), dan REKAP. */
export async function exportProjectXlsx(project: Project, items: Item[]): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  for (const brand of BRANDS) {
    const rows = sortItems(items.filter((i) => i.brand === brand));
    const aoa: (string | Date)[][] = [['No', ...ITEM_COLUMNS.map((c) => c.label)]];
    rows.forEach((it, idx) => {
      const d = derive(it);
      aoa.push([
        String(idx + 1),
        ...ITEM_COLUMNS.map((c) => {
          const iso = c.type === 'date' && c.field ? (it[c.field] as string | null) : null;
          if (iso) {
            const [y, m, day] = iso.split('-').map(Number);
            return new Date(y, m - 1, day);
          }
          return cellText(c, it, d);
        }),
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true, dateNF: 'dd/mm/yyyy' });
    // jadikan link file kemasan bisa diklik
    const linkCol = ITEM_COLUMNS.findIndex((c) => c.key === 'file_kemasan') + 1;
    rows.forEach((it, idx) => {
      const ref = XLSX.utils.encode_cell({ r: idx + 1, c: linkCol });
      if (it.file_kemasan && /^https?:\/\//i.test(it.file_kemasan) && ws[ref]) ws[ref].l = { Target: it.file_kemasan };
    });
    ws['!cols'] = [{ wch: 4 }, ...ITEM_COLUMNS.map((c) => ({ wch: Math.max(10, c.label.length + 2, c.key === 'nama_produk' ? 30 : 0) }))];
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length, 1), c: ITEM_COLUMNS.length } }) };
    XLSX.utils.book_append_sheet(wb, ws, brand);
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rekapAoa(items)), 'REKAP');
  XLSX.writeFile(wb, `${safeFileName(project.nama)}.xlsx`);
}

function rekapAoa(items: Item[]): (string | number)[][] {
  const aoa: (string | number)[][] = [
    ['REKAP MONITORING'],
    ['Kebutuhan', 'EPI Jumlah', 'EPI Selesai', 'EPI Belum', 'AZH Jumlah', 'AZH Selesai', 'AZH Belum', 'Total Jumlah', 'Total Selesai', 'Total Belum'],
  ];
  const r = rekap(items);
  for (const k of [...REKAP_KEBUTUHAN, 'TOTAL']) {
    const row = r[k];
    aoa.push([k, row.EPI.jumlah, row.EPI.selesai, row.EPI.belum, row.AZH.jumlah, row.AZH.selesai, row.AZH.belum, row.total.jumlah, row.total.selesai, row.total.belum]);
  }
  return aoa;
}

export interface RekapCell {
  jumlah: number;
  selesai: number;
  belum: number;
}
export type RekapRow = Record<'EPI' | 'AZH' | 'total', RekapCell>;

/** Rekap per kategori kebutuhan; "selesai" = kolom Selesai bernilai SUDAH. */
export function rekap(items: Item[]): Record<string, RekapRow> {
  const empty = (): RekapRow => ({
    EPI: { jumlah: 0, selesai: 0, belum: 0 },
    AZH: { jumlah: 0, selesai: 0, belum: 0 },
    total: { jumlah: 0, selesai: 0, belum: 0 },
  });
  const out: Record<string, RekapRow> = {};
  for (const k of [...REKAP_KEBUTUHAN, 'TOTAL']) out[k] = empty();
  for (const it of items) {
    const k = kebutuhanKategori(it);
    if (!out[k]) out[k] = empty(); // kebutuhan tambahan dari master_options
    const done = norm(it.selesai) === 'SUDAH';
    for (const row of [out[k], out.TOTAL]) {
      for (const cell of [row[it.brand], row.total]) {
        cell.jumlah++;
        if (done) cell.selesai++;
        else cell.belum++;
      }
    }
  }
  return out;
}

/** Ekspor List Koding: satu sheet, dikelompokkan per kelompok. */
export async function exportKodingXlsx(projectName: string, items: Item[]): Promise<void> {
  const XLSX = await import('xlsx');
  const sorted = [...items].sort(
    (a, b) =>
      compareKelompok(a.kelompok_koding ?? '', b.kelompok_koding ?? '') ||
      norm(a.nama_produk).localeCompare(norm(b.nama_produk)) ||
      norm(a.no_batch).localeCompare(norm(b.no_batch)),
  );
  const aoa: string[][] = [
    [`LIST KODING — ${projectName}`],
    [],
    ['Kelompok', 'Brand', 'Nama Produk', 'Gramasi', 'No Batch', 'Sediaan', 'Link File Kemasan', 'Diserahkan ke Koding'],
  ];
  for (const it of sorted) {
    aoa.push([
      it.kelompok_koding ?? '',
      it.brand,
      it.nama_produk,
      it.gramasi ?? '',
      it.no_batch ?? '',
      it.sediaan ?? '',
      it.file_kemasan ?? '(BELUM ADA LINK)',
      it.diserahkan_ke_koding ?? '',
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  sorted.forEach((it, i) => {
    const ref = XLSX.utils.encode_cell({ r: i + 3, c: 6 });
    if (it.file_kemasan && /^https?:\/\//i.test(it.file_kemasan)) ws[ref].l = { Target: it.file_kemasan };
  });
  ws['!cols'] = [{ wch: 12 }, { wch: 6 }, { wch: 34 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 50 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'LIST KODING');
  XLSX.writeFile(wb, `LIST KODING ${safeFileName(projectName)}.xlsx`);
}
