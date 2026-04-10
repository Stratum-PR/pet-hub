export type WaitlistLocale = 'es' | 'en';

export type WaitlistSignupResponse = {
  success?: boolean;
  alreadyRegistered?: boolean;
  waitlist_id?: string;
  messageKey?: string;
  error?: string;
};
