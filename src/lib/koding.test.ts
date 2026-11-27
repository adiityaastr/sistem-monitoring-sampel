import { describe, expect, it } from 'vitest';
import { autoGroupKoding, compareKelompok, kelompokNumber, maxKelompokNumber, type KodingItem, kelompokOptions } from './koding';

let seq = 0;
/** Item yang siap "SERAHKAN KE KODING" (punya file kemasan). */
function ready(nama: string, batch = `B${++seq}`, extra: Partial<KodingItem> = {}): KodingItem {
  return { id: `${nama}-${batch}`, nama_produk: nama, no_batch: batch, file_kemasan: 'https://x', ...extra };
}

/** Bikin n batch untuk satu produk. */
function batches(nama: string, n: number): KodingItem[] {
  return Array.from({ length: n }, (_, i) => ready(nama, `${nama}-${String(i + 1).padStart(2, '0')}`));
}

function groupsOf(items: KodingItem[]) {
  const { assignments, oversized } = autoGroupKoding(items);
  const groups = new Map<string, string[]>();
  for (const it of items) {
    const label = assignments.get(it.id);
    if (!label) continue;
    groups.set(label, [...(groups.get(label) ?? []), it.id]);
  }
  return { groups, assignments, oversized };
}

describe('kelompokNumber / compareKelompok', () => {
  it('membaca nomor kelompok', () => {
    expect(kelompokNumber('KODING 3')).toBe(3);
    expect(kelompokNumber(' koding 12 ')).toBe(12);
    expect(kelompokNumber('LAINNYA')).toBeNull();
    expect(kelompokNumber(null)).toBeNull();
  });

  it('mengurutkan KODING 2 sebelum KODING 10', () => {
    expect(['KODING 10', 'KODING 2', 'X', 'KODING 1'].sort(compareKelompok)).toEqual(['KODING 1', 'KODING 2', 'KODING 10', 'X']);
  });

  it('nomor terbesar yang ada', () => {
    expect(maxKelompokNumber([{ kelompok_koding: 'KODING 4' }, { kelompok_koding: null }, { kelompok_koding: 'KODING 7' }])).toBe(7);
    expect(maxKelompokNumber([])).toBe(0);
  });
});

describe('autoGroupKoding', () => {
  it('maksimal 10 item per kelompok', () => {
    const items = Array.from({ length: 23 }, (_, i) => ready(`PRODUK ${String(i).padStart(2, '0')}`, 'X'));
    const { groups, oversized } = groupsOf(items);
    expect([...groups.keys()]).toEqual(['KODING 1', 'KODING 2', 'KODING 3']);
    expect([...groups.values()].map((g) => g.length)).toEqual([10, 10, 3]);
    expect(oversized).toEqual([]);
  });

  it('semua batch satu produk selalu di kelompok yang sama, walau kelompok jadi < 10', () => {
    // A: 6 batch, B: 6 batch → B tidak muat di KODING 1 (6+6 > 10)
    const items = [...batches('A', 6), ...batches('B', 6), ...batches('C', 3)];
    const { groups } = groupsOf(items);
    expect(groups.get('KODING 1')).toHaveLength(6);
    expect(groups.get('KODING 2')).toHaveLength(9); // B (6) + C (3)
    for (const nama of ['A', 'B', 'C']) {
      const labels = new Set(items.filter((i) => i.nama_produk === nama).map((i) => groupsOf(items).assignments.get(i.id)));
      expect(labels.size).toBe(1);
    }
  });

  it('nama produk dibandingkan tanpa beda huruf besar/kecil & spasi', () => {
    const items = [...batches('A', 9), ready('madu  anak'), ready('MADU ANAK')];
    const { assignments } = groupsOf(items);
    expect(assignments.get(items[9].id)).toBe(assignments.get(items[10].id));
    expect(assignments.get(items[9].id)).toBe('KODING 2');
  });

  it('melanjutkan nomor kelompok yang sudah ada', () => {
    const items = [
      ready('LAMA', 'L1', { kelompok_koding: 'KODING 4', diserahkan_ke_koding: 'SUDAH' }),
      ready('BARU', 'N1'),
    ];
    const { assignments } = groupsOf(items);
    expect(assignments.get('BARU-N1')).toBe('KODING 5');
    expect(assignments.has('LAMA-L1')).toBe(false);
  });

  it('hanya mengelompokkan item dengan tahap SERAHKAN KE KODING yang belum punya kelompok', () => {
    const items = [
      ready('A', 'A1'),
      { id: 'desain', nama_produk: 'D', no_batch: 'D1' }, // BUAT DESAIN DULU
      ready('T', 'T1', { diserahkan_ke_koding: 'SUDAH' }), // TUNGGU KODING
      ready('S', 'S1', { status_sampel: 'SAMPEL JADI' }), // SELESAI
      ready('G', 'G1', { kelompok_koding: 'KODING 1' }), // sudah berkelompok
    ];
    const { assignments } = groupsOf(items);
    expect([...assignments.keys()]).toEqual(['A-A1']);
    expect(assignments.get('A-A1')).toBe('KODING 2');
  });

  it('batch baru ikut kelompok produk yang sama yang masih menunggu diserahkan', () => {
    const items = [ready('A', 'A1', { kelompok_koding: 'KODING 2' }), ready('A', 'A2'), ready('B', 'B1')];
    const { assignments } = groupsOf(items);
    expect(assignments.get('A-A2')).toBe('KODING 2');
    expect(assignments.get('B-B1')).toBe('KODING 3');
  });

  it('produk dengan > 10 batch mendapat satu kelompok sendiri dan dilaporkan', () => {
    const items = [...batches('A', 2), ...batches('B', 12), ...batches('C', 2)];
    const { groups, oversized } = groupsOf(items);
    expect(groups.get('KODING 1')).toHaveLength(2);
    expect(groups.get('KODING 2')).toHaveLength(12);
    expect(groups.get('KODING 3')).toHaveLength(2);
    expect(oversized).toEqual(['KODING 2']);
  });

  it('tidak membuat kelompok bila tidak ada item yang perlu', () => {
    expect(autoGroupKoding([]).assignments.size).toBe(0);
  });
});

describe('kelompokOptions', () => {
  it('hanya mengambil label baku, urut angka, dan menyiapkan nomor berikutnya', () => {
    const items = [
      { kelompok_koding: 'KODING 2' },
      { kelompok_koding: 'koding 10' },
      { kelompok_koding: 'GANTI KODING 1' },
      { kelompok_koding: null },
      { kelompok_koding: 'KODING 2' },
    ];
    expect(kelompokOptions(items)).toEqual({ labels: ['KODING 2', 'KODING 10'], next: 'KODING 11' });
  });

  it('project tanpa kelompok mulai dari KODING 1', () => {
    expect(kelompokOptions([{ kelompok_koding: null }])).toEqual({ labels: [], next: 'KODING 1' });
  });
});
