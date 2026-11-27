import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteProject, fetchProject, insertItems, updateProject } from '../lib/data';
import { exportProjectXlsx } from '../lib/excelExport';
import { langkahBerikutnya, norm, STEP_ORDER } from '../lib/rules';
import { STEP_BAR } from '../lib/badge';
import { kelompokOptions } from '../lib/koding';
import { useItems } from '../lib/useItems';
import { BRANDS, type Brand, type Project } from '../lib/types';
import { PageHeader } from '../components/Layout';
import { BulkBar, ItemTable } from '../components/ItemTable';
import { RekapPanel } from '../components/RekapPanel';
import { SelectCell } from '../components/cells';
import { useOptions } from '../components/OptionsProvider';
import { useAuth } from '../components/AuthProvider';
import { Button, ErrorBox, Field, inputCls, Modal, Spinner, errMsg, useToast } from '../components/ui';
import { IconArrowLeft, IconChevronDown, IconDownload, IconExternal, IconFolder, IconPencil, IconPlus, IconSearch } from '../components/icons';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { options } = useOptions();
  const [project, setProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const { items, setItems, loading, error, reload, patch, bulk, remove } = useItems(id);
  const [search, setSearch] = useState('');
  // di HP rekap disembunyikan dulu agar tabel item langsung terlihat
  const [showRekap, setShowRekap] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 640px)').matches);
  const [addBrand, setAddBrand] = useState<Brand | null>(null);
  const [editing, setEditing] = useState(false);
  const [brandTab, setBrandTab] = useState<Brand | 'ALL'>('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    fetchProject(id).then(setProject, (e) => setProjectError(errMsg(e)));
  }, [id]);

  // pilihan kelompok koding dihitung dari semua item project (EPI + AZH)
  const kelompok = useMemo(() => kelompokOptions(items), [items]);

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
      <Link to="/" className="-ml-2 mb-1 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900 print:hidden">
        <IconArrowLeft />
        Semua project
      </Link>
      <PageHeader
        title={project.nama}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {project.link_folder_desain ? (
              <a href={project.link_folder_desain} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:underline">
                <IconFolder />
                Folder desain
                <IconExternal className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="font-medium text-rose-700">Link folder desain belum diisi</span>
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
            <Button onClick={() => setEditing(true)}>
              <IconPencil className="h-3.5 w-3.5" />
              Ubah project
            </Button>
            <Button onClick={() => exportProjectXlsx(project, items).catch((e) => toast(errMsg(e), 'error'))}>
              <IconDownload />
              Ekspor Excel
            </Button>
            <Button variant="primary" onClick={() => setAddBrand('EPI')}>
              <IconPlus />
              Tambah item
            </Button>
          </>
        }
      />

      {/* ringkasan tahap */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {STEP_ORDER.map((s) => {
          const n = stepCounts.get(s) ?? 0;
          return (
            <div key={s} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-medium leading-tight text-slate-600">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STEP_BAR[s]}`} />
                {s}
              </div>
              <div className={`mt-1 text-2xl font-bold tabular-nums ${n ? 'text-slate-900' : 'text-slate-400'}`}>{n}</div>
            </div>
          );
        })}
      </div>

      <div className="mb-4">
        <button
          className="-ml-2 mb-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900 print:hidden"
          onClick={() => setShowRekap((v) => !v)}
          aria-expanded={showRekap}
        >
          <IconChevronDown className={`h-4 w-4 transition-transform duration-200 ${showRekap ? '' : '-rotate-90'}`} />
          {showRekap ? 'Sembunyikan rekap monitoring' : 'Tampilkan rekap monitoring'}
        </button>
        {showRekap && <RekapPanel items={items} />}
      </div>

      {/* menempel tepat di bawah header; naik ke paling atas saat header disembunyikan (HP/tablet) */}
      <div className="sticky top-[var(--header-h,57px)] z-30 -mx-4 mb-3 flex items-center gap-2 bg-slate-100/95 px-4 py-2 pr-[calc(1rem+var(--nav-fab,0px))] backdrop-blur print:hidden">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            className={`${inputCls} pl-9`}
            placeholder="Cari…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cari nama produk atau no batch"
          />
        </div>
        <div className="flex shrink-0 rounded-lg bg-white p-1 text-sm font-semibold ring-1 ring-slate-200" role="group" aria-label="Tampilkan brand">
          {(['ALL', ...BRANDS] as const).map((b) => (
            <button
              key={b}
              aria-pressed={brandTab === b}
              className={`h-8 rounded-md px-2 transition-colors sm:px-3 ${brandTab === b ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              onClick={() => setBrandTab(b)}
            >
              {b === 'ALL' ? (
                <>
                  <span className="sm:hidden">Semua</span>
                  <span className="hidden sm:inline">EPI + AZH</span>
                </>
              ) : (
                b
              )}
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
                    {brand} <span className="text-sm font-medium text-slate-500">· {brandItems.length} item</span>
                  </h2>
                  <Button size="sm" variant="ghost" onClick={() => setAddBrand(brand)}>
                    <IconPlus className="h-3.5 w-3.5" />
                    Tambah item {brand}
                  </Button>
                </div>
                <ItemTable items={brandItems} search={search} onPatch={patch} selected={selected} setSelected={setSelected} kelompok={kelompok} />
              </section>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <BulkBar
          kelompok={kelompok}
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
        tanggal_diserahkan_koding: null,
        tanggal_terima_koding: null,
        tanggal_terima_produksi: null,
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
