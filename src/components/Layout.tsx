import { NavLink, Outlet } from 'react-router-dom';
import { Logo, useAuth } from './AuthProvider';

const NAV = [
  { to: '/', label: 'Project', end: true },
  { to: '/koding', label: 'List Koding' },
  { to: '/sampel', label: 'Sampel Belum Ada' },
  { to: '/impor', label: 'Impor' },
  { to: '/pengaturan', label: 'Pengaturan' },
];

export function Layout() {
  const { member, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4">
          <Logo />
          <nav className="ml-4 hidden gap-1 md:flex">
            {NAV.map((n) => (
              <NavItem key={n.to} {...n} />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right text-xs leading-tight text-slate-500 sm:block">
              <span className="block font-semibold text-slate-800">{member.nama || member.email}</span>
              {member.role === 'admin' ? 'Admin' : 'Anggota'}
            </span>
            <button onClick={signOut} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
              Keluar
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5 md:hidden">
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </nav>
      </header>
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
        `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`
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
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>}
    </div>
  );
}
