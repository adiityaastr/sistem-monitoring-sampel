import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && anonKey);

/**
 * Klien Supabase. Bila environment variable belum diisi, aplikasi
 * menampilkan layar petunjuk konfigurasi (lihat App.tsx), jadi klien
 * ini tidak akan dipakai.
 */
export const supabase: SupabaseClient = isConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } })
  : (null as unknown as SupabaseClient);
