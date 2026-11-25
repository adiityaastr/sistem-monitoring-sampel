import { norm } from './rules';

export type Tone = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'violet';

const GREEN = new Set(['SUDAH', 'SELESAI', 'SUDAH ADA', 'AMAN', 'SAMPEL JADI', 'SUDAH DICETAK']);
const RED = new Set(['BELUM', 'BELUM ADA', 'BUAT DESAIN DULU', 'BELUM DITENTUKAN', 'CEK KEMASAN DANAMON', 'BELUM DIBUAT']);
const YELLOW = new Set(['TUNGGU KODING', 'TUNGGU SAMPEL DARI PRODUKSI', 'PROSES PRODUKSI', 'PROSES CETAK', 'PERLU CETAK']);
const BLUE = new Set(['SIAP DISERAHKAN KE PRODUKSI', 'SERAHKAN KE KODING']);

/**
 * Warna badge: hijau = selesai/sudah, merah = belum/buat desain,
 * kuning = menunggu/proses, biru = siap (ada aksi yang bisa dikerjakan).
 */
export function toneOf(value: string | null | undefined): Tone {
  const v = norm(value);
  if (!v) return 'gray';
  if (GREEN.has(v)) return 'green';
  if (RED.has(v)) return 'red';
  if (YELLOW.has(v) || v.startsWith('PROSES ') || v.startsWith('TUNGGU')) return 'yellow';
  if (BLUE.has(v) || v.startsWith('SIAP')) return 'blue';
  if (v === 'SISIPAN TAMBAHAN') return 'violet';
  return 'gray';
}

export const TONE_CLASSES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  yellow: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  gray: 'bg-slate-50 text-slate-600 ring-slate-500/15',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
};

/** Warna tahap untuk progres & grafik ringkas. */
export const STEP_BAR: Record<string, string> = {
  'SERAHKAN KE KODING': 'bg-sky-500',
  'TUNGGU KODING': 'bg-amber-400',
  'SIAP DISERAHKAN KE PRODUKSI': 'bg-sky-700',
  'TUNGGU SAMPEL DARI PRODUKSI': 'bg-amber-600',
  'BUAT DESAIN DULU': 'bg-rose-500',
  SELESAI: 'bg-emerald-500',
};
