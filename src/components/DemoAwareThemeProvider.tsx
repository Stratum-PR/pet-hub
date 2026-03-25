import { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isPublicDemoPath } from '@/lib/demoWorkspace';

const THEME_KEY_AUTH = 'pet-hub-theme';
const THEME_KEY_DEMO = 'pet-hub-theme-demo';

export function DemoAwareThemeProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isDemoPath = isPublicDemoPath(pathname);
  const storageKey = isDemoPath && !user ? THEME_KEY_DEMO : THEME_KEY_AUTH;

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey={storageKey}>
      {children}
    </ThemeProvider>
  );
}
