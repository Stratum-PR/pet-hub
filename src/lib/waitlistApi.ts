import { supabase } from '@/integrations/supabase/client';

/** Call public waitlist Edge Functions (verify_jwt=false). Uses session JWT when signed in, else anon key. */
export async function waitlistFetch(path: string, init: RequestInit): Promise<Response> {
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const { data } = await supabase.auth.getSession();
  const bearer = data.session?.access_token ?? apikey;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${path}`;
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey,
      Authorization: `Bearer ${bearer}`,
      ...(init.headers as Record<string, string>),
    },
  });
}
