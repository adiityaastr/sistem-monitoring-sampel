import { useMemo } from 'react';
import { rekap, type RekapCell } from '../lib/excelExport';
import { REKAP_KEBUTUHAN } from '../lib/rules';
import type { Item } from '../lib/types';

export function RekapPanel({ items }: { items: Item[] }) {
  const r = useMemo(() => rekap(items), [items]);
  const extra = Object.keys(r).filter((k) => k !== 'TOTAL' && !(REKAP_KEBUTUHAN as readonly string[]).includes(k));
  const keys = [...REKAP_KEBUTUHAN, ...extra];

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-bold text-slate-900">Rekap Monitoring</h2>
        <span className="text-xs text-slate-600">Selesai = kolom “Selesai” bernilai SUDAH</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px] tabular-nums">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-slate-600">
              <th rowSpan={2} className="px-4 py-2 text-left align-bottom font-semibold">
                Kebutuhan
              </th>
              {['EPI', 'AZH', 'Total'].map((b) => (
                <th key={b} colSpan={3} className={`px-2 pt-2 text-center font-bold ${b === 'Total' ? 'text-slate-900' : ''}`}>
                  {b}
                </th>
              ))}
            </tr>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              {[0, 1, 2].flatMap((i) =>
                ['Jumlah', 'Selesai', 'Belum'].map((h) => (
                  <th key={`${i}${h}`} className={`px-2 pb-2 text-right font-medium ${h === 'Jumlah' ? 'border-l border-slate-100' : ''}`}>
                    {h}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-1.5 font-semibold text-slate-700">{k}</td>
                <Cells c={r[k].EPI} />
                <Cells c={r[k].AZH} />
                <Cells c={r[k].total} strong />
              </tr>
            ))}
            <tr className="bg-slate-50 font-bold text-slate-900">
              <td className="px-4 py-2">TOTAL</td>
              <Cells c={r.TOTAL.EPI} />
              <Cells c={r.TOTAL.AZH} />
              <Cells c={r.TOTAL.total} strong />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cells({ c, strong }: { c: RekapCell; strong?: boolean }) {
  return (
    <>
      <td className={`border-l border-slate-100 px-2 py-2 text-right ${strong ? 'font-bold' : ''} ${c.jumlah ? '' : 'text-slate-400'}`}>{c.jumlah}</td>
      <td className={`px-2 py-2 text-right ${c.selesai ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>{c.selesai}</td>
      <td className={`px-2 py-2 text-right ${c.belum ? 'font-semibold text-rose-700' : 'text-slate-400'}`}>{c.belum}</td>
    </>
  );
}
