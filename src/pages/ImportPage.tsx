import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createProject, fetchItems, fetchProjects, fetchSamples, insertItems, insertSamples } from '../lib/data';
import { itemKey, readWorkbookFile, sampleKey, type ItemRow, type ParsedWorkbook, type SampleRow } from '../lib/excelImport';
import { batchDateLabel, langkahBerikutnya, norm } from '../lib/rules';
import type { Project } from '../lib/types';
import { PageHeader } from '../components/Layout';
import { Badge, Button, EmptyState, ErrorBox, Spinner, errMsg, useToast } from '../components/ui';

type RowStatus = 'baru' | 'ada-di-db' | 'ganda-di-file';

interface PreviewProject {
  nama: string;
  sheet: string;
  existing: Project | null;
  meta: { link_folder_desain: string | null; full_cetak: string | null; project_selesai: string | null };
  rows: { row: ItemRow; status: RowStatus }[];
  warnings: string[];
}

interface Preview {
  projects: PreviewProject[];
  samples: { row: SampleRow; status: RowStatus }[];
  sampleWarnings: string[];
  ignoredSheets: string[];
}

const STATUS_LABEL: Record<RowStatus, { text: string; tone: 'green' | 'gray' | 'yellow' }> = {
  baru: { text: 'BARU', tone: 'green' },
  'ada-di-db': { text: 'SUDAH ADA — DILEWATI', tone: 'gray' },
  'ganda-di-file': { text: 'GANDA DI FILE — DILEWATI', tone: 'yellow' },
};

async function buildPreview(parsed: ParsedWorkbook): Promise<Preview> {
  const [projects, items, samples] = await Promise.all([fetchProjects(), fetchItems(), fetchSamples()]);
  const projById = new Map(projects.map((p) => [p.id, p]));
  const projByName = new Map(projects.map((p) => [norm(p.nama), p]));
  const dbKeys = new Set(items.map((i) => itemKey(projById.get(i.project_id)?.nama ?? i.project_id, i.brand, i.no_batch, i.nama_produk)));

  const seen = new Set<string>();
  const outProjects: PreviewProject[] = parsed.projects.map((p) => ({
    nama: p.nama,
    sheet: p.sheet,
    existing: projByName.get(norm(p.nama)) ?? null,
    meta: { link_folder_desain: p.link_folder_desain, full_cetak: p.full_cetak, project_selesai: p.project_selesai },
    warnings: p.warnings,
    rows: p.items.map((row) => {
      const key = itemKey(p.nama, row.brand, row.no_batch, row.nama_produk);
      let status: RowStatus = 'baru';
      if (dbKeys.has(key)) status = 'ada-di-db';
      else if (seen.has(key)) status = 'ganda-di-file';
      seen.add(key);
      return { row, status };
    }),
  }));

  const sampleDb = new Set(samples.map((s) => sampleKey(s.brand, s.nama_produk, s.no_batch)));
  const sampleSeen = new Set<string>();
  const outSamples = parsed.samples.map((row) => {
    const key = sampleKey(row.brand, row.nama_produk, row.no_batch);
    let status: RowStatus = 'baru';
    if (sampleDb.has(key)) status = 'ada-di-db';
    else if (sampleSeen.has(key)) status = 'ganda-di-file';
    sampleSeen.add(key);
    return { row, status };
  });

  return { projects: outProjects, samples: outSamples, sampleWarnings: parsed.sampleWarnings, ignoredSheets: parsed.ignoredSheets };
}

