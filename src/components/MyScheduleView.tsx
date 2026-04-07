import { useMemo, useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval } from 'date-fns';
import { t } from '@/lib/translations';
import type { Employee, EmployeeShift, StaffShiftChangeKind, StaffShiftChangeRequest } from '@/types';
import type { WeekTimeRange } from '@/lib/businessHours';
import { ScheduleTable } from '@/components/ScheduleTable';
import { ScheduleReadOnlyCalendar } from '@/components/ScheduleReadOnlyCalendar';
import { ShiftRequestDialog } from '@/components/ShiftRequestDialog';
import { useShiftChangeRequests } from '@/hooks/useShiftChangeRequests';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';

interface MyScheduleViewProps {
  shifts: EmployeeShift[];
  employees: Employee[];
  weekStart: Date;
  onWeekChange: (start: Date) => void;
  staffId: string | null;
  timeRange?: WeekTimeRange;
  onShiftsUpdated?: () => void;
}

function statusLabel(status: StaffShiftChangeRequest['status']): string {
  switch (status) {
    case 'pending':
      return t('schedule.shiftRequest.statusPending');
    case 'approved':
      return t('schedule.shiftRequest.statusApproved');
    case 'rejected':
      return t('schedule.shiftRequest.statusRejected');
    case 'cancelled':
      return t('schedule.shiftRequest.statusCancelled');
    default:
      return status;
  }
}

function ShiftRequestRow({
  request: r,
  showCancel,
  onCancel,
  demoBrowseOnly,
}: {
  request: StaffShiftChangeRequest;
  showCancel: boolean;
  onCancel?: () => void;
  demoBrowseOnly: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-lg p-3 text-sm">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={r.status === 'pending' ? 'default' : 'secondary'}>{statusLabel(r.status)}</Badge>
          <span className="text-muted-foreground">
            {r.request_kind === 'new' && t('schedule.shiftRequest.kindNew')}
            {r.request_kind === 'change' && t('schedule.shiftRequest.kindChange')}
            {r.request_kind === 'cancel' && t('schedule.shiftRequest.kindCancel')}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('schedule.shiftRequest.submittedAt')}: {format(new Date(r.created_at), 'MMM d, yyyy h:mm a')}
        </p>
        {r.status !== 'pending' && r.reviewed_at && (
          <p className="text-xs text-muted-foreground">
            {t('schedule.shiftRequest.reviewedAt')}: {format(new Date(r.reviewed_at), 'MMM d, yyyy h:mm a')}
          </p>
        )}
        {r.proposed_start_time && r.proposed_end_time && (
          <p>
            {format(new Date(r.proposed_start_time), 'MMM d, h:mm a')} –{' '}
            {format(new Date(r.proposed_end_time), 'h:mm a')}
          </p>
        )}
        {r.review_notes && <p className="text-muted-foreground text-xs">{r.review_notes}</p>}
      </div>
      {showCancel && !demoBrowseOnly && onCancel && (
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onCancel}>
          {t('schedule.shiftRequest.cancelRequest')}
        </Button>
      )}
    </div>
  );
}

