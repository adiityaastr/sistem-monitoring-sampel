import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchMyMembership } from '../lib/data';
import type { TeamMember } from '../lib/types';
import { Button, Field, inputCls, Spinner, errMsg } from './ui';

interface AuthState {
  session: Session;
  member: TeamMember;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth dipakai di luar AuthProvider');
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [member, setMember] = useState<TeamMember | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const email = session?.user.email;
  useEffect(() => {
    if (!email) {
      setMember(undefined);
      return;
    }
    let alive = true;
    setMember(undefined);
    fetchMyMembership(email)
      .then((m) => alive && setMember(m))
      .catch((e) => alive && setError(errMsg(e)));
    return () => {
      alive = false;
    };
  }, [email]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (session === undefined) return <Spinner />;
  if (!session) return <LoginScreen />;
  if (error) return <Centered title="Gagal memeriksa keanggotaan">{error}<SignOutLink onClick={signOut} /></Centered>;
  if (member === undefined) return <Spinner label="Memeriksa akses…" />;
  if (!member || !member.aktif) {
    return (
      <Centered title="Akun belum terdaftar">
        Anda masuk sebagai <b>{session.user.email}</b>, tetapi email ini belum terdaftar sebagai anggota tim aktif. Minta admin
        menambahkan email Anda di menu <b>Pengaturan → Anggota Tim</b>, lalu muat ulang halaman.
        <SignOutLink onClick={signOut} />
      </Centered>
    );
  }

  return <AuthCtx.Provider value={{ session, member, isAdmin: member.role === 'admin', signOut }}>{children}</AuthCtx.Provider>;
}

function SignOutLink({ onClick }: { onClick: () => void }) {
  return (
    <div className="mt-6">
      <Button onClick={onClick}>Keluar</Button>
    </div>
  );
}

export function Centered({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <Logo />
        <h1 className="mt-6 text-lg font-bold text-slate-900">{title}</h1>
        <div className="mt-2 text-sm leading-relaxed text-slate-600">{children}</div>
      </div>
    </div>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <div className="leading-tight">
        <div className="text-sm font-bold text-slate-900">Monitoring Sisipan</div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">& Sampel · EPI / AZH</div>
      </div>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'password') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        setMsg({ kind: 'ok', text: 'Link masuk sudah dikirim. Cek kotak masuk email Anda.' });
      }
    } catch (err) {
      const text = errMsg(err);
      setMsg({ kind: 'error', text: text === 'Invalid login credentials' ? 'Email atau kata sandi salah.' : text });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <Logo />
        <h1 className="mt-7 text-xl font-bold text-slate-900">Masuk</h1>
        <p className="mt-1 text-sm text-slate-500">Khusus anggota tim desain kemasan.</p>

        <div className="mt-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
          {(['password', 'magic'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md py-1.5 ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {m === 'password' ? 'Kata sandi' : 'Link email'}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Email">
            <input type="email" required autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {mode === 'password' && (
            <Field label="Kata sandi">
              <input type="password" required autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          )}
        </div>

        {msg && <p className={`mt-4 text-sm ${msg.kind === 'error' ? 'text-rose-600' : 'text-emerald-700'}`}>{msg.text}</p>}

        <Button type="submit" variant="primary" className="mt-6 w-full" disabled={busy}>
          {busy ? 'Memproses…' : mode === 'password' ? 'Masuk' : 'Kirim link masuk'}
        </Button>
      </form>
    </div>
  );
}
