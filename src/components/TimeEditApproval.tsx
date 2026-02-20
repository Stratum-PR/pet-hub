/**
 * Time Edit Approval Component
 * Manager interface for reviewing and approving/rejecting time edit requests
 */

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTimeKiosk } from '@/hooks/useTimeKiosk';
import { TimeEntryEditRequest, TimeEntry } from '@/types';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export function TimeEditApproval() {
  const { getPendingEditRequests, approveEditRequest, rejectEditRequest, loading } = useTimeKiosk();
  const [requests, setRequests] = useState<TimeEntryEditRequest[]>([]);
  const [timeEntries, setTimeEntries] = useState<Record<string, TimeEntry>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    const pendingRequests = await getPendingEditRequests();
    setRequests(pendingRequests);

    // Load time entries for each request
    const entryIds = pendingRequests.map(r => r.time_entry_id);
    if (entryIds.length > 0) {
      const { data } = await supabase
        .from('time_entries')
        .select('*')
        .in('id', entryIds);

      if (data) {
        const entriesMap: Record<string, TimeEntry> = {};
        data.forEach(entry => {
          entriesMap[entry.id] = entry as TimeEntry;
        });
        setTimeEntries(entriesMap);
      }
    }
  };

  const handleApprove = async (requestId: string) => {
    const notes = reviewNotes[requestId] || '';
    const result = await approveEditRequest(requestId, notes);
    if (result) {
      await loadRequests();
      setReviewNotes(prev => {
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
    const result = await rejectEditRequest(requestId, notes);
    if (result) {
      await loadRequests();
      setReviewNotes(prev => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    } else {
      setError('Failed to reject request');
    }
  };

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No pending edit requests</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {requests.map((request) => {
          const timeEntry = timeEntries[request.time_entry_id];
          const changes = request.requested_changes as {
            clock_in?: string;
            clock_out?: string;
            notes?: string;
          };

          return (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Edit Request #{request.id.slice(0, 8)}
                  </CardTitle>
                  <Badge variant="outline">Pending</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current vs Requested Comparison */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Current Values */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Current</h4>
                    <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                      {timeEntry && (
                        <>
                          <div>
                            <span className="text-muted-foreground">Clock In: </span>
                            {timeEntry.clock_in &&
                              format(new Date(timeEntry.clock_in), 'MMM d, h:mm a')}
                          </div>
                          {timeEntry.clock_out && (
                            <div>
                              <span className="text-muted-foreground">Clock Out: </span>
                              {format(new Date(timeEntry.clock_out), 'MMM d, h:mm a')}
                            </div>
                          )}
                          {timeEntry.notes && (
                            <div>
                              <span className="text-muted-foreground">Notes: </span>
                              {timeEntry.notes}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Requested Values */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Requested</h4>
                    <div className="p-3 bg-primary/10 rounded-lg space-y-1 text-sm">
                      {changes.clock_in && (
                        <div>
                          <span className="text-muted-foreground">Clock In: </span>
                          {format(new Date(changes.clock_in), 'MMM d, h:mm a')}
                        </div>
                      )}
                      {changes.clock_out && (
                        <div>
                          <span className="text-muted-foreground">Clock Out: </span>
                          {format(new Date(changes.clock_out), 'MMM d, h:mm a')}
                        </div>
                      )}
                      {changes.notes !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Notes: </span>
                          {changes.notes || '(empty)'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Reason</span>
                  </div>
                  <p className="text-sm">{request.reason}</p>
                </div>

                {/* Review Notes */}
                <div className="space-y-2">
                  <Label htmlFor={`notes-${request.id}`}>Review Notes (Optional)</Label>
                  <Textarea
                    id={`notes-${request.id}`}
                    value={reviewNotes[request.id] || ''}
                    onChange={(e) =>
                      setReviewNotes(prev => ({
                        ...prev,
                        [request.id]: e.target.value,
                      }))
                    }
                    placeholder="Add notes about your decision..."
                    rows={2}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleReject(request.id)}
                    disabled={loading}
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleApprove(request.id)}
                    disabled={loading}
                    className="flex-1"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

