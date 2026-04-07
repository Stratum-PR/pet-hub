import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import type { EmployeeShift, StaffShiftChangeRequest, StaffShiftChangeKind } from '@/types';
import { hasSameEmployeeOverlap } from '@/lib/scheduleUtils';
import { format } from 'date-fns';

export function useShiftChangeRequests() {
  const businessId = useBusinessId();
  const demoBrowseOnly = useDemoBrowseOnly();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStaffShiftsForStaff = useCallback(
    async (staffId: string): Promise<EmployeeShift[]> => {
      if (!businessId) return [];
      const { data, error: err } = await supabase
        .from('staff_shifts')
        .select('*')
        .eq('business_id', businessId)
        .eq('staff_id', staffId);
      if (err || !data) return [];
      return data as EmployeeShift[];
    },
    [businessId]
  );

  const createRequest = useCallback(
    async (payload: {
      staffId: string;
      kind: StaffShiftChangeKind;
      staffShiftId?: string | null;
      proposedStart?: string | null;
      proposedEnd?: string | null;
      reason: string;
    }): Promise<StaffShiftChangeRequest | null> => {
      if (!businessId || demoBrowseOnly) return null;
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError('Not signed in');
          return null;
        }
        const row = {
          business_id: businessId,
          staff_id: payload.staffId,
          staff_shift_id: payload.kind === 'new' ? null : payload.staffShiftId ?? null,
          request_kind: payload.kind,
          proposed_start_time: payload.proposedStart ?? null,
          proposed_end_time: payload.proposedEnd ?? null,
          reason: payload.reason.trim() || '—',
          requested_by: user.id,
          status: 'pending' as const,
        };
        const { data, error: insErr } = await supabase
          .from('staff_shift_change_requests')
          .insert(row)
          .select()
          .single();
        if (insErr || !data) {
          setError(insErr?.message ?? 'Failed to submit request');
          return null;
        }
        return data as StaffShiftChangeRequest;
      } finally {
        setLoading(false);
      }
    },
    [businessId, demoBrowseOnly]
  );

  const listMine = useCallback(async (): Promise<StaffShiftChangeRequest[]> => {
    if (!businessId) return [];
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error: err } = await supabase
      .from('staff_shift_change_requests')
      .select('*')
      .eq('business_id', businessId)
      .eq('requested_by', user.id)
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      return [];
    }
    return (data ?? []) as StaffShiftChangeRequest[];
  }, [businessId]);

  const listPendingForManagers = useCallback(async (): Promise<StaffShiftChangeRequest[]> => {
    if (!businessId) return [];
    const { data, error: err } = await supabase
      .from('staff_shift_change_requests')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      return [];
    }
    return (data ?? []) as StaffShiftChangeRequest[];
  }, [businessId]);

  const approveRequest = useCallback(
    async (requestId: string, reviewNotes?: string): Promise<StaffShiftChangeRequest | null> => {
      if (!businessId || demoBrowseOnly) return null;
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const { data: req, error: reqErr } = await supabase
          .from('staff_shift_change_requests')
          .select('*')
          .eq('id', requestId)
          .single();
        if (reqErr || !req) {
          setError(reqErr?.message ?? 'Request not found');
          return null;
        }
        const request = req as StaffShiftChangeRequest;
        if (request.status !== 'pending') {
          setError('Request is no longer pending');
          return null;
        }

        const staffShifts = await fetchStaffShiftsForStaff(request.staff_id);
        const kind = request.request_kind as StaffShiftChangeKind;

        if (kind === 'new') {
          const start = request.proposed_start_time!;
          const end = request.proposed_end_time!;
          const dayStr = format(new Date(start), 'yyyy-MM-dd');
          if (hasSameEmployeeOverlap(staffShifts, request.staff_id, dayStr, start, end)) {
            setError('Overlap with an existing shift');
            return null;
          }
          const { error: insE } = await supabase.from('staff_shifts').insert({
            business_id: businessId,
            staff_id: request.staff_id,
            start_time: start,
            end_time: end,
            notes: '',
          });
          if (insE) {
            setError(insE.message);
            return null;
          }
        } else if (kind === 'change' && request.staff_shift_id) {
          const start = request.proposed_start_time!;
          const end = request.proposed_end_time!;
          const dayStr = format(new Date(start), 'yyyy-MM-dd');
          if (
            hasSameEmployeeOverlap(staffShifts, request.staff_id, dayStr, start, end, request.staff_shift_id)
          ) {
            setError('Overlap with an existing shift');
            return null;
          }
          const { error: upE } = await supabase
            .from('staff_shifts')
            .update({ start_time: start, end_time: end })
            .eq('id', request.staff_shift_id);
          if (upE) {
            setError(upE.message);
            return null;
          }
        } else if (kind === 'cancel' && request.staff_shift_id) {
          const { error: delE } = await supabase.from('staff_shifts').delete().eq('id', request.staff_shift_id);
          if (delE) {
            setError(delE.message);
            return null;
          }
        } else {
          setError('Invalid request');
          return null;
        }

        const { data: updated, error: upReq } = await supabase
          .from('staff_shift_change_requests')
          .update({
            status: 'approved',
            reviewed_by: user?.id ?? null,
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes?.trim() || null,
          })
          .eq('id', requestId)
          .select()
          .single();

        if (upReq || !updated) {
          setError(upReq?.message ?? 'Failed to update request');
          return null;
        }
        return updated as StaffShiftChangeRequest;
      } finally {
        setLoading(false);
      }
    },
    [businessId, demoBrowseOnly, fetchStaffShiftsForStaff]
  );

  const rejectRequest = useCallback(
    async (requestId: string, reviewNotes?: string): Promise<StaffShiftChangeRequest | null> => {
      if (!businessId || demoBrowseOnly) return null;
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data, error: err } = await supabase
          .from('staff_shift_change_requests')
          .update({
            status: 'rejected',
            reviewed_by: user?.id ?? null,
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes?.trim() || null,
          })
          .eq('id', requestId)
          .select()
          .single();
        if (err || !data) {
          setError(err?.message ?? 'Failed to reject');
          return null;
        }
        return data as StaffShiftChangeRequest;
      } finally {
        setLoading(false);
      }
    },
    [businessId, demoBrowseOnly]
  );

  const cancelMyRequest = useCallback(
    async (requestId: string): Promise<boolean> => {
      if (demoBrowseOnly) return false;
      setLoading(true);
      setError(null);
      try {
        const { error: err } = await supabase
          .from('staff_shift_change_requests')
          .update({ status: 'cancelled' })
          .eq('id', requestId);
        if (err) {
          setError(err.message);
          return false;
        }
        return true;
      } finally {
        setLoading(false);
      }
    },
    [demoBrowseOnly]
  );

  return {
    loading,
    error,
    setError,
    createRequest,
    listMine,
    listPendingForManagers,
    approveRequest,
    rejectRequest,
    cancelMyRequest,
  };
}

/** Head-only count of pending shift change requests for the active business (managers). Refetches on tab focus. */
export function usePendingShiftChangeRequestCount() {
  const businessId = useBusinessId();
  const demoBrowseOnly = useDemoBrowseOnly();
  const [pendingCount, setPendingCount] = useState(0);

  const refetchPendingCount = useCallback(async () => {
    if (!businessId || demoBrowseOnly) {
      setPendingCount(0);
      return;
    }
    const { count, error } = await supabase
      .from('staff_shift_change_requests')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'pending');
    if (error) {
      setPendingCount(0);
      return;
    }
    setPendingCount(count ?? 0);
  }, [businessId, demoBrowseOnly]);

  useEffect(() => {
    void refetchPendingCount();
  }, [refetchPendingCount]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refetchPendingCount();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refetchPendingCount]);

  return { pendingCount, refetchPendingCount };
}
