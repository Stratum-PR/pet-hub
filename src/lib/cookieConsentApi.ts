import { waitlistFetch } from '@/lib/waitlistApi';
import { devConsole } from '@/lib/clientDebug';

export type CookieConsentPayload = {
  anonymous_id: string;
  policy_version: string;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  locale: 'en' | 'es';
};

/** Fire-and-forget audit log via Edge Function (service role insert). */
export async function postCookieConsentRecord(payload: CookieConsentPayload): Promise<void> {
  const res = await waitlistFetch('cookie-consent', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    devConsole.warn('[cookie-consent] backend record failed', res.status);
  }
}
