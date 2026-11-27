import { useEffect, useMemo, useState } from 'react';
import { BULK_COLUMNS, cellText, DESAIN_OPTIONS, ITEM_COLUMNS, type ItemColumn } from '../lib/columns';
import { derive, sortItems, type Derived } from '../lib/rules';
import type { Item } from '../lib/types';
import { DateCell, DesainCell, KelompokSelect, LinkCell, SelectCell, TextCell } from './cells';
import type { KelompokOptions } from '../lib/koding';
import { useOptions } from './OptionsProvider';
import { Badge, Button, inputCls } from './ui';
import { IconFilter, IconTrash, IconX } from './icons';

const GROUP_ACCENT: Record<string, string> = {
  Identitas: 'border-slate-400',
  Kebutuhan: 'border-indigo-400',
  Desain: 'border-fuchsia-400',
  Kemasan: 'border-orange-400',
  Koding: 'border-sky-400',
  Produksi: 'border-amber-400',
  Selesai: 'border-emerald-400',
  Ringkasan: 'border-slate-800',
  Catatan: 'border-slate-300',
};

const EMPTY = '__kosong__';

interface Props {
  items: Item[];
  search: string;
  onPatch: (id: string, patch: Partial<Item>) => void;
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** pilihan kelompok koding dari seluruh item project (lintas brand) */
  kelompok: KelompokOptions;
}

