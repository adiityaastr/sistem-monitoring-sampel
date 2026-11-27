import { useEffect, useRef, useState } from 'react';
import { TONE_CLASSES, toneOf } from '../lib/badge';
import { IconExternal, IconPencil, IconPlus } from './icons';

/**
 * Sel yang bisa diedit langsung. Setiap sel memanggil `onSave` dengan
 * nilai baru (null = kosong). Penyimpanan & optimistik ditangani induk.
 */

const selectBase =
  'cursor-pointer appearance-none rounded-md py-1 pl-2 pr-6 text-xs font-semibold ring-1 ring-inset transition-shadow hover:ring-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-no-repeat bg-[length:10px] bg-[right_7px_center]';
const chevron =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2364748b' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")]";

export function SelectCell({
  value,
  options,
  onSave,
  disabled,
  placeholder = '—',
  label,
}: {
  value: string | null;
  options: string[];
  onSave: (v: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  label: string;
}) {
  const v = value ?? '';
  const opts = v && !options.includes(v) ? [...options, v] : options;
  const tone = v ? TONE_CLASSES[toneOf(v)] : 'bg-white text-slate-500 ring-slate-300';
  return (
    <select
      aria-label={label}
      disabled={disabled}
      className={`${selectBase} ${chevron} ${tone} max-w-full`}
      value={v}
      onChange={(e) => onSave(e.target.value || null)}
    >
      <option value="">{placeholder}</option>
      {opts.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/**
 * Kelompok koding: hanya bisa dipilih (tidak diketik) agar penulisannya
 * selalu baku "KODING n". Nilai lama yang tidak baku tetap tampil dan
 * ditandai supaya mudah dipindahkan ke kelompok yang benar.
 */
export function KelompokSelect({
  value,
  labels,
  next,
  onSave,
  label,
  className = '',
}: {
  value: string | null;
  labels: string[];
  next: string;
  onSave: (v: string | null) => void;
  label: string;
  className?: string;
}) {
  const v = value ?? '';
  const nonStandard = v !== '' && !labels.includes(v) && v !== next;
  const tone = !v ? 'bg-white text-slate-500 ring-slate-300' : nonStandard ? TONE_CLASSES.red : TONE_CLASSES.blue;
  return (
    <select
      aria-label={label}
      title={nonStandard ? `"${v}" bukan nama kelompok baku. Pilih kelompok yang benar.` : undefined}
      className={`${selectBase} ${chevron} ${tone} max-w-full ${className}`}
      value={v}
      onChange={(e) => onSave(e.target.value || null)}
    >
      <option value="">— tanpa kelompok —</option>
      {nonStandard && <option value={v}>⚠ {v} (tidak baku)</option>}
      {labels.map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
      <option value={next}>+ {next} (kelompok baru)</option>
    </select>
  );
}

/** STATUS DESAIN: tampil hasil hitungan; pilihan mengisi status_desain_manual. */
export function DesainCell({ computed, manual, onSave, label }: { computed: string; manual: string | null; onSave: (v: string | null) => void; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <select
        aria-label={label}
        className={`${selectBase} ${chevron} ${TONE_CLASSES[toneOf(computed)]}`}
        value={manual ?? ''}
        onChange={(e) => onSave(e.target.value || null)}
        title={manual ? 'Diisi manual (override)' : 'Otomatis dari file kemasan / selesai / kebutuhan'}
      >
        <option value="">{manual ? 'OTOMATIS' : computed}</option>
        <option value="SUDAH ADA">SUDAH ADA</option>
        <option value="BELUM ADA">BELUM ADA</option>
      </select>
      {manual && (
        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-bold text-violet-800" title="Diisi manual, bukan otomatis">
          Manual
        </span>
      )}
    </div>
  );
}

export function TextCell({
  value,
  onSave,
  placeholder = '',
  className = '',
  multiline = false,
  label,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim() || null;
    if (next !== (value ?? null)) onSave(next);
  };

  if (editing) {
    const common = {
      ref,
      'aria-label': label,
      value: draft,
      onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !(multiline && e.shiftKey)) {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Escape') {
          setDraft(value ?? '');
          setEditing(false);
        }
      },
      className: 'w-full rounded-md border border-sky-500 bg-white px-2 py-1 text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-500/30',
    };
    return multiline ? <textarea rows={2} {...common} /> : <input {...common} />;
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`Ubah ${label}`}
      title="Klik untuk mengubah"
      className={`block w-full cursor-text rounded-md px-2 py-1 text-left text-[13px] leading-snug ring-inset transition-colors hover:bg-white hover:ring-1 hover:ring-slate-300 ${value ? 'text-slate-900' : 'text-slate-400'} ${className}`}
    >
      {value || placeholder || '—'}
    </button>
  );
}

export function LinkCell({ value, onSave, label }: { value: string | null; onSave: (v: string | null) => void; label: string }) {
  const [editing, setEditing] = useState(false);
  if (editing || !value) {
    return editing ? (
      <TextEditor value={value} onDone={(v) => (setEditing(false), v !== value && onSave(v))} label={label} />
    ) : (
      <button type="button" onClick={() => setEditing(true)} aria-label={`Tambah link ${label}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50">
        <IconPlus className="h-3.5 w-3.5" />
        Tambah link
      </button>
    );
  }
  const isUrl = /^https?:\/\//i.test(value);
  return (
    <div className="flex items-center gap-1">
      {isUrl ? (
        <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate rounded-md px-2 py-1 text-[13px] font-semibold text-sky-700 underline-offset-2 hover:bg-sky-50 hover:underline" title={value}>
          Buka file
          <IconExternal className="h-3.5 w-3.5" />
        </a>
      ) : (
        <span className="truncate px-2 text-[13px] text-slate-800" title={value}>
          {value}
        </span>
      )}
      <button type="button" onClick={() => setEditing(true)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800" aria-label={`Ubah ${label}`} title="Ubah link">
        <IconPencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function TextEditor({ value, onDone, label }: { value: string | null; onDone: (v: string | null) => void; label: string }) {
  const [draft, setDraft] = useState(value ?? '');
  return (
    <input
      autoFocus
      aria-label={label}
      placeholder="https://…"
      className="w-full rounded-md border border-sky-500 px-2 py-1 text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onDone(draft.trim() || null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDone(draft.trim() || null);
        if (e.key === 'Escape') onDone(value);
      }}
    />
  );
}

export function DateCell({ value, onSave, label }: { value: string | null; onSave: (v: string | null) => void; label: string }) {
  return (
    <input
      type="date"
      aria-label={label}
      className={`cursor-pointer rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] tabular-nums hover:border-slate-300 focus:border-sky-500 focus:outline-none ${value ? 'text-slate-900' : 'text-slate-400'}`}
      value={value ?? ''}
      onChange={(e) => onSave(e.target.value || null)}
    />
  );
}
