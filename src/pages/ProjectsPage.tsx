import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createProject, fetchItems, fetchProjects } from '../lib/data';
import { langkahBerikutnya, norm, STEP_ORDER, type Step } from '../lib/rules';
import { STEP_BAR } from '../lib/badge';
import type { Item, Project } from '../lib/types';
import { PageHeader } from '../components/Layout';
import { Badge, Button, EmptyState, ErrorBox, Field, inputCls, Modal, Spinner, errMsg, useToast } from '../components/ui';
import { IconPlus } from '../components/icons';

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [hideDone, setHideDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, i] = await Promise.all([fetchProjects(), fetchItems()]);
      setProjects(p);
      setItems(i);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byProject = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of items) m.set(it.project_id, [...(m.get(it.project_id) ?? []), it]);
    return m;
  }, [items]);

  const shown = projects.filter((p) => !hideDone || norm(p.project_selesai) !== 'SUDAH');

  return (
    <>
      <PageHeader
        title="Project Sisipan"
        subtitle="Progres tiap sisipan berdasarkan langkah berikutnya per item."
        actions={
          <>
            <label className="flex h-10 cursor-pointer items-center gap-2 px-1 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 cursor-pointer rounded border-slate-400" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
              Sembunyikan yang selesai
            </label>
            <Button variant="primary" onClick={() => setShowNew(true)}>
              <IconPlus />
              Project baru
            </Button>
          </>
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : shown.length === 0 ? (
        <EmptyState title="Belum ada project">
          Buat project baru, atau impor dari file Excel lama lewat menu <Link className="font-semibold text-sky-700" to="/impor">Impor</Link>.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <ProjectCard key={p.id} project={p} items={byProject.get(p.id) ?? []} />
          ))}
        </div>
      )}

      <NewProjectModal open={showNew} onClose={() => setShowNew(false)} />
    </>
  );
}

function ProjectCard({ project, items }: { project: Project; items: Item[] }) {
  const counts = useMemo(() => {
    const c = Object.fromEntries(STEP_ORDER.map((s) => [s, 0])) as Record<Step, number>;
    for (const it of items) c[langkahBerikutnya(it)]++;
    return c;
  }, [items]);
  const total = items.length;
  const done = counts.SELESAI;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const epi = items.filter((i) => i.brand === 'EPI').length;

  return (
    <Link
      to={`/project/${project.id}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:border-sky-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-slate-900 group-hover:text-sky-800">{project.nama}</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {total} item · EPI {epi} · AZH {total - epi}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums text-slate-900">{pct}%</div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">selesai</div>
        </div>
      </div>

      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        {STEP_ORDER.map((s) => (counts[s] ? <div key={s} className={STEP_BAR[s]} style={{ width: `${(counts[s] / total) * 100}%` }} /> : null))}
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-y-1.5 text-[13px]">
        {STEP_ORDER.map((s) => (
          <div key={s} className="flex items-center justify-between gap-2">
            <dt className="flex min-w-0 items-center gap-1.5 text-slate-700">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STEP_BAR[s]}`} />
              <span className="truncate" title={s}>
                {s}
              </span>
            </dt>
            <dd className={`font-semibold tabular-nums ${counts[s] ? 'text-slate-900' : 'text-slate-400'}`}>{counts[s]}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[13px] text-slate-600">
        <span>Full cetak</span>
        <Badge value={project.full_cetak} />
        <span className="ml-2">Project selesai</span>
        <Badge value={project.project_selesai} />
      </div>
    </Link>
  );
}

function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const toast = useToast();
  const [nama, setNama] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!nama.trim()) return;
    setBusy(true);
    try {
      const p = await createProject({ nama: norm(nama), link_folder_desain: link.trim() || null });
      toast('Project dibuat');
      nav(`/project/${p.id}`);
    } catch (e) {
      toast(errMsg(e).includes('duplicate') ? 'Nama project sudah dipakai' : errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Project baru"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" disabled={busy || !nama.trim()} onClick={save}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nama project">
          <input className={inputCls} placeholder="SISIPAN 14" value={nama} onChange={(e) => setNama(e.target.value)} autoFocus />
        </Field>
        <Field label="Link folder desain">
          <input className={inputCls} placeholder="https://drive.google.com/…" value={link} onChange={(e) => setLink(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
