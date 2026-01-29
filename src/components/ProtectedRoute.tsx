import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { setLastRoute } from '@/lib/authRouting';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isDemoRoute = location.pathname.startsWith('/demo');
  // Only the demo portal is public; all real business portals (including Pet Esthetic)
  // must go through normal auth so their data is tied to the logged-in profile/business_id.
  const isPublicBusinessRoute = isDemoRoute && !requireAdmin;

  useEffect(() => {
    // Skip auth redirects for public demo / Pet Esthetic routes
    if (isPublicBusinessRoute) return;

    console.log('[ProtectedRoute] effect', {
      path: location.pathname,
      loading,
      hasUser: !!user,
      isAdmin,
      requireAdmin,
    });

    // CRITICAL: Wait for loading to complete before making any redirect decisions
    if (loading) {
      console.log('[ProtectedRoute] Still loading auth, waiting...');
      return;
    }

    // Not logged in → force to login
    // IMPORTANT: Do NOT auto-redirect; just let the UI render a message.
    // Auto-redirects combined with async auth hydration can cause loops.

    // Logged in but needs admin → block
    if (requireAdmin && !isAdmin) {
      console.log('[ProtectedRoute] Admin required but user is not admin, redirecting...');
      navigate('/', { replace: true });
    }
  }, [loading, user, isAdmin, requireAdmin, location.pathname, location.search, navigate, isPublicBusinessRoute]);

  // Persist last route for refresh/new tab restores (never store landing/login)
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (location.pathname === '/' || location.pathname.startsWith('/login')) return;
    setLastRoute(`${location.pathname}${location.search}`);
  }, [loading, user, location.pathname, location.search]);

  // For public business routes (demo, Pet Esthetic), always render children without auth UI states
  if (isPublicBusinessRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
        Loading…
      </div>
    );
  }
  if (!user) {
    return (
      <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
        Not authenticated. Please go to <a href="/login">/login</a> to sign in.
      </div>
    );
  }
  if (requireAdmin && !isAdmin) {
    return (
      <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
        Not authorized.
      </div>
    );
  }

  return <>{children}</>;
}
