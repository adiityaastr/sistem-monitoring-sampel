import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Logo, useAuth } from './AuthProvider';
import { IconChevronDown, IconLogOut, IconMenu } from './icons';

const NAV = [
  { to: '/', label: 'Project', end: true },
  { to: '/koding', label: 'List Koding' },
  { to: '/sampel', label: 'Sampel Belum Ada' },
  { to: '/impor', label: 'Impor' },
  { to: '/pengaturan', label: 'Pengaturan' },
];

const NAV_HIDDEN_KEY = 'navHidden';

function readNavHidden(): boolean {
  try {
    return localStorage.getItem(NAV_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function Layout() {
  const { member, signOut } = useAuth();
  const { pathname } = useLocation();
  const mobileNav = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // HP/tablet: header bisa disembunyikan manual; pilihan diingat di browser ini
  const [navHidden, setNavHidden] = useState(readNavHidden);
  const toggleNav = (v: boolean) => {
    setNavHidden(v);
    try {
      localStorage.setItem(NAV_HIDDEN_KEY, v ? '1' : '0');
    } catch {
      /* penyimpanan diblokir: tetap berlaku sampai halaman dimuat ulang */
    }
  };

  // HP/tablet: geser menu agar halaman aktif selalu terlihat
  useEffect(() => {
    const nav = mobileNav.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const left = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [pathname, navHidden]);

  // tinggi header yang terlihat (0 saat disembunyikan) untuk elemen yang menempel di bawahnya
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const sync = () => {
      root.style.setProperty('--header-h', `${el.offsetHeight}px`);
      // ruang di kanan atas untuk tombol "Tampilkan menu" (dipakai bar yang menempel di atas)
      root.style.setProperty('--nav-fab', el.offsetHeight === 0 ? '2.75rem' : '0px');
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [navHidden]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header ref={headerRef} className={`sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden ${navHidden ? 'max-lg:hidden' : ''}`}>
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4">
          <Logo />
          <nav className="ml-4 hidden gap-1 lg:flex" aria-label="Menu utama">
            {NAV.map((n) => (
              <NavItem key={n.to} {...n} />
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
            <span className="hidden max-w-[180px] text-right text-xs leading-tight text-slate-600 sm:block lg:hidden xl:block">
              <span className="block truncate font-semibold text-slate-800">{member.nama || member.email}</span>
              {member.role === 'admin' ? 'Admin' : 'Anggota'}
            </span>
            <button onClick={signOut} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100">
              <IconLogOut />
              <span className="hidden sm:inline">Keluar</span>
              <span className="sr-only sm:hidden">Keluar</span>
            </button>
            <button
              onClick={() => toggleNav(true)}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
              aria-label="Sembunyikan menu"
              title="Sembunyikan menu agar layar lebih lega"
            >
              <IconChevronDown className="h-5 w-5 rotate-180" />
              <span className="hidden sm:inline">Sembunyikan</span>
            </button>
          </div>
        </div>
        <nav ref={mobileNav} aria-label="Menu utama" className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5 [scrollbar-width:none] lg:hidden">
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </nav>
      </header>

      {navHidden && (
        <button
          onClick={() => toggleNav(false)}
          className="fixed right-3 top-2.5 z-50 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg ring-4 ring-white/70 transition-colors hover:bg-slate-700 lg:hidden print:hidden"
          aria-label="Tampilkan menu"
          title="Tampilkan menu"
        >
          <IconMenu className="h-5 w-5" />
        </button>
      )}

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `inline-flex h-9 items-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors duration-150 ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`
      }
    >
      {label}
    </NavLink>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <div className="mt-1.5 text-sm text-slate-600">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>}
    </div>
  );
}
