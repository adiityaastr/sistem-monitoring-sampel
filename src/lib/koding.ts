import { langkahBerikutnya, norm, STEP, type RuleInput } from './rules';

export const MAX_PER_KELOMPOK = 10;
export const KODING_PREFIX = 'KODING';

export interface KodingItem extends RuleInput {
  id: string;
  nama_produk: string;
  kelompok_koding?: string | null;
}

/** "KODING 3" → 3; selain format itu → null. */
export function kelompokNumber(label: string | null | undefined): number | null {
  const m = /^KODING\s*(\d+)$/.exec(norm(label));
  return m ? Number(m[1]) : null;
}

export function kelompokLabel(n: number): string {
  return `${KODING_PREFIX} ${n}`;
}

export function maxKelompokNumber(items: { kelompok_koding?: string | null }[]): number {
  return items.reduce((max, it) => Math.max(max, kelompokNumber(it.kelompok_koding) ?? 0), 0);
}

export interface GroupingResult {
  /** id item → label kelompok baru */
  assignments: Map<string, string>;
  /** kelompok yang terpaksa > 10 item (satu produk punya banyak batch) */
  oversized: string[];
}

const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });

/**
 * Kelompokkan otomatis item yang tahapnya SERAHKAN KE KODING dan belum
 * punya kelompok.
 *
 * - Maksimal 10 item per kelompok.
 * - Semua batch dengan nama_produk yang sama selalu di kelompok yang sama
 *   (kelompok boleh kurang dari 10). Bila satu produk punya > 10 batch,
 *   produk itu mendapat kelompok sendiri (dilaporkan di `oversized`).
 * - Bila produk itu sudah punya kelompok di antara item yang masih
 *   menunggu diserahkan ke koding, batch baru ikut ke kelompok tersebut.
 * - Nomor kelompok melanjutkan nomor terbesar yang sudah ada.
 *
 * `allItems` = seluruh item di project (untuk mencari nomor terakhir).
 */
export function autoGroupKoding(allItems: KodingItem[]): GroupingResult {
  const assignments = new Map<string, string>();
  const oversized: string[] = [];

  const pending = allItems.filter((it) => langkahBerikutnya(it) === STEP.SERAHKAN_KODING);

  // kelompok yang sudah dipakai produk (hanya dari item yang belum diserahkan)
  const existingByProduct = new Map<string, string>();
  for (const it of pending) {
    const label = (it.kelompok_koding ?? '').trim();
    if (label && !existingByProduct.has(norm(it.nama_produk))) {
      existingByProduct.set(norm(it.nama_produk), norm(label));
    }
  }

  const ungrouped = pending.filter((it) => !(it.kelompok_koding ?? '').trim());

  // produk → batch-batchnya, urut nama produk lalu no batch
  const byProduct = new Map<string, KodingItem[]>();
  for (const it of ungrouped) {
    const key = norm(it.nama_produk);
    const list = byProduct.get(key);
    if (list) list.push(it);
    else byProduct.set(key, [it]);
  }

  const products = [...byProduct.keys()].sort(collator.compare);

  let next = maxKelompokNumber(allItems);
  let currentLabel: string | null = null;
  let currentCount = 0;

  for (const product of products) {
    const batch = byProduct.get(product)!.sort((a, b) => collator.compare(norm(a.no_batch), norm(b.no_batch)));

    const existing = existingByProduct.get(product);
    if (existing) {
      for (const it of batch) assignments.set(it.id, existing);
      continue;
    }

    if (batch.length > MAX_PER_KELOMPOK) {
      const label = kelompokLabel(++next);
      for (const it of batch) assignments.set(it.id, label);
      // kelompok penuh, mulai baru untuk produk berikutnya
      currentLabel = null;
      currentCount = 0;
      continue;
    }

    if (currentLabel === null || currentCount + batch.length > MAX_PER_KELOMPOK) {
      currentLabel = kelompokLabel(++next);
      currentCount = 0;
    }
    for (const it of batch) assignments.set(it.id, currentLabel);
    currentCount += batch.length;
  }

  // laporkan kelompok yang tersentuh dan isinya > 10
  const counts = new Map<string, number>();
  for (const it of pending) {
    const label = assignments.get(it.id) ?? norm(it.kelompok_koding);
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const touched = new Set(assignments.values());
  for (const [label, n] of counts) {
    if (touched.has(label) && n > MAX_PER_KELOMPOK) oversized.push(label);
  }
  oversized.sort(compareKelompok);

  return { assignments, oversized };
}

/** Urutkan label kelompok: KODING 1, KODING 2, ..., lalu label lain. */
export function compareKelompok(a: string, b: string): number {
  const na = kelompokNumber(a);
  const nb = kelompokNumber(b);
  if (na !== null && nb !== null) return na - nb;
  if (na !== null) return -1;
  if (nb !== null) return 1;
  return collator.compare(a, b);
}
