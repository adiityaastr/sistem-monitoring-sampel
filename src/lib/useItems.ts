import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { deleteItems, fetchItems, updateItem, updateItems } from './data';
import type { Item } from './types';
import { errMsg, useToast } from '../components/ui';

/**
 * Item satu project + simpan optimistik + realtime.
 * Perubahan dari anggota lain otomatis masuk lewat Supabase Realtime.
 */
export function useItems(projectId: string | undefined) {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchItems(projectId));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`items-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `project_id=eq.${projectId}` }, (payload) => {
        if (payload.eventType === 'DELETE') return;
        const row = payload.new as Item;
        setItems((prev) => (prev.some((i) => i.id === row.id) ? prev.map((i) => (i.id === row.id ? row : i)) : [...prev, row]));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'items' }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (id) setItems((prev) => prev.filter((i) => i.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const mergeRows = (rows: Item[]) => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    setItems((prev) => prev.map((i) => byId.get(i.id) ?? i));
  };

  const patch = useCallback(
    async (id: string, p: Partial<Item>) => {
      const before = itemsRef.current.find((i) => i.id === id);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
      try {
        mergeRows([await updateItem(id, p)]);
      } catch (e) {
        if (before) setItems((prev) => prev.map((i) => (i.id === id ? before : i)));
        toast(`Gagal menyimpan: ${errMsg(e)}`, 'error');
      }
    },
    [toast],
  );

  const bulk = useCallback(
    async (ids: string[], p: Partial<Item>) => {
      try {
        mergeRows(await updateItems(ids, p));
        toast(`${ids.length} item diperbarui`);
      } catch (e) {
        toast(`Gagal memperbarui: ${errMsg(e)}`, 'error');
        throw e;
      }
    },
    [toast],
  );

  const remove = useCallback(
    async (ids: string[]) => {
      try {
        await deleteItems(ids);
        setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
        toast(`${ids.length} item dihapus`);
      } catch (e) {
        toast(`Gagal menghapus: ${errMsg(e)}`, 'error');
      }
    },
    [toast],
  );

  return { items, setItems, loading, error, reload, patch, bulk, remove };
}
