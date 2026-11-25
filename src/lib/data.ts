import { supabase } from './supabase';
import type { Item, ItemInput, MasterOption, Project, SampleMissing, TeamMember } from './types';

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ------------------------------------------------------------- projects
export async function fetchProjects(): Promise<Project[]> {
  return check(await supabase.from('projects').select('*').order('created_at', { ascending: false }));
}

export async function fetchProject(id: string): Promise<Project> {
  return check(await supabase.from('projects').select('*').eq('id', id).single());
}

export async function createProject(p: Partial<Project> & { nama: string }): Promise<Project> {
  return check(await supabase.from('projects').insert(p).select().single());
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<Project> {
  return check(await supabase.from('projects').update(patch).eq('id', id).select().single());
}

export async function deleteProject(id: string): Promise<void> {
  check(await supabase.from('projects').delete().eq('id', id));
}

// ---------------------------------------------------------------- items
const PAGE = 1000;

/** Ambil semua item (dipaginasi, karena Supabase membatasi 1000 baris). */
export async function fetchItems(projectId?: string): Promise<Item[]> {
  const all: Item[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from('items').select('*').order('id').range(from, from + PAGE - 1);
    if (projectId) q = q.eq('project_id', projectId);
    const rows = check(await q) as Item[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

export async function updateItem(id: string, patch: Partial<Item>): Promise<Item> {
  return check(await supabase.from('items').update(patch).eq('id', id).select().single());
}

export async function updateItems(ids: string[], patch: Partial<Item>): Promise<Item[]> {
  if (ids.length === 0) return [];
  return check(await supabase.from('items').update(patch).in('id', ids).select());
}

export async function insertItems(rows: ItemInput[]): Promise<Item[]> {
  const out: Item[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    out.push(...(check(await supabase.from('items').insert(rows.slice(i, i + 500)).select()) as Item[]));
  }
  return out;
}

export async function deleteItems(ids: string[]): Promise<void> {
  check(await supabase.from('items').delete().in('id', ids));
}

/** Simpan kelompok koding untuk banyak item (satu query per kelompok). */
export async function assignKelompok(assignments: Map<string, string | null>): Promise<void> {
  const byLabel = new Map<string | null, string[]>();
  for (const [id, label] of assignments) byLabel.set(label, [...(byLabel.get(label) ?? []), id]);
  for (const [label, ids] of byLabel) await updateItems(ids, { kelompok_koding: label });
}

// ------------------------------------------------------- sample_missing
export async function fetchSamples(): Promise<SampleMissing[]> {
  return check(await supabase.from('sample_missing').select('*').order('nama_produk'));
}

export async function insertSamples(rows: Omit<SampleMissing, 'id'>[]): Promise<SampleMissing[]> {
  if (rows.length === 0) return [];
  return check(await supabase.from('sample_missing').insert(rows).select());
}

export async function updateSample(id: string, patch: Partial<SampleMissing>): Promise<SampleMissing> {
  return check(await supabase.from('sample_missing').update(patch).eq('id', id).select().single());
}

export async function deleteSample(id: string): Promise<void> {
  check(await supabase.from('sample_missing').delete().eq('id', id));
}

// ------------------------------------------------------- master_options
export async function fetchOptions(): Promise<MasterOption[]> {
  return check(await supabase.from('master_options').select('*').order('kategori').order('urutan'));
}

export async function upsertOption(o: Partial<MasterOption>): Promise<MasterOption> {
  return check(await supabase.from('master_options').upsert(o).select().single());
}

export async function deleteOption(id: string): Promise<void> {
  check(await supabase.from('master_options').delete().eq('id', id));
}

// --------------------------------------------------------- team_members
export async function fetchMembers(): Promise<TeamMember[]> {
  return check(await supabase.from('team_members').select('*').order('email'));
}

export async function fetchMyMembership(email: string): Promise<TeamMember | null> {
  const rows = check(await supabase.from('team_members').select('*').ilike('email', email.replace(/[%_\\]/g, '\\$&'))) as TeamMember[];
  return rows[0] ?? null;
}

export async function upsertMember(m: Partial<TeamMember>): Promise<TeamMember> {
  return check(await supabase.from('team_members').upsert(m).select().single());
}

export async function deleteMember(id: string): Promise<void> {
  check(await supabase.from('team_members').delete().eq('id', id));
}