export function ItemTable({ items, search, onPatch, selected, setSelected, kelompok }: Props) {
  const { options } = useOptions();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const rows = useMemo(() => sortItems(items).map((it) => ({ it, d: derive(it) })), [items]);

  const visible = useMemo(() => {
    const q = search.trim().toUpperCase();
    return rows.filter(({ it, d }) => {
      if (q && !`${it.nama_produk} ${it.no_batch ?? ''}`.toUpperCase().includes(q)) return false;
      for (const [key, f] of Object.entries(filters)) {
        if (!f) continue;
        const col = ITEM_COLUMNS.find((c) => c.key === key)!;
        const val = cellText(col, it, d);
        if (isChoiceFilter(col)) {
          if (f === EMPTY ? val !== '' : val !== f) return false;
        } else if (col.type === 'link') {
          if ((f === 'ada') !== Boolean(val)) return false;
        } else if (!val.toUpperCase().includes(f.toUpperCase())) return false;
      }
      return true;
    });
  }, [rows, filters, search]);

  const distinct = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const col of ITEM_COLUMNS) {
      if (!isChoiceFilter(col)) continue;
      out[col.key] = [...new Set(rows.map(({ it, d }) => cellText(col, it, d)).filter(Boolean))].sort();
    }
    return out;
  }, [rows]);

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const visibleIds = visible.map((r) => r.it.id);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allChecked = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const groups = useMemo(() => {
    const out: { name: string; span: number }[] = [];
    for (const c of ITEM_COLUMNS) {
      const last = out[out.length - 1];
      if (last && last.name === c.group) last.span++;
      else out.push({ name: c.group, span: 1 });
    }
    return out;
  }, []);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 print:hidden">
        <Button size="sm" variant={showFilters ? 'primary' : 'secondary'} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
          <IconFilter className="h-3.5 w-3.5" />
          Filter kolom{activeFilters ? ` (${activeFilters})` : ''}
        </Button>
        {activeFilters > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setFilters({})}>
            <IconX className="h-3.5 w-3.5" />
            Hapus filter
          </Button>
        )}
        <span className="text-[13px] text-slate-600">
          Menampilkan <b className="font-semibold text-slate-900">{visible.length}</b> dari {rows.length} item
        </span>
      </div>

      <div className="max-h-[calc(100dvh-11rem)] overflow-auto max-lg:max-h-[calc(100dvh-5rem)] rounded-xl border border-slate-200 bg-white shadow-sm print:max-h-none print:overflow-visible">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead className="sticky top-0 z-20 text-left">
            <tr>
              <th className="sticky left-0 z-20 w-10 min-w-[2.5rem] max-w-[2.5rem] border-b border-slate-200 bg-slate-50 text-center" rowSpan={showFilters ? 3 : 2}>
                <input
                  type="checkbox"
                  aria-label="Pilih semua baris yang tampil"
                  className="h-4 w-4 cursor-pointer rounded border-slate-400 align-middle"
                  checked={allChecked}
                  onChange={() =>
                    setSelected((s) => {
                      const n = new Set(s);
                      if (allChecked) visibleIds.forEach((id) => n.delete(id));
                      else visibleIds.forEach((id) => n.add(id));
                      return n;
                    })
                  }
                />
              </th>
              {groups.map((g) => (
                <th
                  key={g.name}
                  colSpan={g.span}
                  className={`border-b border-t-[3px] border-b-slate-200 bg-slate-50 px-2 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 ${GROUP_ACCENT[g.name]}`}
                >
                  {g.name}
                </th>
              ))}
            </tr>
            <tr>
              {ITEM_COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap border-b border-slate-300 bg-slate-50 px-2 py-2.5 text-xs font-semibold text-slate-800 ${c.width ?? ''} ${c.key === 'nama_produk' ? 'sticky left-10 z-10 shadow-[1px_0_0_#e2e8f0]' : ''}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
            {showFilters && (
              <tr className="print:hidden">
                {ITEM_COLUMNS.map((c) => (
                  <th key={c.key} className={`border-b border-slate-200 bg-white px-1.5 py-1.5 font-normal ${c.key === 'nama_produk' ? 'sticky left-10 z-10' : ''}`}>
                    <FilterInput col={c} value={filters[c.key] ?? ''} values={distinct[c.key] ?? []} onChange={(v) => setFilters((f) => ({ ...f, [c.key]: v }))} />
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={ITEM_COLUMNS.length + 1} className="px-4 py-12 text-center text-sm text-slate-500">
                  Tidak ada item yang cocok.
                </td>
              </tr>
            )}
            {visible.map(({ it, d }, idx) => {
              const isSel = selected.has(it.id);
              const rowBg = isSel ? 'bg-sky-50' : `${idx % 2 ? 'bg-slate-50' : 'bg-white'} group-hover:bg-amber-50`;
              return (
                <tr key={it.id} className="group">
                  <td className={`sticky left-0 z-10 w-10 min-w-[2.5rem] max-w-[2.5rem] border-b border-slate-200/70 text-center ${rowBg}`}>
                    <input type="checkbox" aria-label={`Pilih ${it.nama_produk} ${it.no_batch ?? ''}`} className="h-4 w-4 cursor-pointer rounded border-slate-400 align-middle" checked={isSel} onChange={() => toggle(it.id)} />
                  </td>
                  {ITEM_COLUMNS.map((c) => (
                    <td
                      key={c.key}
                      className={`border-b border-slate-200/70 px-1.5 py-1.5 align-middle ${c.key === 'nama_produk' ? `sticky left-10 z-[5] shadow-[1px_0_0_#e2e8f0] ${rowBg}` : rowBg}`}
                    >
                      <Cell col={c} item={it} d={d} options={c.kategori ? options[c.kategori] : []} onPatch={onPatch} kelompok={kelompok} />
                      {c.key === 'nama_produk' && (
                        <div className="mt-0.5 px-2 print:hidden" title="Langkah berikutnya">
                          <Badge value={d.langkah} className="!text-[11px]" />
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function isChoiceFilter(c: ItemColumn) {
  return c.type === 'select' || c.type === 'computed' || c.type === 'desain' || c.type === 'kelompok';
}

function FilterInput({ col, value, values, onChange }: { col: ItemColumn; value: string; values: string[]; onChange: (v: string) => void }) {
  const cls = 'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20';
  if (isChoiceFilter(col)) {
    return (
      <select aria-label={`Filter ${col.label}`} className={cls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Semua</option>
        <option value={EMPTY}>(kosong)</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    );
  }
  if (col.type === 'link') {
    return (
      <select aria-label={`Filter ${col.label}`} className={cls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Semua</option>
        <option value="ada">Ada link</option>
        <option value="tidak">Belum ada</option>
      </select>
    );
  }
  return <input aria-label={`Filter ${col.label}`} className={cls} placeholder="cari…" value={value} onChange={(e) => onChange(e.target.value)} />;
}

function Cell({ col, item, d, options, onPatch, kelompok }: { col: ItemColumn; item: Item; d: Derived; options: string[]; onPatch: Props['onPatch']; kelompok: KelompokOptions }) {
  const save = (v: string | null) => col.field && onPatch(item.id, { [col.field]: v } as Partial<Item>);
  const label = `${col.label} ${item.nama_produk} ${item.no_batch ?? ''}`;
  switch (col.type) {
    case 'computed':
      if (col.key === 'tanggal_batch') return <span className="whitespace-nowrap px-1.5 tabular-nums text-slate-600">{d.tanggalBatch || '—'}</span>;
      return <Badge value={col.key === 'status' ? d.status : d.langkah} />;
    case 'desain':
      return <DesainCell computed={d.statusDesain} manual={item.status_desain_manual} onSave={save} label={label} />;
    case 'kelompok':
      return <KelompokSelect value={item.kelompok_koding} labels={kelompok.labels} next={kelompok.next} onSave={save} label={label} />;
    case 'select':
      return <SelectCell value={item[col.field!] as string | null} options={options} onSave={save} label={label} />;
    case 'link':
      return <LinkCell value={item.file_kemasan} onSave={save} label={label} />;
    case 'date':
      return <DateCell value={item[col.field!] as string | null} onSave={save} label={label} />;
    default:
      return (
        <TextCell
          value={item[col.field!] as string | null}
          onSave={(v) => save(col.key === 'no_batch' ? (v ? v.toUpperCase().replace(/\s+/g, ' ') : v) : v)}
          className={col.key === 'nama_produk' ? 'font-semibold' : ''}
          multiline={col.key.startsWith('catatan')}
          label={label}
        />
      );
  }
}

export function BulkBar({
  count,
  onClear,
  onApply,
  onDelete,
  kelompok,
}: {
  count: number;
  onClear: () => void;
  onApply: (patch: Partial<Item>) => Promise<void>;
  onDelete: () => Promise<void>;
  kelompok: KelompokOptions;
}) {
  const { options } = useOptions();
  const [key, setKey] = useState(BULK_COLUMNS.find((c) => c.key === 'kemasan')!.key);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const col = BULK_COLUMNS.find((c) => c.key === key)!;

  const choices =
    col.type === 'desain' ? DESAIN_OPTIONS : col.type === 'kelompok' ? [...kelompok.labels, kelompok.next] : col.kategori ? options[col.kategori] : null;

  const apply = async () => {
    setBusy(true);
    try {
      const v = value.trim() || null;
      await onApply({ [col.field!]: v } as Partial<Item>);
    } finally {
      setBusy(false);
    }
  };

  // Esc = tutup bar (batal pilih)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClear();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClear]);

  const selectCls = 'h-9 min-w-0 cursor-pointer rounded-md bg-slate-800 px-2 text-sm text-white';

  return (
    <div
      role="region"
      aria-label="Ubah item terpilih"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-xl bg-slate-900 p-2.5 text-sm text-white shadow-2xl print:hidden"
    >
      {/* HP: baris atas = jumlah + tutup; desktop: tutup di ujung kanan */}
      <span className="order-1 pl-1 font-semibold">{count} item dipilih</span>
      <button
        type="button"
        onClick={onClear}
        className="order-2 ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-800 px-3 font-semibold text-white ring-1 ring-slate-600 transition-colors hover:bg-slate-700 sm:order-last sm:ml-0"
        aria-label="Tutup dan batalkan pilihan"
        title="Tutup (Esc)"
      >
        <IconX className="h-4 w-4" />
        Tutup
      </button>
      {/* HP: tiap kontrol satu baris penuh; desktop: satu baris */}
      <div className="order-3 flex w-full min-w-0 flex-col gap-2 sm:order-2 sm:w-auto sm:flex-1 sm:flex-row sm:items-center">
        <label className="flex min-w-0 items-center gap-2">
          <span className="w-16 shrink-0 text-slate-400 sm:w-auto">Ubah</span>
          <select aria-label="Kolom yang diubah" className={`${selectCls} flex-1 sm:flex-none`} value={key} onChange={(e) => (setKey(e.target.value), setValue(''))}>
            {BULK_COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 items-center gap-2">
          <span className="w-16 shrink-0 text-slate-400 sm:w-auto">menjadi</span>
          {choices ? (
            <select aria-label="Nilai baru" className={`${selectCls} flex-1 sm:flex-none`} value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">{col.type === 'desain' ? '(Otomatis)' : col.type === 'kelompok' ? '(tanpa kelompok)' : '(kosong)'}</option>
              {choices.map((o) => (
                <option key={o} value={o}>
                  {col.type === 'kelompok' && o === kelompok.next ? `+ ${o} (kelompok baru)` : o}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label="Nilai baru"
              type={col.type === 'date' ? 'date' : 'text'}
              className={`${inputCls} !h-9 !min-w-0 flex-1 !border-slate-700 !bg-slate-800 !text-sm !text-white sm:!w-44 sm:flex-none`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="(kosong)"
            />
          )}
        </label>
        <div className="flex items-center gap-2 sm:contents">
          <Button size="sm" variant="primary" className="flex-1 !bg-sky-500 hover:!bg-sky-400 sm:flex-none" disabled={busy} onClick={apply}>
            {busy ? 'Menyimpan…' : 'Terapkan'}
          </Button>
          <Button size="sm" variant="ghost" className="!text-rose-300 hover:!bg-slate-800 sm:ml-auto" onClick={onDelete}>
            <IconTrash className="h-3.5 w-3.5" />
            Hapus
          </Button>
        </div>
      </div>
    </div>
  );
}

