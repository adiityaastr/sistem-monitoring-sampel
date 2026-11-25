import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { isConfigured } from './lib/supabase';
import { AuthProvider, Centered } from './components/AuthProvider';
import { OptionsProvider } from './components/OptionsProvider';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ui';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { KodingPage } from './pages/KodingPage';
import { SamplesPage } from './pages/SamplesPage';
import { ImportPage } from './pages/ImportPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  if (!isConfigured) {
    return (
      <Centered title="Supabase belum dikonfigurasi">
        Isi environment variable <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> dan{' '}
        <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code> (file <code>.env.local</code> saat lokal, atau Site
        settings → Environment variables di Netlify), lalu build ulang. Lihat README.
      </Centered>
    );
  }
  return (
    <ToastProvider>
      <AuthProvider>
        <OptionsProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<ProjectsPage />} />
                <Route path="project/:id" element={<ProjectDetailPage />} />
                <Route path="koding" element={<KodingPage />} />
                <Route path="sampel" element={<SamplesPage />} />
                <Route path="impor" element={<ImportPage />} />
                <Route path="pengaturan" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </OptionsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
