import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Restricts dark theme to authenticated/dashboard areas only.
 * When user is not logged in, force light theme (public pages).
 * Theme preference is not applied across login boundary.
 */
export function ThemeGuard() {
  const { user, loading } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setTheme('light');
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [user, loading, setTheme]);

  return null;
}
