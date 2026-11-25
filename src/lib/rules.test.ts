import { describe, expect, it } from 'vitest';
import {
  batchDateLabel,
  kebutuhanKategori,
  langkahBerikutnya,
  parseBatchDate,
  sortItems,
  statusDesain,
  statusKemasan,
  STEP,
  type RuleInput,
} from './rules';

describe('tanggal batch (6 digit terakhir, DDMMYY)', () => {
  it('membaca "SKD 130426" sebagai 13/04/2026', () => {
    const d = parseBatchDate('SKD 130426')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(13);
    expect(batchDateLabel('SKD 130426')).toBe('13/04/2026');
  });

  it('memakai 6 digit TERAKHIR walau ada angka lain', () => {
    expect(batchDateLabel('A12 010126')).toBe('01/01/2026');
    expect(batchDateLabel('99010126')).toBe('01/01/2026');
    expect(batchDateLabel('SKD130426')).toBe('13/04/2026');
  });

  it('mengabaikan spasi di akhir', () => {
    expect(batchDateLabel('  SKD 311225  ')).toBe('31/12/2025');
  });

  it('mengembalikan kosong untuk batch tanpa 6 digit', () => {
    expect(parseBatchDate('SKD 1304')).toBeNull();
    expect(parseBatchDate('')).toBeNull();
    expect(parseBatchDate(null)).toBeNull();
    expect(batchDateLabel(undefined)).toBe('');
  });

  it('menolak tanggal yang tidak valid', () => {
    expect(parseBatchDate('SKD 001326')).toBeNull(); // hari 0, bulan 13
    expect(parseBatchDate('SKD 311326')).toBeNull(); // bulan 13
    expect(parseBatchDate('SKD 300226')).toBeNull(); // 30 Februari
    expect(parseBatchDate('SKD 290224')).not.toBeNull(); // kabisat 2024
  });
});

describe('STATUS DESAIN', () => {
  it('memakai status_desain_manual bila terisi', () => {
    expect(statusDesain({ status_desain_manual: 'belum ada', file_kemasan: 'http://x' })).toBe('BELUM ADA');
    expect(statusDesain({ status_desain_manual: 'SUDAH ADA' })).toBe('SUDAH ADA');
  });

  it('SUDAH ADA bila file_kemasan terisi', () => {
    expect(statusDesain({ file_kemasan: 'https://drive.google.com/x' })).toBe('SUDAH ADA');
  });

  it('SUDAH ADA bila selesai = SUDAH', () => {
    expect(statusDesain({ selesai: 'SUDAH' })).toBe('SUDAH ADA');
  });

  it('SUDAH ADA bila kebutuhan = TIDAK PERLU', () => {
    expect(statusDesain({ kebutuhan: 'TIDAK PERLU' })).toBe('SUDAH ADA');
  });

  it('BELUM ADA untuk selain itu', () => {
    expect(statusDesain({})).toBe('BELUM ADA');
    expect(statusDesain({ file_kemasan: '   ', selesai: 'BELUM', kebutuhan: 'BUAT BARU' })).toBe('BELUM ADA');
    expect(statusDesain({ status_desain_manual: '  ' })).toBe('BELUM ADA');
  });
});

describe('STATUS (status kemasan)', () => {
  const base: RuleInput = { kebutuhan: 'GANTI CODING', cek_kemasan: 'SUDAH', kemasan: 'TIDAK PERLU', selesai: 'BELUM' };

  it('SELESAI bila selesai = SUDAH (prioritas pertama)', () => {
    expect(statusKemasan({ ...base, selesai: 'SUDAH', kebutuhan: '' })).toBe('SELESAI');
  });

  it('BELUM DITENTUKAN bila kebutuhan kosong', () => {
    expect(statusKemasan({ ...base, kebutuhan: null })).toBe('BELUM DITENTUKAN');
    expect(statusKemasan({ ...base, kebutuhan: '  ' })).toBe('BELUM DITENTUKAN');
  });

  it('AMAN bila kebutuhan = TIDAK PERLU', () => {
    expect(statusKemasan({ ...base, kebutuhan: 'TIDAK PERLU', cek_kemasan: 'BELUM' })).toBe('AMAN');
  });

  it('CEK KEMASAN DANAMON bila cek_kemasan bukan SUDAH', () => {
    expect(statusKemasan({ ...base, cek_kemasan: 'BELUM', kemasan: 'PERLU CETAK' })).toBe('CEK KEMASAN DANAMON');
    expect(statusKemasan({ ...base, cek_kemasan: null })).toBe('CEK KEMASAN DANAMON');
  });

  it('PROSES CETAK bila kemasan = PERLU CETAK', () => {
    expect(statusKemasan({ ...base, kemasan: 'PERLU CETAK' })).toBe('PROSES CETAK');
  });

  it('PROSES + kebutuhan untuk selain itu', () => {
    expect(statusKemasan(base)).toBe('PROSES GANTI CODING');
    expect(statusKemasan({ ...base, kebutuhan: 'buat baru', kemasan: 'SUDAH DICETAK' })).toBe('PROSES BUAT BARU');
  });
});

