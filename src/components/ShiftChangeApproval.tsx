import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useShiftChangeRequests } from '@/hooks/useShiftChangeRequests';
import type { StaffShiftChangeRequest, EmployeeShift } from '@/types';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { t } from '@/lib/translations';
import { useResolvedBusinessSlug } from '@/hooks/useResolvedBusinessSlug';
import { useBusinessId } from '@/hooks/useBusinessId';

export function ShiftChangeApproval() {
  const businessId = useBusinessId();
  const businessSlug = useResolvedBusinessSlug();
  const backHref = businessSlug ? `/${businessSlug}/employee-schedule` : '/employee-schedule';
  const { listPendingForManagers, approveRequest, rejectRequest, loading, error, setError } =
    useShiftChangeRequests();
  const [requests, setRequests] = useState<StaffShiftChangeRequest[]>([]);
  const [shifts, setShifts] = useState<Record<string, EmployeeShift>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const loadRequests = useCallback(async () => {
    setError(null);
    const pending = await listPendingForManagers();
    setRequests(pending);
    const shiftIds = pending.map((r) => r.staff_shift_id).filter(Boolean) as string[];
    if (shiftIds.length > 0) {
      const { data } = await supabase.from('staff_shifts').select('*').in('id', shiftIds);
      if (data) {
        const map: Record<string, EmployeeShift> = {};
        (data as EmployeeShift[]).forEach((s) => {
          map[s.id] = s;
        });
        setShifts(map);
      }
    } else {
      setShifts({});
    }
  }, [listPendingForManagers, setError]);

  useEffect(() => {
    if (!businessId) {
      setRequests([]);
      setShifts({});
      return;
    }
    void loadRequests();
  }, [businessId, loadRequests]);

  const staffIds = useMemo(() => [...new Set(requests.map((r) => r.staff_id))], [requests]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (staffIds.length === 0) {
      setStaffNames({});
      return;
    }
    let cancelled = false;
    supabase
      .from('staff')
      .select('id, name')
      .in('id', staffIds)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const m: Record<string, string> = {};
        data.forEach((row: { id: string; name: string }) => {
          m[row.id] = row.name;
        });
        setStaffNames(m);
      });
    return () => {
      cancelled = true;
    };
  }, [staffIds.join(',')]);

  const handleApprove = async (requestId: string) => {
    const notes = reviewNotes[requestId] || '';
    const result = await approveRequest(requestId, notes);
    if (result) {
      await loadRequests();
      setReviewNotes((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    } else {
      setError('Failed to approve request');
    }
  };

  const handleReject = async (requestId: string) => {
    const notes = reviewNotes[requestId] || '';
    const result = await rejectRequest(requestId, notes);
    if (result) {
      await loadRequests();
      setReviewNotes((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    } else {
      setError('Failed to reject request');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('nav.shiftChangeRequests')}</h1>
        <Button variant="outline" size="sm" asChild>
          <Link to={backHref}>{t('schedule.shiftApproval.backToSchedule')}</Link>
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('schedule.shiftApproval.empty')}</p>
          </CardContent>
        </Card>
      ) : (
      <div className="space-y-4">
        {requests.map((request) => {
          const prev = request.staff_shift_id ? shifts[request.staff_shift_id] : undefined;
          const name = staffNames[request.staff_id] ?? request.staff_id.slice(0, 8);

          return (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="w-5 h-5 shrink-0" />
                    {name}
                  </CardTitle>
                  <Badge variant="outline">{t('schedule.shiftApproval.pending')}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm">
                  <span className="font-medium">{t('schedule.shiftApproval.kind')}: </span>
                  {request.request_kind === 'new' && t('schedule.shiftRequest.kindNew')}
                  {request.request_kind === 'change' && t('schedule.shiftRequest.kindChange')}
                  {request.request_kind === 'cancel' && t('schedule.shiftRequest.kindCancel')}
                </div>

                {prev && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <span className="font-medium">{t('schedule.shiftApproval.previousShift')}: </span>
                    {format(new Date(prev.start_time), 'MMM d, h:mm a')} –{' '}
                    {format(new Date(prev.end_time), 'h:mm a')}
                  </div>
                )}

                {(request.request_kind === 'new' || request.request_kind === 'change') &&
                  request.proposed_start_time &&
                  request.proposed_end_time && (
                    <div className="p-3 bg-primary/10 rounded-lg text-sm">
                      <span className="font-medium">{t('schedule.shiftApproval.proposed')}: </span>
                      {format(new Date(request.proposed_start_time), 'MMM d, h:mm a')} –{' '}
                      {format(new Date(request.proposed_end_time), 'h:mm a')}
                    </div>
                  )}

                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-semibold text-sm mb-1">{t('schedule.shiftRequest.reason')}</p>
                  <p className="text-sm">{request.reason}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`sr-notes-${request.id}`}>{t('schedule.shiftApproval.reviewNotes')}</Label>
                  <Textarea
                    id={`sr-notes-${request.id}`}
                    value={reviewNotes[request.id] || ''}
                    onChange={(e) =>
                      setReviewNotes((prev) => ({
                        ...prev,
                        [request.id]: e.target.value,
                      }))
                    }
                    rows={2}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => void handleReject(request.id)}
                    disabled={loading}
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {t('schedule.shiftApproval.reject')}
                  </Button>
                  <Button
                    onClick={() => void handleApprove(request.id)}
                    disabled={loading}
                    className="flex-1"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t('schedule.shiftApproval.approve')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}
    </div>
  );
}
