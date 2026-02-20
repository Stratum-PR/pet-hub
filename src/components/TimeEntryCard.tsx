/**
 * Time Entry Card Component
 * Enhanced display of time entry with rounded times, geolocation, and edit request status
 */

import { MapPin, AlertTriangle, Clock, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TimeEntry } from '@/types';
import { format } from 'date-fns';
import { TimeEditRequestDialog } from './TimeEditRequestDialog';
import { useState } from 'react';

interface TimeEntryCardProps {
  timeEntry: TimeEntry;
  employeeName?: string;
  canEdit?: boolean;
  onEditRequested?: () => void;
}

export function TimeEntryCard({
  timeEntry,
  employeeName,
  canEdit = false,
  onEditRequested,
}: TimeEntryCardProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);

  const displayClockIn = timeEntry.rounded_clock_in
    ? new Date(timeEntry.rounded_clock_in)
    : new Date(timeEntry.clock_in);
  const displayClockOut = timeEntry.clock_out
    ? timeEntry.rounded_clock_out
      ? new Date(timeEntry.rounded_clock_out)
      : new Date(timeEntry.clock_out)
    : null;

  const hoursWorked = displayClockOut
    ? (displayClockOut.getTime() - displayClockIn.getTime()) / (1000 * 60 * 60)
    : null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {employeeName || 'Time Entry'}
            </CardTitle>
            <div className="flex items-center gap-2">
              {timeEntry.is_off_schedule && (
                <Badge variant="warning">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Off Schedule
                </Badge>
              )}
              {timeEntry.status === 'pending_edit' && (
                <Badge variant="outline">Edit Pending</Badge>
              )}
              {timeEntry.status === 'approved' && (
                <Badge variant="default">Approved</Badge>
              )}
              {timeEntry.status === 'rejected' && (
                <Badge variant="destructive">Rejected</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Clock In</div>
              <div className="font-semibold">
                {format(displayClockIn, 'MMM d, yyyy h:mm a')}
              </div>
              {timeEntry.rounded_clock_in && (
                <div className="text-xs text-muted-foreground">
                  (Rounded from {format(new Date(timeEntry.clock_in), 'h:mm a')})
                </div>
              )}
            </div>
            {displayClockOut && (
              <div>
                <div className="text-sm text-muted-foreground">Clock Out</div>
                <div className="font-semibold">
                  {format(displayClockOut, 'MMM d, yyyy h:mm a')}
                </div>
                {timeEntry.rounded_clock_out && (
                  <div className="text-xs text-muted-foreground">
                    (Rounded from {format(new Date(timeEntry.clock_out!), 'h:mm a')})
                  </div>
                )}
              </div>
            )}
          </div>

          {hoursWorked !== null && (
            <div>
              <div className="text-sm text-muted-foreground">Hours Worked</div>
              <div className="font-semibold">{hoursWorked.toFixed(2)} hours</div>
            </div>
          )}

          {timeEntry.location_latitude && timeEntry.location_longitude && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>
                {timeEntry.location_name ||
                  `${timeEntry.location_latitude.toFixed(4)}, ${timeEntry.location_longitude.toFixed(4)}`}
              </span>
            </div>
          )}

          {timeEntry.notes && (
            <div>
              <div className="text-sm text-muted-foreground">Notes</div>
              <div className="text-sm">{timeEntry.notes}</div>
            </div>
          )}

          {canEdit && timeEntry.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
              className="w-full"
            >
              <Edit className="w-4 h-4 mr-2" />
              Request Edit
            </Button>
          )}
        </CardContent>
      </Card>

      {showEditDialog && (
        <TimeEditRequestDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          timeEntry={timeEntry}
          onSuccess={() => {
            setShowEditDialog(false);
            onEditRequested?.();
          }}
        />
      )}
    </>
  );
}