export function ImportPage() {
  const toast = useToast();
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setResult(null);
    setError(null);
    setSkip(new Set());
    setLoading(true);
    try {
      setPreview(await buildPreview(await readWorkbookFile(file)));
    } catch (e) {
      setError(`File tidak bisa dibaca: ${errMsg(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const newItems = preview?.projects.filter((p) => !skip.has(p.sheet)).reduce((n, p) => n + p.rows.filter((r) => r.status === 'baru').length, 0) ?? 0;
  const newSamples = skip.has('__samples') ? 0 : (preview?.samples.filter((s) => s.status === 'baru').length ?? 0);

  const save = async () => {
    if (!preview) return;
    setSaving(true);
    let projCount = 0;
    let itemCount = 0;
    try {
      for (const p of preview.projects) {
        if (skip.has(p.sheet)) continue;
        const fresh = p.rows.filter((r) => r.status === 'baru').map((r) => r.row);
        if (!fresh.length && p.existing) continue;
        let project = p.existing;
        if (!project) {
          project = await createProject({
            nama: p.nama,
            link_folder_desain: p.meta.link_folder_desain,
            full_cetak: p.meta.full_cetak || 'BELUM',
            project_selesai: p.meta.project_selesai || 'BELUM',
          });
          projCount++;
        }
        const pid = project.id;
        itemCount += (await insertItems(fresh.map((r) => ({ ...r, project_id: pid })))).length;
      }
      const samples = skip.has('__samples') ? [] : preview.samples.filter((s) => s.status === 'baru').map((s) => s.row);
      const sampleCount = (await insertSamples(samples)).length;
      const msg = `Tersimpan: ${projCount} project baru, ${itemCount} item, ${sampleCount} sampel belum ada.`;
      setResult(msg);
      setPreview(null);
      toast(msg);
    } catch (e) {
      setError(`Gagal menyimpan: ${errMsg(e)}. Data yang sudah tersimpan tidak dibatalkan; impor ulang file yang sama aman karena duplikat dilewati.`);
    } finally {
      setSaving(false);
    }
  };

  const toggleSkip = (key: string) =>
    setSkip((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <>
      <PageHeader title="Impor dari Excel" subtitle="Unggah file .xlsx dari Google Sheet lama. Data diperiksa dulu sebelum disimpan." />

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-center transition hover:border-sky-400 hover:bg-sky-50/40">
        <span className="text-sm font-semibold text-slate-800">{fileName || 'Pilih file .xlsx'}</span>
        <span className="mt-1 max-w-lg text-xs text-slate-500">
          Sheet <b>PROJECT_SISIPAN_x</b> (blok EPI & AZH) menjadi project, sheet <b>SAMPLE_YANG_BELUM_ADA</b> menjadi daftar sampel. Duplikat (project + brand + no batch) otomatis dilewati.
        </span>
        <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      <div className="mt-6 space-y-6">
        {loading && <Spinner label="Membaca file…" />}
        {error && <ErrorBox message={error} />}
        {result && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {result}{' '}
            <Link to="/" className="font-semibold underline">
              Lihat project
            </Link>
          </div>
        )}

        {preview && (
          <>
            {preview.projects.length === 0 && preview.samples.length === 0 && (
              <EmptyState title="Tidak ada data yang dikenali">Pastikan nama sheet dan baris header (NAMA PRODUK, NO BATCH) sesuai format lama.</EmptyState>
            )}
            {preview.ignoredSheets.length > 0 && <p className="text-xs text-slate-500">Sheet diabaikan: {preview.ignoredSheets.join(', ')}</p>}

            {preview.projects.map((p) => (
              <PreviewSection
                key={p.sheet}
                title={p.nama}
                subtitle={
                  <>
                    Sheet {p.sheet} · {p.existing ? 'project sudah ada, item baru akan ditambahkan' : 'project baru'}
                    {p.meta.link_folder_desain && ` · folder: ${p.meta.link_folder_desain}`}
                  </>
                }
                included={!skip.has(p.sheet)}
                onToggle={() => toggleSkip(p.sheet)}
                warnings={p.warnings}
                counts={countStatus(p.rows)}
              >
                <table className="w-full min-w-[820px] text-xs">
                  <thead className="bg-slate-50 text-left text-[11px] text-slate-600">
                    <tr>
                      {['Status', 'Brand', 'Nama Produk', 'Gramasi', 'No Batch', 'Tgl Batch', 'Sediaan', 'Kebutuhan', 'Langkah'].map((h) => (
                        <th key={h} className="px-2 py-1.5 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.rows.map(({ row, status }, i) => (
                      <tr key={i} className={`border-t border-slate-100 ${status !== 'baru' ? 'text-slate-400' : ''}`}>
                        <td className="px-2 py-1">
                          <Badge value={STATUS_LABEL[status].text} tone={STATUS_LABEL[status].tone} />
                        </td>
                        <td className="px-2 py-1 font-bold">{row.brand}</td>
                        <td className="px-2 py-1 font-semibold">{row.nama_produk}</td>
                        <td className="px-2 py-1">{row.gramasi}</td>
                        <td className="px-2 py-1">{row.no_batch}</td>
                        <td className="px-2 py-1 tabular-nums">{batchDateLabel(row.no_batch) || <span className="text-rose-500">?</span>}</td>
                        <td className="px-2 py-1">{row.sediaan}</td>
                        <td className="px-2 py-1">{row.kebutuhan}</td>
                        <td className="px-2 py-1">
                          <Badge value={langkahBerikutnya(row)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PreviewSection>
            ))}

            {preview.samples.length > 0 && (
              <PreviewSection
                title="Sampel yang belum ada"
                subtitle="Sheet SAMPLE_YANG_BELUM_ADA"
                included={!skip.has('__samples')}
                onToggle={() => toggleSkip('__samples')}
                warnings={preview.sampleWarnings}
                counts={countStatus(preview.samples)}
              >
                <table className="w-full min-w-[640px] text-xs">
                  <thead className="bg-slate-50 text-left text-[11px] text-slate-600">
                    <tr>
                      {['Status', 'Brand', 'Nama Produk', 'Gramasi', 'No Batch', 'Sediaan', 'Selesai'].map((h) => (
                        <th key={h} className="px-2 py-1.5 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.samples.map(({ row, status }, i) => (
                      <tr key={i} className={`border-t border-slate-100 ${status !== 'baru' ? 'text-slate-400' : ''}`}>
                        <td className="px-2 py-1">
                          <Badge value={STATUS_LABEL[status].text} tone={STATUS_LABEL[status].tone} />
                        </td>
                        <td className="px-2 py-1 font-bold">{row.brand}</td>
                        <td className="px-2 py-1 font-semibold">{row.nama_produk}</td>
                        <td className="px-2 py-1">{row.gramasi}</td>
                        <td className="px-2 py-1">{row.no_batch}</td>
                        <td className="px-2 py-1">{row.sediaan}</td>
                        <td className="px-2 py-1">{row.selesai}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PreviewSection>
            )}

            {(preview.projects.length > 0 || preview.samples.length > 0) && (
              <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl">
                <span>
                  Akan disimpan: <b>{newItems}</b> item baru dan <b>{newSamples}</b> sampel baru.
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" className="!text-slate-300 hover:!bg-slate-800" onClick={() => setPreview(null)}>
                    Batal
                  </Button>
                  <Button variant="primary" className="!bg-sky-500 hover:!bg-sky-400" disabled={saving || newItems + newSamples === 0} onClick={save}>
                    {saving ? 'Menyimpan…' : 'Simpan ke database'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function countStatus(rows: { status: RowStatus }[]) {
  return {
    baru: rows.filter((r) => r.status === 'baru').length,
    db: rows.filter((r) => r.status === 'ada-di-db').length,
    file: rows.filter((r) => r.status === 'ganda-di-file').length,
  };
}

function PreviewSection({
  title,
  subtitle,
  included,
  onToggle,
  warnings,
  counts,
  children,
}: {
  title: string;
  subtitle: React.ReactNode;
  included: boolean;
  onToggle: () => void;
  warnings: string[];
  counts: ReturnType<typeof countStatus>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`rounded-xl border bg-white ${included ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
      <header className="flex flex-wrap items-center gap-3 px-4 py-3">
        <input type="checkbox" aria-label={`Sertakan ${title}`} className="h-4 w-4 rounded border-slate-300" checked={included} onChange={onToggle} />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge value={`${counts.baru} baru`} tone="green" />
          {counts.db > 0 && <Badge value={`${counts.db} sudah ada`} tone="gray" />}
          {counts.file > 0 && <Badge value={`${counts.file} ganda`} tone="yellow" />}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? 'Tutup' : 'Lihat baris'}
        </Button>
      </header>
      {warnings.length > 0 && (
        <ul className="mx-4 mb-3 list-disc rounded-lg bg-amber-50 py-2 pl-8 pr-3 text-xs text-amber-800">
          {warnings.slice(0, 10).map((w, i) => (
            <li key={i}>{w}</li>
          ))}
          {warnings.length > 10 && <li>…dan {warnings.length - 10} peringatan lain</li>}
        </ul>
      )}
      {open && <div className="max-h-[480px] overflow-auto border-t border-slate-100">{children}</div>}
    </section>
  );
}
