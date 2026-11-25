import { useMemo, useState } from 'react';
import { BULK_COLUMNS, cellText, DESAIN_OPTIONS, ITEM_COLUMNS, type ItemColumn } from '../lib/columns';
import { derive, sortItems, type Derived } from '../lib/rules';
import type { Item } from '../lib/types';
import { DateCell, DesainCell, LinkCell, SelectCell, TextCell } from './cells';
import { useOptions } from './OptionsProvider';
import { Badge, Button, inputCls } from './ui';

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
}

export function ItemTable({ items, search, onPatch, selected, setSelected }: Props) {
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
        <Button size="sm" variant={showFilters ? 'primary' : 'secondary'} onClick={() => setShowFilters((v) => !v)}>
          Filter kolom{activeFilters ? ` (${activeFilters})` : ''}
        </Button>
        {activeFilters > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setFilters({})}>
            Hapus filter
          </Button>
        )}
        <span className="text-xs text-slate-500">
          {visible.length} dari {rows.length} item
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead className="text-left">
            <tr>
              <th className="sticky left-0 z-20 w-9 border-b border-slate-200 bg-slate-50" rowSpan={showFilters ? 3 : 2}>
                <input
                  type="checkbox"
                  aria-label="Pilih semua baris yang tampil"
                  className="ml-3 h-4 w-4 rounded border-slate-300"
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
                  className={`border-b border-t-[3px] border-b-slate-200 bg-slate-50 px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${GROUP_ACCENT[g.name]}`}
                >
                  {g.name}
                </th>
              ))}
            </tr>
            <tr>
              {ITEM_COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-semibold text-slate-700 ${c.width ?? ''} ${c.key === 'nama_produk' ? 'sticky left-9 z-10 shadow-[1px_0_0_#e2e8f0]' : ''}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
            {showFilters && (
              <tr className="print:hidden">
                {ITEM_COLUMNS.map((c) => (
                  <th key={c.key} className={`border-b border-slate-200 bg-white px-1.5 py-1.5 font-normal ${c.key === 'nama_produk' ? 'sticky left-9 z-10' : ''}`}>
                    <FilterInput col={c} value={filters[c.key] ?? ''} values={distinct[c.key] ?? []} onChange={(v) => setFilters((f) => ({ ...f, [c.key]: v }))} />
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={ITEM_COLUMNS.length + 1} className="px-4 py-10 text-center text-sm text-slate-400">
                  Tidak ada item yang cocok.
                </td>
              </tr>
            )}
            {visible.map(({ it, d }) => {
              const isSel = selected.has(it.id);
              const rowBg = isSel ? 'bg-sky-50' : 'bg-white group-hover:bg-slate-50';
              return (
                <tr key={it.id} className="group">
                  <td className={`sticky left-0 z-10 border-b border-slate-100 ${rowBg}`}>
                    <input type="checkbox" aria-label={`Pilih ${it.nama_produk} ${it.no_batch ?? ''}`} className="ml-3 h-4 w-4 rounded border-slate-300" checked={isSel} onChange={() => toggle(it.id)} />
                  </td>
                  {ITEM_COLUMNS.map((c) => (
                    <td
                      key={c.key}
                      className={`border-b border-slate-100 px-1.5 py-1 align-middle ${c.key === 'nama_produk' ? `sticky left-9 z-[5] shadow-[1px_0_0_#e2e8f0] ${rowBg}` : rowBg}`}
                    >
                      <Cell col={c} item={it} d={d} options={c.kategori ? options[c.kategori] : []} onPatch={onPatch} />
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
  return c.type === 'select' || c.type === 'computed' || c.type === 'desain' || c.key === 'kelompok_koding';
}

function FilterInput({ col, value, values, onChange }: { col: ItemColumn; value: string; values: string[]; onChange: (v: string) => void }) {
  const cls = 'h-7 w-full rounded-md border border-slate-200 bg-white px-1.5 text-[11px] focus:border-sky-400 focus:outline-none';
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

function Cell({ col, item, d, options, onPatch }: { col: ItemColumn; item: Item; d: Derived; options: string[]; onPatch: Props['onPatch'] }) {
  const save = (v: string | null) => col.field && onPatch(item.id, { [col.field]: v } as Partial<Item>);
  const label = `${col.label} ${item.nama_produk} ${item.no_batch ?? ''}`;
  switch (col.type) {
    case 'computed':
      if (col.key === 'tanggal_batch') return <span className="whitespace-nowrap px-1.5 tabular-nums text-slate-600">{d.tanggalBatch || '—'}</span>;
      return <Badge value={col.key === 'status' ? d.status : d.langkah} />;
    case 'desain':
      return <DesainCell computed={d.statusDesain} manual={item.status_desain_manual} onSave={save} label={label} />;
    case 'select':
      return <SelectCell value={item[col.field!] as string | null} options={options} onSave={save} label={label} />;
    case 'link':
      return <LinkCell value={item.file_kemasan} onSave={save} label={label} />;
    case 'date':
      return <DateCell value={item.tanggal_diserahkan} onSave={save} label={label} />;
    default:
      return (
        <TextCell
          value={item[col.field!] as string | null}
          onSave={(v) => save(col.key === 'no_batch' || col.key === 'kelompok_koding' ? (v ? v.toUpperCase().replace(/\s+/g, ' ') : v) : v)}
          className={col.key === 'nama_produk' ? 'font-semibold' : ''}
          multiline={col.key.startsWith('catatan')}
          label={label}
        />
      );
  }
}

export function BulkBar({ count, onClear, onApply, onDelete }: { count: number; onClear: () => void; onApply: (patch: Partial<Item>) => Promise<void>; onDelete: () => Promise<void> }) {
  const { options } = useOptions();
  const [key, setKey] = useState(BULK_COLUMNS.find((c) => c.key === 'kemasan')!.key);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const col = BULK_COLUMNS.find((c) => c.key === key)!;

  const choices = col.type === 'desain' ? DESAIN_OPTIONS : col.kategori ? options[col.kategori] : null;

  const apply = async () => {
    setBusy(true);
    try {
      const v = value.trim() || null;
      await onApply({ [col.field!]: v && col.key === 'kelompok_koding' ? v.toUpperCase() : v } as Partial<Item>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm text-white shadow-2xl print:hidden">
      <span className="font-semibold">{count} dipilih</span>
      <span className="text-slate-400">· ubah</span>
      <select aria-label="Kolom yang diubah" className="h-8 rounded-md bg-slate-800 px-2 text-xs text-white" value={key} onChange={(e) => (setKey(e.target.value), setValue(''))}>
        {BULK_COLUMNS.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
      <span className="text-slate-400">=</span>
      {choices ? (
        <select aria-label="Nilai baru" className="h-8 rounded-md bg-slate-800 px-2 text-xs text-white" value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">{col.type === 'desain' ? '(Otomatis)' : '(kosong)'}</option>
          {choices.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-label="Nilai baru"
          type={col.type === 'date' ? 'date' : 'text'}
          className={`${inputCls} !h-8 !w-44 !border-slate-700 !bg-slate-800 !text-xs !text-white`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="(kosong)"
        />
      )}
      <Button size="sm" variant="primary" className="!bg-sky-500 hover:!bg-sky-400" disabled={busy} onClick={apply}>
        {busy ? 'Menyimpan…' : 'Terapkan'}
      </Button>
      <div className="ml-auto flex gap-1">
        <Button size="sm" variant="ghost" className="!text-rose-300 hover:!bg-slate-800" onClick={onDelete}>
          Hapus
        </Button>
        <Button size="sm" variant="ghost" className="!text-slate-300 hover:!bg-slate-800" onClick={onClear}>
          Batal pilih
        </Button>
      </div>
    </div>
  );
}

