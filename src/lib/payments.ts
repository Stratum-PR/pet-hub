import { supabase } from '@/integrations/supabase/client';
import { devConsole } from '@/lib/clientDebug';
import { t } from '@/lib/translations';

export type AthMode = 'off' | 'simulator' | 'live';

export interface PaymentSettings {
  canEdit: boolean;
  /** False when the project turns test mode off (PAYMENTS_SIMULATOR_ENABLED=false). */
  simulatorAllowed?: boolean;
  athmovil: { mode: AthMode; last4: string | null; webhookSubscribed: boolean };
  stripe: { connected: boolean; chargesEnabled: boolean };
}

export type PaymentStatus =
  | 'pending'
  | 'awaiting_capture'
  | 'authorizing'
  | 'succeeded'
  | 'canceled'
  | 'expired'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface PaymentAttempt {
  id: string;
  status: PaymentStatus;
  mode: 'live' | 'simulator';
  amountCents: number;
  amountPaidCents: number | null;
  receiptReference: string | null;
  phoneLast4: string | null;
  expiresAt: string | null;
  transactionId: string | null;
  appointmentId: string | null;
  createdAt: string;
}

export const ATH_MIN_CENTS = 100;
export const ATH_MAX_CENTS = 150_000;

/** Errors the payments function returns as short codes; the UI shows friendly text only. */
export function paymentErrorText(code: string | undefined): string {
  const key = `payments.err.${code ?? 'provider_error'}`;
  const text = t(key);
  return text === key ? t('payments.err.provider_error') : text;
}

/** Calls the `payments` Edge Function. Never throws; technical details go to the console only. */
export async function callPayments<T = Record<string, unknown>>(
  action: string,
  body: Record<string, unknown> = {},
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('payments', { body: { action, ...body } });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      devConsole.error(`[payments] ${action} failed`, status, error);
      return { data: null, error: status === 403 ? 'forbidden' : status === 404 ? 'not_found' : 'provider_error' };
    }
    const payload = data as (T & { error?: string }) | null;
    if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
      return { data: null, error: String(payload.error) };
    }
    return { data: payload as T, error: null };
  } catch (e) {
    devConsole.error(`[payments] ${action} threw`, e);
    return { data: null, error: 'provider_error' };
  }
}

export const isFinalPaymentStatus = (s: PaymentStatus) =>
  s === 'succeeded' || s === 'canceled' || s === 'expired' || s === 'failed' || s === 'refunded' || s === 'partially_refunded';
