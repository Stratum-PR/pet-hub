import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { setLastRoute, getDefaultRoute, slugify, setDemoMode } from '@/lib/authRouting';
import { authLog } from '@/lib/authDebugLog';
import { debugIngest } from '@/lib/debugIngest';
import { PostLoginLoading } from '@/components/PostLoginLoading';
import { supabase } from '@/integrations/supabase/client';
import { isImpersonating, getImpersonatingBusinessName } from '@/lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isAdmin, loading, profile, business } = useAuth();
  const location = useLocation();
  const [showPostLoginLoading, setShowPostLoginLoading] = useState(false);
  const [loadingStartTime] = useState(Date.now());
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const isDemoRoute = location.pathname.startsWith('/demo');
  // Only the demo portal is public; all real business portals (including Pet Esthetic)
  // must go through normal auth so their data is tied to the logged-in profile/business_id.
  const isPublicBusinessRoute = isDemoRoute && !requireAdmin;

  // Compute redirect declaratively so we can use <Navigate replace /> instead of navigate()
  // (imperative navigate() in effects triggers replace2 errors on refresh in react-router-dom)
  const redirectTo = useMemo(() => {
    if (loading) return null;
    if (isDemoRoute && !requireAdmin && user && business?.name) {
      const destination = getDefaultRoute({ isAdmin: false, business });
      authLog('ProtectedRoute', 'User with business on demo route, redirect to dashboard', { destination });
      return destination;
    }
    if (isPublicBusinessRoute) return null;
    if (requireAdmin && !isAdmin) {
      authLog('ProtectedRoute', 'SECURITY: Admin route accessed by non-admin, redirect to /', { path: location.pathname, userId: user?.id, isAdmin });
      return '/';
    }
    if (!requireAdmin && user && !isDemoRoute) {
      const segments = location.pathname.split('/').filter(Boolean);
      const routeSlug = segments[0];
      if (routeSlug && segments.length >= 2) {
        const impersonating = isImpersonating();
        const impersonatingName = getImpersonatingBusinessName();
        const expectedSlug = impersonating && impersonatingName
          ? slugify(impersonatingName)
          : business?.slug?.trim()
            ? slugify(business.slug.trim())
            : business?.name
              ? slugify(business.name)
              : null;
        if (expectedSlug !== null && routeSlug !== expectedSlug) {
          authLog('ProtectedRoute', 'Business slug mismatch, redirect to default', { routeSlug, expectedSlug });
          return getDefaultRoute({ isAdmin: false, business });
        }
        if (!impersonating && !business?.name && routeSlug !== 'demo') {
          authLog('ProtectedRoute', 'No business for user on business route, redirect to /', { routeSlug });
          return '/';
        }
      }
    }
    return null;
  }, [loading, user, isAdmin, requireAdmin, business, location.pathname, isPublicBusinessRoute, isDemoRoute]);

  useEffect(() => {
    authLog('ProtectedRoute', 'effect', { path: location.pathname, loading, hasUser: !!user, isAdmin, requireAdmin });
  }, [location.pathname, loading, user, isAdmin, requireAdmin]);

  // When redirecting away from demo route, clear demo mode
  useEffect(() => {
    if (redirectTo && isDemoRoute) setDemoMode(false);
  }, [redirectTo, isDemoRoute]);

  // Full-page redirect when we need to leave (Navigate replace throws replace2 in this router)
  useEffect(() => {
    if (!redirectTo) return;
    // #region agent log
    debugIngest({ location: 'ProtectedRoute.tsx:effect', message: 'window.location.replace(redirectTo)', data: { redirectTo, pathname: location.pathname }, hypothesisId: 'H6,H8' });
    // #endregion
    window.location.replace(redirectTo);
  }, [redirectTo]);

  // Persist last route for refresh/new tab restores (never store landing/login)
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (location.pathname === '/' || location.pathname.startsWith('/login')) return;
    setLastRoute(`${location.pathname}${location.search}`);
  }, [loading, user, location.pathname, location.search]);

  // Show post-login loading screen if user is logged in but data is still loading
  // CRITICAL: This useEffect must be called before any conditional returns to maintain hooks order
  useEffect(() => {
    if (user && loading && !isPublicBusinessRoute) {
      setShowPostLoginLoading(true);
    } else if (!loading || (!user && !isPublicBusinessRoute)) {
      // Hide loading after a short delay to prevent flicker
      const timer = setTimeout(() => setShowPostLoginLoading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [user, loading, isPublicBusinessRoute]);

  // CRITICAL: Double-check session before showing "Not authenticated"
  // Sometimes navigation happens before auth context is fully hydrated
  useEffect(() => {
    if (user || isPublicBusinessRoute) {
      setSessionChecked(true);
      setHasSession(true);
      return;
    }
    
    // Only check if we don't have a user yet and not loading
    if (loading) {
      return; // Wait for loading to complete
    }
    
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[ProtectedRoute] Error checking session:', error);
          setHasSession(false);
          setSessionChecked(true);
          return;
        }
        
        if (session?.user) {
          authLog('ProtectedRoute', 'Found session on re-check, waiting for AuthContext to hydrate');
          setHasSession(true);
          // Wait a bit for AuthContext to catch up (max 2 seconds)
          setTimeout(() => {
            setSessionChecked(true);
          }, 2000);
        } else {
          setHasSession(false);
          setSessionChecked(true);
        }
      } catch (err) {
        console.error('[ProtectedRoute] Exception checking session:', err);
        setHasSession(false);
        setSessionChecked(true);
      }
    };
    
    checkSession();
  }, [user, loading, isPublicBusinessRoute]);

  // Redirect is handled in useEffect (window.location.replace); show minimal UI until it happens
  if (redirectTo) {
    // #region agent log
    debugIngest({ location: 'ProtectedRoute.tsx:render', message: 'redirectTo computed', data: { redirectTo, pathname: location.pathname, hasUser: !!user, loading }, hypothesisId: 'H6,H8' });
    // #endregion
    return (
      <div style={{ padding: 16, fontFamily: 'ui-sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        Redirigiendo…
      </div>
    );
  }

  // For public business routes (demo, Pet Esthetic), always render children without auth UI states
  if (isPublicBusinessRoute) {
    return <>{children}</>;
  }

  if (loading && !isPublicBusinessRoute) {
    // Show pet-themed loading screen for post-login
    if (showPostLoginLoading && user) {
      return (
        <PostLoginLoading
          onTimeout={() => {
            // After 10 seconds, render anyway
            console.warn('[ProtectedRoute] Loading timeout reached, rendering dashboard');
          }}
          timeoutMs={10000}
        />
      );
    }
    return (
      <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
        Loading…
      </div>
    );
  }
  
  if (!user && !isPublicBusinessRoute) {
    // If we haven't checked session yet, show loading
    if (!sessionChecked || loading) {
      return (
        <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
          Verifying authentication…
        </div>
      );
    }
    
    // If session exists but user isn't set yet, show loading (AuthContext is catching up)
    if (hasSession === true) {
      return (
        <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
          Loading user session…
        </div>
      );
    }
    
    // No session found
    return (
      <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
        Not authenticated. Please go to <a href="/login">/login</a> to sign in.
      </div>
    );
  }
  // CRITICAL SECURITY: Never render admin routes for non-admin users
  if (requireAdmin && !isAdmin) {
    console.warn('[ProtectedRoute] SECURITY: Blocked admin route render', {
      path: location.pathname,
      userId: user?.id,
      isAdmin,
    });
    return (
      <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
        <h2 style={{ color: '#dc2626', marginBottom: 8 }}>Access Denied</h2>
        <p>You do not have permission to access this page.</p>
      </div>
    );
  }

  // Business slug route: do not render if user has no business and is not impersonating
  if (!requireAdmin && !isDemoRoute && user) {
    const segments = location.pathname.split('/').filter(Boolean);
    const routeSlug = segments[0];
    if (routeSlug && segments.length >= 2 && routeSlug !== 'demo') {
      const expectedSlug = business?.slug?.trim() ? slugify(business.slug.trim()) : business?.name ? slugify(business.name) : null;
      const hasAccess = isImpersonating() || (expectedSlug != null && expectedSlug === routeSlug);
      if (!hasAccess) {
        return (
          <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
            <h2 style={{ color: '#dc2626', marginBottom: 8 }}>Access Denied</h2>
            <p>You do not have access to this business.</p>
          </div>
        );
      }
    }
  }

  return <>{children}</>;
}
