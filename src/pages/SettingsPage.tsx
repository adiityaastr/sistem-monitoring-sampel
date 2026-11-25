import { useCallback, useEffect, useState } from 'react';
import { deleteMember, deleteOption, fetchMembers, upsertMember, upsertOption } from '../lib/data';
import { norm } from '../lib/rules';
import type { MasterOption, OptionKategori, TeamMember } from '../lib/types';
import { PageHeader } from '../components/Layout';
import { KATEGORI_LABEL, SYSTEM_VALUES, useOptions } from '../components/OptionsProvider';
import { useAuth } from '../components/AuthProvider';
import { Badge, Button, ErrorBox, inputCls, Spinner, errMsg, useToast } from '../components/ui';

export function SettingsPage() {
  const { isAdmin } = useAuth();
  return (
    <>
      <PageHeader title="Pengaturan" subtitle={isAdmin ? 'Kelola pilihan dropdown dan anggota tim.' : 'Hanya admin yang dapat mengubah pengaturan.'} />
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <OptionsSection />
        <MembersSection />
      </div>
    </>
  );
}

// ------------------------------------------------------- master options

function OptionsSection() {
  const { raw, reload } = useOptions();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const kategori = Object.keys(KATEGORI_LABEL) as OptionKategori[];

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      await reload();
      if (ok) toast(ok);
    } catch (e) {
      toast(errMsg(e).includes('duplicate') ? 'Nilai itu sudah ada' : errMsg(e), 'error');
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="font-bold text-slate-900">Pilihan dropdown</h2>
        <p className="text-xs text-slate-500">
          Nilai bergembok dipakai aturan otomatis sehingga tidak bisa diubah atau dihapus. Mengganti nama pilihan tidak mengubah data lama.
        </p>
      </header>
      <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
        {kategori.map((k) => {
          const list = raw.filter((o) => o.kategori === k).sort((a, b) => a.urutan - b.urutan);
          return (
            <div key={k} className="bg-white p-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{KATEGORI_LABEL[k]}</h3>
              <ul className="space-y-1">
                {list.map((o, idx) => (
                  <OptionRow
                    key={o.id}
                    option={o}
                    locked={(SYSTEM_VALUES[k] ?? []).includes(o.nilai)}
                    canEdit={isAdmin}
                    onMove={(dir) => {
                      const other = list[idx + dir];
                      if (!other) return;
                      run(async () => {
                        await upsertOption({ ...o, urutan: other.urutan });
                        await upsertOption({ ...other, urutan: o.urutan === other.urutan ? o.urutan + dir : o.urutan });
                      });
                    }}
                    onSave={(patch) => run(() => upsertOption({ ...o, ...patch }))}
                    onDelete={() => confirm(`Hapus pilihan "${o.nilai}"?`) && run(() => deleteOption(o.id), 'Pilihan dihapus')}
                  />
                ))}
              </ul>
              {isAdmin && <AddOption onAdd={(nilai) => run(() => upsertOption({ kategori: k, nilai, urutan: (list[list.length - 1]?.urutan ?? 0) + 1, aktif: true }), 'Pilihan ditambahkan')} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OptionRow({
  option,
  locked,
  canEdit,
  onMove,
  onSave,
  onDelete,
}: {
  option: MasterOption;
  locked: boolean;
  canEdit: boolean;
  onMove: (dir: -1 | 1) => void;
  onSave: (p: Partial<MasterOption>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(option.nilai);
  useEffect(() => setDraft(option.nilai), [option.nilai]);
  const editable = canEdit && !locked;
  return (
    <li className={`flex items-center gap-1.5 ${option.aktif ? '' : 'opacity-50'}`}>
      {editable ? (
        <input
          aria-label={`Nama pilihan ${option.nilai}`}
          className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 px-2 text-xs font-semibold uppercase focus:border-sky-400 focus:outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => norm(draft) && norm(draft) !== option.nilai && onSave({ nilai: norm(draft) })}
        />
      ) : (
        <span className="flex flex-1 items-center gap-1.5 py-1">
          <Badge value={option.nilai} />
          {locked && <span title="Dipakai aturan otomatis">🔒</span>}
        </span>
      )}
      {canEdit && (
        <>
          <button className="rounded p-1 text-xs text-slate-400 hover:bg-slate-100" aria-label="Naikkan" onClick={() => onMove(-1)}>
            ↑
          </button>
          <button className="rounded p-1 text-xs text-slate-400 hover:bg-slate-100" aria-label="Turunkan" onClick={() => onMove(1)}>
            ↓
          </button>
          {!locked && (
            <>
              <button className="rounded px-1.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100" onClick={() => onSave({ aktif: !option.aktif })}>
                {option.aktif ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button className="rounded p-1 text-xs text-slate-300 hover:bg-rose-50 hover:text-rose-600" aria-label={`Hapus ${option.nilai}`} onClick={onDelete}>
                ✕
              </button>
            </>
          )}
        </>
      )}
    </li>
  );
}

function AddOption({ onAdd }: { onAdd: (v: string) => void }) {
  const [v, setV] = useState('');
  return (
    <form
      className="mt-2 flex gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (norm(v)) onAdd(norm(v));
        setV('');
      }}
    >
      <input className="h-8 min-w-0 flex-1 rounded-md border border-dashed border-slate-300 px-2 text-xs uppercase focus:border-sky-400 focus:outline-none" placeholder="Pilihan baru" value={v} onChange={(e) => setV(e.target.value)} />
      <Button size="sm" type="submit" disabled={!norm(v)}>
        Tambah
      </Button>
    </form>
  );
}

// -------------------------------------------------------------- members

function MembersSection() {
  const { isAdmin, member: me } = useAuth();
  const toast = useToast();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [nama, setNama] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');

  const load = useCallback(() => fetchMembers().then(setMembers, (e) => setError(errMsg(e))), []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      await load();
      toast(ok);
    } catch (e) {
      toast(errMsg(e).includes('duplicate') ? 'Email sudah terdaftar' : errMsg(e), 'error');
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="font-bold text-slate-900">Anggota tim</h2>
        <p className="text-xs text-slate-500">
          Hanya email terdaftar & aktif yang bisa melihat data. Setelah ditambahkan, anggota masuk lewat halaman login (pilih “Link email” bila belum punya kata sandi).
        </p>
      </header>

      {error ? (
        <div className="p-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      ) : !members ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {members.map((m) => {
            const self = m.id === me.id;
            return (
              <li key={m.id} className={`flex flex-wrap items-center gap-2 px-4 py-2.5 ${m.aktif ? '' : 'opacity-50'}`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">
                    {m.nama || m.email} {self && <span className="text-xs font-normal text-slate-400">(Anda)</span>}
                  </div>
                  <div className="truncate text-xs text-slate-500">{m.email}</div>
                </div>
                {isAdmin && !self ? (
                  <>
                    <select
                      aria-label={`Peran ${m.email}`}
                      className="h-8 rounded-md border border-slate-200 px-2 text-xs"
                      value={m.role}
                      onChange={(e) => run(() => upsertMember({ ...m, role: e.target.value as TeamMember['role'] }), 'Peran diperbarui')}
                    >
                      <option value="member">Anggota</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button size="sm" variant="ghost" onClick={() => run(() => upsertMember({ ...m, aktif: !m.aktif }), m.aktif ? 'Dinonaktifkan' : 'Diaktifkan')}>
                      {m.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                    <button
                      className="rounded p-1 text-xs text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Hapus ${m.email}`}
                      onClick={() => confirm(`Hapus ${m.email} dari tim?`) && run(() => deleteMember(m.id), 'Anggota dihapus')}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <Badge value={m.role === 'admin' ? 'ADMIN' : 'ANGGOTA'} tone={m.role === 'admin' ? 'violet' : 'gray'} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {isAdmin && (
        <form
          className="grid gap-2 border-t border-slate-100 p-4 sm:grid-cols-[2fr_1.5fr_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const em = email.trim().toLowerCase();
            if (!em) return;
            run(() => upsertMember({ email: em, nama: nama.trim() || null, role, aktif: true }), 'Anggota ditambahkan').then(() => {
              setEmail('');
              setNama('');
            });
          }}
        >
          <input type="email" required aria-label="Email anggota baru" className={inputCls} placeholder="email@perusahaan.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input aria-label="Nama anggota baru" className={inputCls} placeholder="Nama" value={nama} onChange={(e) => setNama(e.target.value)} />
          <select aria-label="Peran anggota baru" className={`${inputCls} !w-auto`} value={role} onChange={(e) => setRole(e.target.value as 'member' | 'admin')}>
            <option value="member">Anggota</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" variant="primary">
            Tambah
          </Button>
        </form>
      )}
    </section>
  );
}
