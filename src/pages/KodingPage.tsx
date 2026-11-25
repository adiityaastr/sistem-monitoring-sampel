import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { assignKelompok, fetchProjects } from '../lib/data';
import { autoGroupKoding, compareKelompok, MAX_PER_KELOMPOK } from '../lib/koding';
import { exportKodingXlsx } from '../lib/excelExport';
import { langkahBerikutnya, norm, STEP } from '../lib/rules';
import { useItems } from '../lib/useItems';
import type { Item, Project } from '../lib/types';
import { PageHeader } from '../components/Layout';
import { Badge, Button, EmptyState, ErrorBox, inputCls, Spinner, errMsg, useToast } from '../components/ui';

const byNameBatch = (a: Item, b: Item) => norm(a.nama_produk).localeCompare(norm(b.nama_produk)) || norm(a.no_batch).localeCompare(norm(b.no_batch));

export function KodingPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projError, setProjError] = useState<string | null>(null);
  const [showSubmitted, setShowSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchProjects().then(setProjects, (e) => setProjError(errMsg(e)));
  }, []);

  const projectId = params.get('project') ?? projects?.find((p) => norm(p.project_selesai) !== 'SUDAH')?.id ?? projects?.[0]?.id;
  const project = projects?.find((p) => p.id === projectId);
  const { items, setItems, loading, error, reload, patch, bulk } = useItems(projectId);

  const pendingUngrouped = useMemo(
    () => items.filter((i) => langkahBerikutnya(i) === STEP.SERAHKAN_KODING && !(i.kelompok_koding ?? '').trim()).sort(byNameBatch),
    [items],
  );

  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of items) {
      const label = norm(it.kelompok_koding);
      if (!label) continue;
      m.set(label, [...(m.get(label) ?? []), it]);
    }
    return [...m.entries()]
      .sort(([a], [b]) => compareKelompok(a, b))
      .map(([label, list]) => ({
        label,
        items: list.sort(byNameBatch),
        submitted: list.every((i) => norm(i.diserahkan_ke_koding) === 'SUDAH'),
        missingLink: list.filter((i) => !(i.file_kemasan ?? '').trim()).length,
      }));
  }, [items]);

  const shownGroups = groups.filter((g) => showSubmitted || !g.submitted);
  const labels = groups.map((g) => g.label);

  const runAutoGroup = async () => {
    const { assignments, oversized } = autoGroupKoding(items);
    if (assignments.size === 0) {
      toast('Tidak ada item “SERAHKAN KE KODING” yang belum berkelompok.');
      return;
    }
    const newLabels = [...new Set(assignments.values())].sort(compareKelompok);
    let msg = `${assignments.size} item akan dimasukkan ke ${newLabels.join(', ')}.`;
    if (oversized.length) msg += `\n\nPerhatian: ${oversized.join(', ')} berisi lebih dari ${MAX_PER_KELOMPOK} item karena satu produk punya banyak batch.`;
    if (!confirm(`${msg}\n\nLanjutkan?`)) return;
    setBusy(true);
    try {
      await assignKelompok(assignments);
      setItems((prev) => prev.map((i) => (assignments.has(i.id) ? { ...i, kelompok_koding: assignments.get(i.id)! } : i)));
      toast(`Dikelompokkan ke ${newLabels.join(', ')}`);
    } catch (e) {
      toast(`Gagal: ${errMsg(e)}`, 'error');
      reload();
    } finally {
      setBusy(false);
    }
  };

  const markSubmitted = async (g: (typeof groups)[number]) => {
    const warn = g.missingLink ? `\n\n${g.missingLink} item belum punya link file kemasan.` : '';
    if (!confirm(`Tandai ${g.items.length} item di ${g.label} sudah diserahkan ke koding?${warn}`)) return;
    await bulk(
      g.items.map((i) => i.id),
      { diserahkan_ke_koding: 'SUDAH' },
    ).catch(() => {});
  };

  if (projError) return <ErrorBox message={projError} />;
  if (!projects) return <Spinner />;
  if (projects.length === 0) return <EmptyState title="Belum ada project" />;

  return (
    <>
      <PageHeader
        title={
          <>
            List Koding <span className="hidden text-slate-400 print:inline">— {project?.nama}</span>
          </>
        }
        subtitle="Kelompok item yang diserahkan ke tim koding, maksimal 10 item per kelompok."
        actions={
          <>
            <select aria-label="Pilih project" className={`${inputCls} !w-auto`} value={projectId} onChange={(e) => setParams({ project: e.target.value })}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama}
                </option>
              ))}
            </select>
            <Button onClick={() => window.print()}>Cetak</Button>
            <Button
              onClick={() =>
                exportKodingXlsx(
                  project?.nama ?? 'project',
                  shownGroups.flatMap((g) => g.items),
                ).catch((e) => toast(errMsg(e), 'error'))
              }
            >
              Ekspor Excel
            </Button>
          </>
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : (
        <div className="space-y-6">
          <datalist id="kelompok-list">
            {labels.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
          {/* item siap tapi belum berkelompok */}
          <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Belum berkelompok · {pendingUngrouped.length} item</h2>
                <p className="text-xs text-slate-600">
                  Item dengan langkah <b>SERAHKAN KE KODING</b> tanpa kelompok. Semua batch dari produk yang sama selalu masuk ke kelompok yang sama.
                </p>
              </div>
              <Button variant="primary" disabled={busy || pendingUngrouped.length === 0} onClick={runAutoGroup}>
                {busy ? 'Memproses…' : 'Kelompokkan otomatis'}
              </Button>
            </div>
            {pendingUngrouped.length > 0 && (
              <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                {pendingUngrouped.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 ring-1 ring-sky-100">
                    <span className="font-bold text-slate-400">{it.brand}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{it.nama_produk}</span>
                    <span className="tabular-nums text-slate-500">{it.no_batch}</span>
                    <KelompokInput item={it} onSave={(v) => patch(it.id, { kelompok_koding: v })} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex items-center gap-3 print:hidden">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={showSubmitted} onChange={(e) => setShowSubmitted(e.target.checked)} />
              Tampilkan kelompok yang sudah diserahkan
            </label>
            <span className="text-xs text-slate-400">
              {shownGroups.length} dari {groups.length} kelompok
            </span>
          </div>

          {shownGroups.length === 0 && <EmptyState title="Belum ada kelompok koding">Klik “Kelompokkan otomatis” untuk membuat kelompok.</EmptyState>}

          {shownGroups.map((g) => (
            <section key={g.label} className="print-avoid-break overflow-hidden rounded-xl border border-slate-200 bg-white print:rounded-none print:border-slate-400">
              <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 print:border-slate-400">
                <h2 className="text-base font-bold text-slate-900">{g.label}</h2>
                <span className={`text-xs font-semibold ${g.items.length > MAX_PER_KELOMPOK ? 'text-rose-600' : 'text-slate-500'}`}>{g.items.length} item</span>
                {g.submitted ? <Badge value="SUDAH DISERAHKAN" tone="green" /> : <Badge value="BELUM DISERAHKAN" tone="blue" />}
                {g.missingLink > 0 && <Badge value={`⚠ ${g.missingLink} tanpa link file`} tone="red" />}
                {!g.submitted && (
                  <Button size="sm" variant="primary" className="ml-auto print:hidden" onClick={() => markSubmitted(g)}>
                    Tandai sudah diserahkan
                  </Button>
                )}
              </header>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="bg-slate-50 text-left text-[11px] text-slate-600 print:bg-white">
                    <tr>
                      <th className="w-28 px-3 py-2 font-semibold">Kelompok</th>
                      <th className="px-3 py-2 font-semibold">Nama Produk</th>
                      <th className="px-3 py-2 font-semibold">Gramasi</th>
                      <th className="px-3 py-2 font-semibold">No Batch</th>
                      <th className="px-3 py-2 font-semibold">Sediaan</th>
                      <th className="px-3 py-2 font-semibold">Link File Kemasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((it) => {
                      const noLink = !(it.file_kemasan ?? '').trim();
                      return (
                        <tr key={it.id} className={`border-t border-slate-100 ${noLink ? 'bg-rose-50/70' : ''}`}>
                          <td className="px-3 py-1.5">
                            <span className="hidden print:inline">{g.label}</span>
                            <span className="print:hidden">
                              <KelompokInput item={it} onSave={(v) => patch(it.id, { kelompok_koding: v })} />
                            </span>
                          </td>
                          <td className="px-3 py-1.5 font-semibold text-slate-800">
                            <span className="mr-1.5 text-[10px] font-bold text-slate-400">{it.brand}</span>
                            {it.nama_produk}
                          </td>
                          <td className="px-3 py-1.5">{it.gramasi}</td>
                          <td className="px-3 py-1.5 tabular-nums">{it.no_batch}</td>
                          <td className="px-3 py-1.5">{it.sediaan}</td>
                          <td className="max-w-[320px] px-3 py-1.5">
                            {noLink ? (
                              <span className="font-semibold text-rose-600">⚠ Belum ada link file</span>
                            ) : (
                              <a href={it.file_kemasan!} target="_blank" rel="noreferrer" className="break-all text-sky-700 hover:underline print:text-slate-800">
                                {it.file_kemasan}
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/** Ubah kelompok manual; kosongkan untuk mengeluarkan dari kelompok. */
function KelompokInput({ item, onSave }: { item: Item; onSave: (v: string | null) => void }) {
  const [draft, setDraft] = useState(item.kelompok_koding ?? '');
  useEffect(() => setDraft(item.kelompok_koding ?? ''), [item.kelompok_koding]);
  const commit = () => {
    const v = norm(draft) || null;
    if (v !== (item.kelompok_koding ?? null)) onSave(v);
  };
  return (
    <input
        aria-label={`Kelompok ${item.nama_produk} ${item.no_batch ?? ''}`}
        list="kelompok-list"
        className="h-7 w-24 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] font-semibold uppercase focus:border-sky-400 focus:outline-none"
        placeholder="kelompok"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
  );
}
