import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import { canonicalizeJobTitle } from '@/lib/jobTitleCanonical';
import { t } from '@/lib/translations';

/** PostgREST has no `staff_job_titles` (migrations not applied) or schema cache is stale. */
export function isStaffJobTitlesSchemaError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  if (!m.includes('staff_job_titles')) return false;
  return (
    m.includes('schema cache') ||
    m.includes('could not find the table') ||
    m.includes('could not find') ||
    (m.includes('relation') && m.includes('does not exist'))
  );
}

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
  const [jobTitlesSchemaUnavailable, setJobTitlesSchemaUnavailable] = useState(false);

  const fetchTitles = useCallback(async () => {
    if (!businessId) {
      setTitles([]);
      setJobTitlesSchemaUnavailable(false);
      setLoading(false);
      return;
    }
    setError(null);
    setJobTitlesSchemaUnavailable(false);
    if (demoBrowseOnly) {
      setTitles([]);
      setLoading(false);
      return;
    }
    const loadOrdered = async () =>
      supabase
        .from('staff_job_titles')
        .select('*')
        .eq('business_id', businessId)
        .order('title', { ascending: true });

    let { data, error: err } = await loadOrdered();
    if (!err && (data ?? []).length === 0) {
      const { error: syncErr } = await supabase.rpc('sync_staff_job_titles_from_staff_roles', {
        p_business_id: businessId,
      });
      if (!syncErr) {
        ({ data, error: err } = await loadOrdered());
      }
    }
    if (err) {
      const raw = err.message ?? 'Failed to load job titles';
      const schema = isStaffJobTitlesSchemaError(raw);
      setJobTitlesSchemaUnavailable(schema);
      setError(schema ? t('employeeManagement.jobTitlesSchemaErrorShort') : raw);
      setTitles([]);
    } else {
      setJobTitlesSchemaUnavailable(false);
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
    ): Promise<{
      row: StaffJobTitleRow | null;
      error?: 'empty' | 'duplicate' | 'other';
      message?: string;
    }> => {
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
        const raw = insErr.message || insErr.hint || '';
        if (isStaffJobTitlesSchemaError(raw)) {
          setJobTitlesSchemaUnavailable(true);
          setError(t('employeeManagement.jobTitlesSchemaErrorShort'));
        }
        return {
          row: null,
          error: 'other',
          message: isStaffJobTitlesSchemaError(raw)
            ? t('employeeManagement.jobTitlesSchemaErrorShort')
            : raw || undefined,
        };
      }
      const row = data as StaffJobTitleRow;
      setTitles((prev) => [...prev, row].sort((a, b) => a.title.localeCompare(b.title)));
      return { row };
    },
    [businessId, demoBrowseOnly, titles],
  );

  return {
    titles,
    loading,
    error,
    jobTitlesSchemaUnavailable,
    refetch: fetchTitles,
    addTitle,
  };
}
