import { supabase } from '@/integrations/supabase/client';
import { devConsole } from '@/lib/clientDebug';

export type AppointmentNotificationKind =
  | 'confirmed'
  | 'declined'
  | 'proposed_time'
  | 'rescheduled'
  | 'canceled';

export type NotifyResult = { sent: boolean; channel?: 'email' | 'sms' | 'none'; skipped?: string };

/**
 * Ask the `notify-appointment` Edge Function to tell the client (email or SMS, per the client's
 * preference). Never throws: a failed notification must not undo the staff action.
 * The staff member who made the decision is never included in the message.
 */
export async function notifyAppointmentClient(
  appointmentId: string,
  kind: AppointmentNotificationKind,
  opts?: { demo?: boolean },
): Promise<NotifyResult> {
  if (opts?.demo) return { sent: false, skipped: 'demo' };
  try {
    const { data, error } = await supabase.functions.invoke('notify-appointment', {
      body: { appointment_id: appointmentId, kind },
    });
    if (error) {
      devConsole.warn('[notifyAppointmentClient] failed', error.message);
      return { sent: false, skipped: 'error' };
    }
    const d = (data ?? {}) as { sent?: boolean; channel?: 'email' | 'sms' | 'none'; skipped?: string };
    return { sent: !!d.sent, channel: d.channel, skipped: d.skipped };
  } catch (e) {
    devConsole.warn('[notifyAppointmentClient] threw', e);
    return { sent: false, skipped: 'error' };
  }
}
