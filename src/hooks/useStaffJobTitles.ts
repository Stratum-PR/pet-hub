import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import { canonicalizeJobTitle } from '@/lib/jobTitleCanonical';

export interface StaffJobTitleRow {
  id: string;
  business_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function useStaffJobTitles() {
  const businessId = useBusinessId();
  const demoBrowseOnly = useDemoBrowseOnly();
  const [titles, setTitles] = useState<StaffJobTitleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTitles = useCallback(async () => {
    if (!businessId) {
      setTitles([]);
      setLoading(false);
      return;
    }
    setError(null);
    if (demoBrowseOnly) {
      setTitles([]);
      setLoading(false);
      return;
    }
    const { data, error: err } = await supabase
      .from('staff_job_titles')
      .select('*')
      .eq('business_id', businessId)
      .order('title', { ascending: true });
    if (err) {
      setError(err.message ?? 'Failed to load job titles');
      setTitles([]);
    } else {
      setTitles((data ?? []) as StaffJobTitleRow[]);
    }
    setLoading(false);
  }, [businessId, demoBrowseOnly]);

  useEffect(() => {
    setLoading(true);
    void fetchTitles();
  }, [fetchTitles]);

  const addTitle = useCallback(
    async (
      raw: string,
    ): Promise<{ row: StaffJobTitleRow | null; error?: 'empty' | 'duplicate' | 'other' }> => {
      const title = canonicalizeJobTitle(raw);
      if (!title) return { row: null, error: 'empty' };
      if (!businessId) return { row: null, error: 'other' };

      if (demoBrowseOnly) {
        const key = title.toLowerCase();
        const existing = titles.find((t) => t.title.toLowerCase() === key);
        if (existing) return { row: null, error: 'duplicate' };
        const now = new Date().toISOString();
        const row: StaffJobTitleRow = {
          id: crypto.randomUUID(),
          business_id: businessId,
          title,
          created_at: now,
          updated_at: now,
        };
        setTitles((prev) => [...prev, row].sort((a, b) => a.title.localeCompare(b.title)));
        return { row };
      }

      const { data, error: insErr } = await supabase
        .from('staff_job_titles')
        .insert({ business_id: businessId, title })
        .select()
        .single();

      if (insErr) {
        if (insErr.code === '23505') return { row: null, error: 'duplicate' };
        return { row: null, error: 'other' };
      }
      const row = data as StaffJobTitleRow;
      setTitles((prev) => [...prev, row].sort((a, b) => a.title.localeCompare(b.title)));
      return { row };
    },
    [businessId, demoBrowseOnly, titles],
  );

  return { titles, loading, error, refetch: fetchTitles, addTitle };
}