export function MyScheduleView({
  shifts,
  employees,
  weekStart,
  onWeekChange,
  staffId,
  timeRange,
  onShiftsUpdated,
}: MyScheduleViewProps) {
  const demoBrowseOnly = useDemoBrowseOnly();
  const { createRequest, listMine, cancelMyRequest, error: reqError } = useShiftChangeRequests();
  const [requests, setRequests] = useState<StaffShiftChangeRequest[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestsSheetOpen, setRequestsSheetOpen] = useState(false);

  const weekEnd = endOfWeek(weekStart);
  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd]
  );

  const me = useMemo(
    () => (staffId ? employees.find((e) => e.id === staffId) ?? null : null),
    [employees, staffId]
  );

  const sortedShifts = [...shifts].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const refreshRequests = useCallback(async () => {
    const rows = await listMine();
    setRequests(rows);
  }, [listMine]);

  useEffect(() => {
    if (staffId) void refreshRequests();
  }, [staffId, refreshRequests]);

  useEffect(() => {
    if (!requestsSheetOpen || !staffId) return;
    void refreshRequests();
  }, [requestsSheetOpen, staffId, refreshRequests]);

  const pendingRequests = useMemo(
    () =>
      [...requests]
        .filter((r) => r.status === 'pending')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [requests]
  );

  const historyRequests = useMemo(
    () =>
      [...requests]
        .filter((r) => r.status !== 'pending')
        .sort((a, b) => {
          const tb = new Date(b.reviewed_at ?? b.created_at).getTime();
          const ta = new Date(a.reviewed_at ?? a.created_at).getTime();
          return tb - ta;
        }),
    [requests]
  );

  const handleSubmitRequest = async (payload: {
    kind: StaffShiftChangeKind;
    staffShiftId?: string | null;
    proposedStart?: string | null;
    proposedEnd?: string | null;
    reason: string;
  }) => {
    if (!staffId) return false;
    const row = await createRequest({
      staffId,
      kind: payload.kind,
      staffShiftId: payload.staffShiftId,
      proposedStart: payload.proposedStart,
      proposedEnd: payload.proposedEnd,
      reason: payload.reason,
    });
    if (row) {
      await refreshRequests();
      return true;
    }
    return false;
  };

  const handleCancelRequest = async (id: string) => {
    const ok = await cancelMyRequest(id);
    if (ok) await refreshRequests();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('schedule.myScheduleTitle')}</h1>
          <p className="text-muted-foreground mt-1">{t('schedule.myScheduleDescription')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => onWeekChange(subWeeks(weekStart, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[220px] text-center">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </span>
          <Button variant="outline" size="icon" onClick={() => onWeekChange(addWeeks(weekStart, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onWeekChange(startOfWeek(new Date()))}>
            {t('schedule.today')}
          </Button>
        </div>
      </div>

      {reqError && (
        <p className="text-sm text-destructive" role="alert">
          {reqError}
        </p>
      )}

      {!staffId ? (
        <p className="text-muted-foreground text-center py-8">{t('schedule.myScheduleNoStaffLink')}</p>
      ) : (
        <>
          <div className="min-w-0 space-y-2">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setRequestsSheetOpen(true)}
              >
                {t('schedule.shiftRequest.sectionTitle')}
                {pendingRequests.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-[1.25rem] justify-center px-1.5 text-xs tabular-nums"
                  >
                    {pendingRequests.length > 99 ? '99+' : pendingRequests.length}
                  </Badge>
                )}
              </Button>
            </div>
            <ScheduleTable
              shifts={shifts}
              employees={employees}
              weekDays={weekDays}
              readOnly
              singleStaffId={staffId}
              onEditShift={() => {}}
              onAddShift={() => {}}
            />
          </div>

          <Sheet open={requestsSheetOpen} onOpenChange={setRequestsSheetOpen}>
            <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
              <SheetHeader className="space-y-1 text-left">
                <SheetTitle>{t('schedule.shiftRequest.sectionTitle')}</SheetTitle>
                <SheetDescription>{t('schedule.shiftRequest.myRequests')}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
                {!demoBrowseOnly && (
                  <Button
                    type="button"
                    size="sm"
                    className="w-full shrink-0 sm:w-auto sm:self-start"
                    onClick={() => setDialogOpen(true)}
                  >
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                    {t('schedule.shiftRequest.openButton')}
                  </Button>
                )}
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {requests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('schedule.shiftRequest.noRequests')}</p>
                  ) : (
                    <Tabs defaultValue="pending" className="w-full">
                      <TabsList className="mb-3 w-full sm:w-auto">
                        <TabsTrigger value="pending" className="flex-1 gap-1.5 sm:flex-initial">
                          {t('schedule.shiftRequest.tabPending')}
                          {pendingRequests.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="h-5 min-w-[1.25rem] px-1.5 text-xs tabular-nums"
                            >
                              {pendingRequests.length > 99 ? '99+' : pendingRequests.length}
                            </Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="history" className="flex-1 sm:flex-initial">
                          {t('schedule.shiftRequest.tabHistory')}
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="pending" className="mt-0 space-y-3">
                        {pendingRequests.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t('schedule.shiftRequest.noPending')}</p>
                        ) : (
                          pendingRequests.map((r) => (
                            <ShiftRequestRow
                              key={r.id}
                              request={r}
                              showCancel
                              onCancel={() => void handleCancelRequest(r.id)}
                              demoBrowseOnly={demoBrowseOnly}
                            />
                          ))
                        )}
                      </TabsContent>
                      <TabsContent value="history" className="mt-0 space-y-3">
                        {historyRequests.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t('schedule.shiftRequest.noHistory')}</p>
                        ) : (
                          historyRequests.map((r) => (
                            <ShiftRequestRow
                              key={r.id}
                              request={r}
                              showCancel={false}
                              demoBrowseOnly={demoBrowseOnly}
                            />
                          ))
                        )}
                      </TabsContent>
                    </Tabs>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <ScheduleReadOnlyCalendar
            weekStart={weekStart}
            shifts={shifts}
            employee={me}
            timeRange={timeRange}
          />
          {sortedShifts.length === 0 && (
            <Card>
              <CardContent className="py-8">
                <p className="text-muted-foreground text-center flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  {t('schedule.noShiftsScheduled')}
                </p>
              </CardContent>
            </Card>
          )}

          <ShiftRequestDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            shifts={sortedShifts}
            onSubmit={async (payload) => {
              const ok = await handleSubmitRequest(payload);
              if (ok) onShiftsUpdated?.();
              return ok;
            }}
          />
        </>
      )}
    </div>
  );
}
