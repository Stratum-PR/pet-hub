import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

/** True on /demo/* when there is no logged-in user — settings must not hit Supabase. */
export function useDemoLocalSettingsMode(): boolean {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isDemoPath = pathname === '/demo' || pathname.startsWith('/demo/');
  return isDemoPath && !user;
}
