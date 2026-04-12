export type WaitlistLocale = 'es' | 'en';

export type WaitlistSignupResponse = {
  success?: boolean;
  alreadyRegistered?: boolean;
  waitlist_id?: string;
  /** Server-provided translation key on success or error responses. */
  messageKey?: string;
  error?: string;
};
