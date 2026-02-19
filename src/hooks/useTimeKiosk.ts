/**
 * Time Kiosk Hook
 * Provides functions for time kiosk operations: clock in/out, PIN verification, schedule checks, edit requests
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from './useBusinessId';
import type { Employee, TimeEntry, TimeEntryEditRequest } from '@/types';
import { useGeolocation, GeolocationPosition } from './useGeolocation';

export interface ClockInOutResult {
  success: boolean;
  action: 'clock_in' | 'clock_out';
  time_entry_id?: string;
  warning?: string | null;
  is_off_schedule?: boolean;
  schedule_info?: any;
  error?: string;
  message?: string;
}

export interface ScheduleCheckResult {
  is_scheduled: boolean;
  shift_id?: string;
  shift_start?: string;
  shift_end?: string;
  warning?: string | null;
}

export function useTimeKiosk() {
  const businessId = useBusinessId();
  const { getCurrentLocation } = useGeolocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get employee by PIN
   */
  const getEmployeeByPin = useCallback(
    async (pin: string): Promise<Employee | null> => {
      if (!businessId) {
        setError('Business ID not found');
        return null;
      }

      try {
        const { data, error: err } = await supabase
          .from('employees')
          .select('*')
          .eq('pin', pin)
          .eq('business_id', businessId)
          .eq('status', 'active')
          .single();

        if (err || !data) {
          setError(err?.message || 'Employee not found');
          return null;
        }

        return data as Employee;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get employee');
        return null;
      }
    },
    [businessId]
  );

  /**
   * Check employee schedule
   */
  const checkSchedule = useCallback(
    async (
      employeeId: string,
      clockTime?: Date
    ): Promise<ScheduleCheckResult | null> => {
      if (!businessId) {
        setError('Business ID not found');
        return null;
      }

      try {
        const timeToCheck = clockTime || new Date();
        const { data, error: err } = await supabase.rpc(
          'check_employee_schedule',
          {
            p_employee_id: employeeId,
            p_clock_time: timeToCheck.toISOString(),
          }
        );

        if (err) {
          setError(err.message);
          return null;
        }

        return data as ScheduleCheckResult;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check schedule');
        return null;
      }
    },
    [businessId]
  );

  /**
   * Clock in or out (main kiosk function)
   */
  const clockInOut = useCallback(
    async (
      pin: string,
      location?: GeolocationPosition
    ): Promise<ClockInOutResult | null> => {
      if (!businessId) {
        setError('Business ID not found');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        // Get geolocation if not provided
        let geolocation: GeolocationPosition | undefined = location;
        if (!geolocation) {
          try {
            geolocation = await getCurrentLocation();
          } catch (geoErr) {
            // Geolocation is optional, continue without it
            if (import.meta.env.DEV) {
              console.warn('Geolocation not available:', geoErr);
            }
          }
        }

        // Call the RPC function with parameterized inputs (all values are properly parameterized, not interpolated)
        // Security: All inputs are passed as parameters to Supabase RPC, which uses parameterized queries
        const locationName = geolocation
          ? `${geolocation.latitude.toFixed(6)}, ${geolocation.longitude.toFixed(6)}`
          : null;
        const { data, error: err } = await supabase.rpc('clock_in_out', {
          p_employee_pin: pin,
          p_business_id: businessId,
          p_latitude: geolocation?.latitude || null,
          p_longitude: geolocation?.longitude || null,
          p_location_name: locationName,
        });

        if (err) {
          setError(err.message);
          return {
            success: false,
            action: 'clock_in',
            error: err.message,
            message: err.message,
          };
        }

        setLoading(false);
        return data as ClockInOutResult;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to clock in/out');
        setLoading(false);
        return {
          success: false,
          action: 'clock_in',
          error: err instanceof Error ? err.message : 'Unknown error',
          message: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    },
    [businessId, getCurrentLocation]
  );

  /**
   * Request time entry edit
   */
  const requestTimeEdit = useCallback(
    async (
      timeEntryId: string,
      changes: {
        clock_in?: string;
        clock_out?: string;
        notes?: string;
      },
      reason: string
    ): Promise<TimeEntryEditRequest | null> => {
      if (!businessId) {
        setError('Business ID not found');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        // Get the time entry to find employee_id
        const { data: timeEntry, error: entryErr } = await supabase
          .from('time_entries')
          .select('employee_id')
          .eq('id', timeEntryId)
          .single();

        if (entryErr || !timeEntry) {
          setError(entryErr?.message || 'Time entry not found');
          setLoading(false);
          return null;
        }

        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Create edit request
        const { data, error: err } = await supabase
          .from('time_entry_edit_requests')
          .insert({
            time_entry_id: timeEntryId,
            employee_id: timeEntry.employee_id,
            business_id: businessId,
            requested_by: user?.id || null,
            requested_changes: changes,
            reason,
            status: 'pending',
          })
          .select()
          .single();

        if (err) {
          setError(err.message);
          setLoading(false);
          return null;
        }

        // Update time entry status
        await supabase
          .from('time_entries')
          .update({
            status: 'pending_edit',
            edit_request_id: data.id,
          })
          .eq('id', timeEntryId);

        setLoading(false);
        return data as TimeEntryEditRequest;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to request edit');
        setLoading(false);
        return null;
      }
    },
    [businessId]
  );

  /**
   * Approve time entry edit request
   */
  const approveEditRequest = useCallback(
    async (
      requestId: string,
      reviewNotes?: string
    ): Promise<TimeEntryEditRequest | null> => {
      if (!businessId) {
        setError('Business ID not found');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Get the edit request
        const { data: request, error: requestErr } = await supabase
          .from('time_entry_edit_requests')
          .select('*, time_entry_id')
          .eq('id', requestId)
          .single();

        if (requestErr || !request) {
          setError(requestErr?.message || 'Edit request not found');
          setLoading(false);
          return null;
        }

        // Update the edit request
        const { data: updatedRequest, error: updateErr } = await supabase
          .from('time_entry_edit_requests')
          .update({
            status: 'approved',
            reviewed_by: user?.id || null,
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes || null,
          })
          .eq('id', requestId)
          .select()
          .single();

        if (updateErr) {
          setError(updateErr.message);
          setLoading(false);
          return null;
        }

        // Update the time entry with requested changes
        const changes = request.requested_changes as {
          clock_in?: string;
          clock_out?: string;
          notes?: string;
        };

        const updateData: any = {
          status: 'approved',
        };

        if (changes.clock_in) updateData.clock_in = changes.clock_in;
        if (changes.clock_out) updateData.clock_out = changes.clock_out;
        if (changes.notes !== undefined) updateData.notes = changes.notes;

        // Recalculate rounded times if clock times changed
        if (changes.clock_in || changes.clock_out) {
          if (changes.clock_in) {
            const { data: roundedIn } = await supabase.rpc('round_time_to_interval', {
              p_timestamp: changes.clock_in,
              p_interval_minutes: 15,
            });
            if (roundedIn) updateData.rounded_clock_in = roundedIn;
          }
          if (changes.clock_out) {
            const { data: roundedOut } = await supabase.rpc('round_time_to_interval', {
              p_timestamp: changes.clock_out,
              p_interval_minutes: 15,
            });
            if (roundedOut) updateData.rounded_clock_out = roundedOut;
          }
        }

        await supabase
          .from('time_entries')
          .update(updateData)
          .eq('id', request.time_entry_id);

        setLoading(false);
        return updatedRequest as TimeEntryEditRequest;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to approve edit');
        setLoading(false);
        return null;
      }
    },
    [businessId]
  );

  /**
   * Reject time entry edit request
   */
  const rejectEditRequest = useCallback(
    async (
      requestId: string,
      reviewNotes?: string
    ): Promise<TimeEntryEditRequest | null> => {
      if (!businessId) {
        setError('Business ID not found');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Get the edit request
        const { data: request, error: requestErr } = await supabase
          .from('time_entry_edit_requests')
          .select('*, time_entry_id')
          .eq('id', requestId)
          .single();

        if (requestErr || !request) {
          setError(requestErr?.message || 'Edit request not found');
          setLoading(false);
          return null;
        }

        // Update the edit request
        const { data: updatedRequest, error: updateErr } = await supabase
          .from('time_entry_edit_requests')
          .update({
            status: 'rejected',
            reviewed_by: user?.id || null,
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes || null,
          })
          .eq('id', requestId)
          .select()
          .single();

        if (updateErr) {
          setError(updateErr.message);
          setLoading(false);
          return null;
        }

        // Update time entry status back to active
        await supabase
          .from('time_entries')
          .update({
            status: 'active',
            edit_request_id: null,
          })
          .eq('id', request.time_entry_id);

        setLoading(false);
        return updatedRequest as TimeEntryEditRequest;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reject edit');
        setLoading(false);
        return null;
      }
    },
    [businessId]
  );

  /**
   * Get pending edit requests (for managers)
   */
  const getPendingEditRequests = useCallback(async (): Promise<
    TimeEntryEditRequest[]
  > => {
    if (!businessId) {
      setError('Business ID not found');
      return [];
    }

    try {
      const { data, error: err } = await supabase
        .from('time_entry_edit_requests')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (err) {
        setError(err.message);
        return [];
      }

      return (data || []) as TimeEntryEditRequest[];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get edit requests');
      return [];
    }
  }, [businessId]);

  return {
    loading,
    error,
    clockInOut,
    getEmployeeByPin,
    checkSchedule,
    requestTimeEdit,
    approveEditRequest,
    rejectEditRequest,
    getPendingEditRequests,
  };
}

