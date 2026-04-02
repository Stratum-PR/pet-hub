import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const RAW_URL = import.meta.env.VITE_SUPABASE_URL;
const RAW_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** True when real project URL and anon key were present at build time (Vite inlines `import.meta.env`). */
export const isSupabaseConfigured = Boolean(
  (typeof RAW_URL === 'string' && RAW_URL.trim()) &&
    (typeof RAW_KEY === 'string' && RAW_KEY.trim())
);

// Valid placeholders so createClient never throws; real requests fail until env is set on the host.
const SUPABASE_URL = isSupabaseConfigured ? RAW_URL!.trim() : 'https://env-not-configured.invalid/';
const SUPABASE_PUBLISHABLE_KEY = isSupabaseConfigured ? RAW_KEY!.trim() : 'unconfigured';

if (!isSupabaseConfigured) {
  const devHint = `
Missing Supabase env vars. Add to .env.local:
  VITE_SUPABASE_URL=…
  VITE_SUPABASE_PUBLISHABLE_KEY=…
Then restart the dev server.`;
  const prodHint =
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY at build time. Set them in your deployment environment and redeploy.';
  console.error(import.meta.env.DEV ? devHint : prodHint);
}

// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  }
});

// Suppress AbortError warnings - these are harmless and occur during navigation
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    if (message.includes('AbortError') && message.includes('signal is aborted')) {
      // Silently ignore AbortErrors from Supabase
      return;
    }
    originalConsoleError.apply(console, args);
  };
}