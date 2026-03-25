import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { isPublicDemoPath } from '@/lib/demoWorkspace';

/** True on demo workspace paths when there is no logged-in user — settings must not hit Supabase. */
export function useDemoLocalSettingsMode(): boolean {
  const { user } = useAuth();
  const { pathname } = useLocation();
  return isPublicDemoPath(pathname) && !user;
}
