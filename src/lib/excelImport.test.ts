import { describe, expect, it } from 'vitest';
import { itemKey, parseDateValue, parseGrids, projectNameFromSheet, type Grid } from './excelImport';
import { rekap } from './excelExport';
import type { Item } from './types';

const g = (rows: unknown[][]): Grid => rows.map((r) => r.map((v) => ({ v })));

describe('impor Excel', () => {
  it('nama project dari nama sheet', () => {
    expect(projectNameFromSheet('PROJECT_SISIPAN_13')).toBe('SISIPAN 13');
  });

  it('membaca blok EPI dan AZH, meta project, dan mengabaikan kolom hitungan', () => {
    const grid = g([
      ['LINK FOLDER', 'https://drive/folder'],
      ['FULL CETAK', 'belum', '', 'PROJECT SELESAI', 'BELUM'],
      [],
      ['EPI'],
      ['NO', 'NAMA PRODUK', 'GRAMASI', 'NO BATCH', 'SEDIAAN', 'KEBUTUHAN', 'STATUS', 'TANGGAL DISERAHKAN'],
      [1, 'MADU ANAK', '150 ML', 'mha 130426', 'col', 'GANTI CODING', 'PROSES X', '13/04/2026'],
      [2, 'KAPSUL A', '60', 'KA 010526', 'KAPSUL', '', '', ''],
      [],
      ['AZH'],
      ['NO', 'NAMA PRODUK', 'GRAMASI', 'NO BATCH', 'SEDIAAN'],
      [1, 'SALEP', '15 G', 'SKD 130426', 'SEMI SOLID'],
    ]);
    const res = parseGrids([
      { name: 'PROJECT_SISIPAN_13', grid },
      { name: 'Catatan', grid: [] },
    ]);
    expect(res.ignoredSheets).toEqual(['Catatan']);
    const p = res.projects[0];
    expect(p.nama).toBe('SISIPAN 13');
    expect(p.link_folder_desain).toBe('https://drive/folder');
    expect(p.full_cetak).toBe('BELUM');
    expect(p.items.map((i) => [i.brand, i.nama_produk, i.no_batch])).toEqual([
      ['EPI', 'MADU ANAK', 'MHA 130426'],
      ['EPI', 'KAPSUL A', 'KA 010526'],
      ['AZH', 'SALEP', 'SKD 130426'],
    ]);
    expect(p.items[0].sediaan).toBe('COL');
    expect(p.items[0].tanggal_diserahkan).toBe('2026-04-13');
    expect(p.items[1].kebutuhan).toBeNull();
  });

  it('membaca sheet sampel yang belum ada dengan kolom BRAND', () => {
    const res = parseGrids([
      {
        name: 'SAMPLE_YANG_BELUM_ADA',
        grid: g([
          ['BRAND', 'NAMA PRODUK', 'NO BATCH', 'SELESAI'],
          ['AZH', 'TEH', 'T 010126', 'sudah'],
          ['XYZ', 'LAIN', 'L 1', ''],
        ]),
      },
    ]);
    expect(res.samples).toHaveLength(1);
    expect(res.samples[0]).toMatchObject({ brand: 'AZH', nama_produk: 'TEH', selesai: 'SUDAH' });
    expect(res.sampleWarnings).toHaveLength(1);
  });

  it('kunci duplikat project + brand + no_batch tidak peka huruf/spasi', () => {
    expect(itemKey('Sisipan 13', 'epi', ' skd  130426 ')).toBe(itemKey('SISIPAN 13', 'EPI', 'SKD 130426'));
  });

  it('parse tanggal dari berbagai format', () => {
    expect(parseDateValue(46125)).toBe('2026-04-13');
    expect(parseDateValue('2026-04-13')).toBe('2026-04-13');
    expect(parseDateValue('31/02/2026')).toBeNull();
    expect(parseDateValue('')).toBeNull();
  });
});

describe('rekap monitoring', () => {
  it('menghitung jumlah, selesai, belum per kebutuhan dan brand', () => {
    const it = (brand: 'EPI' | 'AZH', kebutuhan: string | null, selesai: string) => ({ brand, kebutuhan, selesai }) as Item;
    const r = rekap([it('EPI', 'BUAT BARU', 'SUDAH'), it('EPI', 'BUAT BARU', 'BELUM'), it('AZH', null, 'BELUM')]);
    expect(r['BUAT BARU'].EPI).toEqual({ jumlah: 2, selesai: 1, belum: 1 });
    expect(r['BELUM DITENTUKAN'].AZH).toEqual({ jumlah: 1, selesai: 0, belum: 1 });
    expect(r.TOTAL.total).toEqual({ jumlah: 3, selesai: 1, belum: 2 });
  });
});
