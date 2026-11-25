import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteProject, fetchProject, insertItems, updateProject } from '../lib/data';
import { exportProjectXlsx } from '../lib/excelExport';
import { langkahBerikutnya, norm, STEP_ORDER } from '../lib/rules';
import { STEP_BAR } from '../lib/badge';
import { useItems } from '../lib/useItems';
import { BRANDS, type Brand, type Project } from '../lib/types';
import { PageHeader } from '../components/Layout';
import { BulkBar, ItemTable } from '../components/ItemTable';
import { RekapPanel } from '../components/RekapPanel';
import { SelectCell } from '../components/cells';
import { useOptions } from '../components/OptionsProvider';
import { useAuth } from '../components/AuthProvider';
import { Button, ErrorBox, Field, inputCls, Modal, Spinner, errMsg, useToast } from '../components/ui';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { options } = useOptions();
  const [project, setProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const { items, setItems, loading, error, reload, patch, bulk, remove } = useItems(id);
  const [search, setSearch] = useState('');
  const [showRekap, setShowRekap] = useState(true);
  const [addBrand, setAddBrand] = useState<Brand | null>(null);
  const [editing, setEditing] = useState(false);
  const [brandTab, setBrandTab] = useState<Brand | 'ALL'>('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    fetchProject(id).then(setProject, (e) => setProjectError(errMsg(e)));
  }, [id]);

  const stepCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const it of items) c.set(langkahBerikutnya(it), (c.get(langkahBerikutnya(it)) ?? 0) + 1);
    return c;
  }, [items]);

  const saveProject = async (p: Partial<Project>) => {
    if (!project) return;
    const before = project;
    setProject({ ...project, ...p });
    try {
      setProject(await updateProject(project.id, p));
    } catch (e) {
      setProject(before);
      toast(`Gagal menyimpan: ${errMsg(e)}`, 'error');
    }
  };

  if (projectError) return <ErrorBox message={projectError} />;
  if (!project) return <Spinner />;

  return (
    <>
      <Link to="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800 print:hidden">
        ← Semua project
      </Link>
      <PageHeader
        title={project.nama}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {project.link_folder_desain ? (
              <a href={project.link_folder_desain} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 hover:underline">
                Folder desain ↗
              </a>
            ) : (
              <span className="text-rose-600">Link folder desain belum diisi</span>
            )}
            <span className="flex items-center gap-1.5">
              Full cetak
              <SelectCell label="Full cetak" value={project.full_cetak} options={options.status} onSave={(v) => saveProject({ full_cetak: v ?? 'BELUM' })} />
            </span>
            <span className="flex items-center gap-1.5">
              Project selesai
              <SelectCell label="Project selesai" value={project.project_selesai} options={options.status} onSave={(v) => saveProject({ project_selesai: v ?? 'BELUM' })} />
            </span>
          </span>
        }
        actions={
          <>
            <Button onClick={() => setEditing(true)}>Ubah project</Button>
            <Button onClick={() => exportProjectXlsx(project, items).catch((e) => toast(errMsg(e), 'error'))}>Ekspor Excel</Button>
            <Button variant="primary" onClick={() => setAddBrand('EPI')}>
              + Tambah item
            </Button>
          </>
        }
      />

      {/* ringkasan tahap */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STEP_ORDER.map((s) => (
          <div key={s} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
            <span className={`h-2 w-2 rounded-full ${STEP_BAR[s]}`} />
            <span className="text-slate-600">{s}</span>
            <span className="font-bold tabular-nums text-slate-900">{stepCounts.get(s) ?? 0}</span>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <button className="mb-2 text-xs font-semibold text-slate-500 hover:text-slate-800 print:hidden" onClick={() => setShowRekap((v) => !v)}>
          {showRekap ? '▾ Sembunyikan rekap' : '▸ Tampilkan rekap monitoring'}
        </button>
        {showRekap && <RekapPanel items={items} />}
      </div>

      <div className="sticky top-14 z-30 -mx-4 mb-3 flex flex-wrap items-center gap-2 bg-slate-100/95 px-4 py-2 backdrop-blur max-md:top-[100px] print:hidden">
        <input
          type="search"
          className={`${inputCls} max-w-sm`}
          placeholder="Cari nama produk atau no batch…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Cari nama produk atau no batch"
        />
        <div className="flex rounded-lg bg-white p-1 text-xs font-semibold ring-1 ring-slate-200">
          {(['ALL', ...BRANDS] as const).map((b) => (
            <button key={b} className={`rounded-md px-3 py-1.5 ${brandTab === b ? 'bg-slate-900 text-white' : 'text-slate-600'}`} onClick={() => setBrandTab(b)}>
              {b === 'ALL' ? 'EPI + AZH' : b}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : (
        <div className="space-y-8">
          {BRANDS.filter((b) => brandTab === 'ALL' || brandTab === b).map((brand) => {
            const brandItems = items.filter((i) => i.brand === brand);
            return (
              <section key={brand}>
                <div className="mb-2 flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-900">
                    {brand} <span className="text-sm font-medium text-slate-400">· {brandItems.length} item</span>
                  </h2>
                  <Button size="sm" variant="ghost" onClick={() => setAddBrand(brand)}>
                    + Tambah item {brand}
                  </Button>
                </div>
                <ItemTable items={brandItems} search={search} onPatch={patch} selected={selected} setSelected={setSelected} />
              </section>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onApply={(p) => bulk([...selected], p)}
          onDelete={async () => {
            if (!confirm(`Hapus ${selected.size} item terpilih? Tindakan ini tidak bisa dibatalkan.`)) return;
            await remove([...selected]);
            setSelected(new Set());
          }}
        />
      )}
      {selected.size > 0 && <div className="h-20" />}

      <AddItemModal
        brand={addBrand}
        onClose={() => setAddBrand(null)}
        onSave={async (row) => {
          const [created] = await insertItems([{ ...row, project_id: project.id }]);
          setItems((prev) => (prev.some((i) => i.id === created.id) ? prev : [...prev, created]));
          toast('Item ditambahkan');
        }}
      />
      <EditProjectModal open={editing} project={project} onClose={() => setEditing(false)} onSave={saveProject} />
    </>
  );
}

type NewItem = Parameters<typeof insertItems>[0][number];

function AddItemModal({ brand, onClose, onSave }: { brand: Brand | null; onClose: () => void; onSave: (row: Omit<NewItem, 'project_id'>) => Promise<void> }) {
  const { options } = useOptions();
  const toast = useToast();
  const [form, setForm] = useState({ brand: 'EPI' as Brand, nama_produk: '', gramasi: '', no_batch: '', sediaan: '', kebutuhan: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (brand) setForm((f) => ({ ...f, brand, no_batch: '' }));
  }, [brand]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (keepOpen: boolean) => {
    if (!form.nama_produk.trim()) return;
    setBusy(true);
    try {
      await onSave({
        brand: form.brand,
        nama_produk: form.nama_produk.trim().toUpperCase(),
        gramasi: form.gramasi.trim() || null,
        no_batch: norm(form.no_batch) || null,
        sediaan: form.sediaan || null,
        kebutuhan: form.kebutuhan || null,
        cek_kemasan: 'BELUM',
        status_desain_manual: null,
        file_kemasan: null,
        kemasan: null,
        kelompok_koding: null,
        diserahkan_ke_koding: 'BELUM',
        koding_kemasan: 'BELUM',
        diserahkan_ke_produksi: 'BELUM',
        tanggal_diserahkan: null,
        status_sampel: 'BELUM DIBUAT',
        selesai: 'BELUM',
        catatan: null,
        catatan_sampel: null,
      });
      if (keepOpen) setForm((f) => ({ ...f, no_batch: '' }));
      else onClose();
    } catch (e) {
      const m = errMsg(e);
      toast(m.includes('duplicate') ? 'No batch ini sudah ada untuk brand tersebut di project ini' : m, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={brand !== null}
      title="Tambah item"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button disabled={busy || !form.nama_produk.trim()} onClick={() => save(true)}>
            Simpan & tambah batch lain
          </Button>
          <Button variant="primary" disabled={busy || !form.nama_produk.trim()} onClick={() => save(false)}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Brand">
          <select className={inputCls} value={form.brand} onChange={set('brand')}>
            {BRANDS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Gramasi">
          <input className={inputCls} value={form.gramasi} onChange={set('gramasi')} placeholder="150 ML" />
        </Field>
        <div className="col-span-2">
          <Field label="Nama produk">
            <input className={inputCls} value={form.nama_produk} onChange={set('nama_produk')} autoFocus />
          </Field>
        </div>
        <Field label="No batch" hint="6 digit terakhir = tanggal (DDMMYY)">
          <input className={inputCls} value={form.no_batch} onChange={set('no_batch')} placeholder="SKD 130426" />
        </Field>
        <Field label="Sediaan">
          <select className={inputCls} value={form.sediaan} onChange={set('sediaan')}>
            <option value="">—</option>
            {options.sediaan.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="Kebutuhan">
            <select className={inputCls} value={form.kebutuhan} onChange={set('kebutuhan')}>
              <option value="">Belum ditentukan</option>
              {options.kebutuhan.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function EditProjectModal({ open, project, onClose, onSave }: { open: boolean; project: Project; onClose: () => void; onSave: (p: Partial<Project>) => Promise<void> }) {
  const nav = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [nama, setNama] = useState(project.nama);
  const [link, setLink] = useState(project.link_folder_desain ?? '');

  useEffect(() => {
    if (open) {
      setNama(project.nama);
      setLink(project.link_folder_desain ?? '');
    }
  }, [open, project]);

  return (
    <Modal
      open={open}
      title="Ubah project"
      onClose={onClose}
      footer={
        <>
          {isAdmin && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={async () => {
                if (!confirm(`Hapus ${project.nama} beserta SEMUA itemnya? Tindakan ini tidak bisa dibatalkan.`)) return;
                try {
                  await deleteProject(project.id);
                  toast('Project dihapus');
                  nav('/');
                } catch (e) {
                  toast(errMsg(e), 'error');
                }
              }}
            >
              Hapus project
            </Button>
          )}
          <Button onClick={onClose}>Batal</Button>
          <Button
            variant="primary"
            onClick={async () => {
              await onSave({ nama: norm(nama) || project.nama, link_folder_desain: link.trim() || null });
              onClose();
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nama project">
          <input className={inputCls} value={nama} onChange={(e) => setNama(e.target.value)} />
        </Field>
        <Field label="Link folder desain">
          <input className={inputCls} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/…" />
        </Field>
      </div>
    </Modal>
  );
}
