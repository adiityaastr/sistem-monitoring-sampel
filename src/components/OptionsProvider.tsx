import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchOptions } from '../lib/data';
import type { MasterOption, OptionKategori } from '../lib/types';

/** Cadangan bila tabel master_options kosong / gagal dimuat. */
export const DEFAULT_OPTIONS: Record<OptionKategori, string[]> = {
  status: ['SUDAH', 'BELUM', 'SISIPAN TAMBAHAN'],
  sediaan: ['COD', 'COD (SACHET)', 'COL', 'KAPSUL', 'SERBUK', 'SEMI SOLID', 'TEH'],
  kebutuhan: ['BUAT BARU', 'GANTI CODING', 'GANTI KEMASAN', 'PERBAIKI DESAIN', 'TIDAK PERLU'],
  kemasan: ['PERLU CETAK', 'TIDAK PERLU', 'SUDAH DICETAK'],
  status_sampel: ['BELUM DIBUAT', 'PROSES PRODUKSI', 'SAMPEL JADI'],
};

export const KATEGORI_LABEL: Record<OptionKategori, string> = {
  status: 'Status (Sudah/Belum)',
  sediaan: 'Sediaan',
  kebutuhan: 'Kebutuhan',
  kemasan: 'Kemasan',
  status_sampel: 'Status Sampel',
};

/** Nilai yang dipakai aturan otomatis — tidak boleh diubah/dihapus. */
export const SYSTEM_VALUES: Partial<Record<OptionKategori, string[]>> = {
  status: ['SUDAH', 'BELUM'],
  kebutuhan: ['TIDAK PERLU'],
  kemasan: ['PERLU CETAK'],
  status_sampel: ['SAMPEL JADI'],
};

interface OptionsState {
  raw: MasterOption[];
  options: Record<OptionKategori, string[]>;
  reload: () => Promise<void>;
}

const Ctx = createContext<OptionsState>({ raw: [], options: DEFAULT_OPTIONS, reload: async () => {} });

export function OptionsProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<MasterOption[]>([]);

  const reload = useCallback(async () => {
    try {
      setRaw(await fetchOptions());
    } catch {
      setRaw([]);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const options = useMemo(() => {
    const out = { ...DEFAULT_OPTIONS };
    for (const k of Object.keys(DEFAULT_OPTIONS) as OptionKategori[]) {
      const vals = raw.filter((o) => o.kategori === k && o.aktif).sort((a, b) => a.urutan - b.urutan).map((o) => o.nilai);
      if (vals.length) out[k] = vals;
    }
    return out;
  }, [raw]);

  return <Ctx.Provider value={{ raw, options, reload }}>{children}</Ctx.Provider>;
}

export const useOptions = () => useContext(Ctx);
