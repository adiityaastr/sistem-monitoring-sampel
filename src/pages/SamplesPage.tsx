import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteSample, fetchSamples, insertSamples, updateSample } from '../lib/data';
import { norm } from '../lib/rules';
import { BRANDS, type Brand, type OptionKategori, type SampleMissing } from '../lib/types';
import { PageHeader } from '../components/Layout';
import { SelectCell, TextCell } from '../components/cells';
import { useOptions } from '../components/OptionsProvider';
import { Button, EmptyState, ErrorBox, Field, inputCls, Modal, Spinner, errMsg, useToast } from '../components/ui';
import { IconPlus, IconX } from '../components/icons';

type Key = keyof Omit<SampleMissing, 'id' | 'updated_at' | 'updated_by'>;
const COLS: { key: Key; label: string; kategori?: OptionKategori | 'brand' }[] = [
  { key: 'brand', label: 'Brand', kategori: 'brand' },
  { key: 'nama_produk', label: 'Nama Produk' },
  { key: 'gramasi', label: 'Gramasi' },
  { key: 'no_batch', label: 'No Batch' },
  { key: 'sediaan', label: 'Sediaan', kategori: 'sediaan' },
  { key: 'cek_kemasan', label: 'Cek Kemasan', kategori: 'status' },
  { key: 'kemasan', label: 'Kemasan', kategori: 'kemasan' },
  { key: 'selesai', label: 'Selesai', kategori: 'status' },
];
const FILTER_COLS = COLS.filter((c) => c.kategori);

export function SamplesPage() {
  const toast = useToast();
  const { options } = useOptions();
  const [rows, setRows] = useState<SampleMissing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Partial<Record<Key, string>>>({ selesai: 'BELUM' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchSamples());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const optsFor = (k?: OptionKategori | 'brand') => (k === 'brand' ? BRANDS : k ? options[k] : []);

  const visible = useMemo(() => {
    const q = search.trim().toUpperCase();
    return rows
      .filter((r) => !q || `${r.nama_produk} ${r.no_batch ?? ''}`.toUpperCase().includes(q))
      .filter((r) => Object.entries(filters).every(([k, v]) => !v || norm(r[k as Key] as string) === v))
      .sort((a, b) => a.brand.localeCompare(b.brand) || a.nama_produk.localeCompare(b.nama_produk) || (a.no_batch ?? '').localeCompare(b.no_batch ?? ''));
  }, [rows, search, filters]);

  const save = async (id: string, patch: Partial<SampleMissing>) => {
    const before = rows.find((r) => r.id === id);
    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    try {
      const saved = await updateSample(id, patch);
      setRows((p) => p.map((r) => (r.id === id ? saved : r)));
    } catch (e) {
      if (before) setRows((p) => p.map((r) => (r.id === id ? before : r)));
      toast(`Gagal menyimpan: ${errMsg(e)}`, 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Sampel Belum Ada"
        subtitle="Daftar produk/batch yang sampelnya belum tersedia."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <IconPlus />
            Tambah sampel
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <input type="search" aria-label="Cari" className={`${inputCls} max-w-xs`} placeholder="Cari nama produk atau no batch…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {FILTER_COLS.map((c) => (
          <label key={c.key} className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {c.label}
            <select
              className="mt-0.5 block h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal normal-case tracking-normal text-slate-800"
              value={filters[c.key] ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, [c.key]: e.target.value }))}
            >
              <option value="">Semua</option>
              {optsFor(c.kategori).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : visible.length === 0 ? (
        <EmptyState title={rows.length ? 'Tidak ada yang cocok dengan filter' : 'Belum ada data'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[860px] text-xs">
            <thead className="bg-slate-50 text-left text-[11px] text-slate-600">
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} className={`whitespace-nowrap px-2 py-2 font-semibold ${c.key === 'nama_produk' ? 'min-w-[200px]' : ''}`}>
                    {c.label}
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  {COLS.map((c) => (
                    <td key={c.key} className={`px-1.5 py-1 ${c.key === 'nama_produk' ? '' : 'whitespace-nowrap'}`}>
                      {c.kategori ? (
                        <SelectCell
                          label={`${c.label} ${r.nama_produk}`}
                          value={r[c.key] as string | null}
                          options={optsFor(c.kategori)}
                          onSave={(v) => (c.key === 'brand' ? v && save(r.id, { brand: v as Brand }) : save(r.id, { [c.key]: v }))}
                        />
                      ) : (
                        <TextCell
                          label={`${c.label} ${r.nama_produk}`}
                          value={r[c.key] as string | null}
                          className={c.key === 'nama_produk' ? 'font-semibold' : ''}
                          onSave={(v) => (c.key === 'nama_produk' ? v && save(r.id, { nama_produk: v }) : save(r.id, { [c.key]: c.key === 'no_batch' && v ? norm(v) : v }))}
                        />
                      )}
                    </td>
                  ))}
                  <td>
                    <button
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Hapus ${r.nama_produk}`}
                      onClick={async () => {
                        if (!confirm(`Hapus ${r.nama_produk} ${r.no_batch ?? ''}?`)) return;
                        try {
                          await deleteSample(r.id);
                          setRows((p) => p.filter((x) => x.id !== r.id));
                        } catch (e) {
                          toast(errMsg(e), 'error');
                        }
                      }}
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddSampleModal
        open={adding}
        onClose={() => setAdding(false)}
        onSave={async (row) => {
          const created = await insertSamples([row]);
          setRows((p) => [...p, ...created]);
          toast('Ditambahkan');
        }}
      />
    </>
  );
}

function AddSampleModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (r: Omit<SampleMissing, 'id'>) => Promise<void> }) {
  const { options } = useOptions();
  const toast = useToast();
  const [f, setF] = useState({ brand: 'EPI' as Brand, nama_produk: '', gramasi: '', no_batch: '', sediaan: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => {
    try {
      await onSave({
        brand: f.brand,
        nama_produk: f.nama_produk.trim().toUpperCase(),
        gramasi: f.gramasi.trim() || null,
        no_batch: norm(f.no_batch) || null,
        sediaan: f.sediaan || null,
        cek_kemasan: 'BELUM',
        kemasan: null,
        selesai: 'BELUM',
      });
      setF((x) => ({ ...x, nama_produk: '', no_batch: '', gramasi: '' }));
      onClose();
    } catch (e) {
      toast(errMsg(e).includes('duplicate') ? 'Data ini sudah ada' : errMsg(e), 'error');
    }
  };
  return (
    <Modal
      open={open}
      title="Tambah sampel yang belum ada"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" disabled={!f.nama_produk.trim()} onClick={submit}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Brand">
          <select className={inputCls} value={f.brand} onChange={set('brand')}>
            {BRANDS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Gramasi">
          <input className={inputCls} value={f.gramasi} onChange={set('gramasi')} />
        </Field>
        <div className="col-span-2">
          <Field label="Nama produk">
            <input className={inputCls} value={f.nama_produk} onChange={set('nama_produk')} autoFocus />
          </Field>
        </div>
        <Field label="No batch">
          <input className={inputCls} value={f.no_batch} onChange={set('no_batch')} />
        </Field>
        <Field label="Sediaan">
          <select className={inputCls} value={f.sediaan} onChange={set('sediaan')}>
            <option value="">—</option>
            {options.sediaan.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