describe('LANGKAH BERIKUTNYA', () => {
  const ready: RuleInput = { file_kemasan: 'https://x', diserahkan_ke_koding: 'BELUM', koding_kemasan: 'BELUM', diserahkan_ke_produksi: 'BELUM' };

  it('SELESAI bila status_sampel = SAMPEL JADI (prioritas pertama)', () => {
    expect(langkahBerikutnya({ status_sampel: 'SAMPEL JADI' })).toBe(STEP.SELESAI);
  });

  it('TUNGGU SAMPEL DARI PRODUKSI bila sudah diserahkan ke produksi', () => {
    expect(langkahBerikutnya({ diserahkan_ke_produksi: 'SUDAH', status_sampel: 'PROSES PRODUKSI' })).toBe(STEP.TUNGGU_SAMPEL);
  });

  it('BUAT DESAIN DULU bila status desain bukan SUDAH ADA', () => {
    expect(langkahBerikutnya({ ...ready, file_kemasan: null, koding_kemasan: 'SUDAH' })).toBe(STEP.BUAT_DESAIN);
    expect(langkahBerikutnya({ ...ready, status_desain_manual: 'BELUM ADA' })).toBe(STEP.BUAT_DESAIN);
  });

  it('SIAP DISERAHKAN KE PRODUKSI bila koding_kemasan = SUDAH', () => {
    expect(langkahBerikutnya({ ...ready, koding_kemasan: 'SUDAH', diserahkan_ke_koding: 'SUDAH' })).toBe(STEP.SIAP_PRODUKSI);
  });

  it('TUNGGU KODING bila sudah diserahkan ke koding', () => {
    expect(langkahBerikutnya({ ...ready, diserahkan_ke_koding: 'SUDAH' })).toBe(STEP.TUNGGU_KODING);
  });

  it('SERAHKAN KE KODING untuk selain itu', () => {
    expect(langkahBerikutnya(ready)).toBe(STEP.SERAHKAN_KODING);
    expect(langkahBerikutnya({ kebutuhan: 'TIDAK PERLU' })).toBe(STEP.SERAHKAN_KODING);
  });
});

describe('urutan default tabel', () => {
  it('urut tahap, lalu nama_produk, lalu no_batch', () => {
    const items = [
      { id: 'selesai', nama_produk: 'A', no_batch: '1', status_sampel: 'SAMPEL JADI' },
      { id: 'desain', nama_produk: 'A', no_batch: '1' },
      { id: 'tunggu-sampel', nama_produk: 'A', no_batch: '1', diserahkan_ke_produksi: 'SUDAH' },
      { id: 'siap', nama_produk: 'A', no_batch: '1', file_kemasan: 'x', koding_kemasan: 'SUDAH' },
      { id: 'tunggu-koding', nama_produk: 'A', no_batch: '1', file_kemasan: 'x', diserahkan_ke_koding: 'SUDAH' },
      { id: 'serahkan-B-2', nama_produk: 'B', no_batch: 'X 020126', file_kemasan: 'x' },
      { id: 'serahkan-B-1', nama_produk: 'B', no_batch: 'X 010126', file_kemasan: 'x' },
      { id: 'serahkan-A', nama_produk: 'a', no_batch: 'Z', file_kemasan: 'x' },
    ];
    expect(sortItems(items).map((i) => i.id)).toEqual([
      'serahkan-A',
      'serahkan-B-1',
      'serahkan-B-2',
      'tunggu-koding',
      'siap',
      'tunggu-sampel',
      'desain',
      'selesai',
    ]);
  });
});

describe('kategori rekap kebutuhan', () => {
  it('kebutuhan kosong masuk BELUM DITENTUKAN', () => {
    expect(kebutuhanKategori({ kebutuhan: null })).toBe('BELUM DITENTUKAN');
    expect(kebutuhanKategori({ kebutuhan: 'ganti coding' })).toBe('GANTI CODING');
  });
});
