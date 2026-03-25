import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { setLastRoute } from '@/lib/authRouting';
import { PostLoginLoading } from '@/components/PostLoginLoading';
import { PawStagedLoadingFullscreen } from '@/components/PawStagedLoading';
import { supabase } from '@/integrations/supabase/client';
import { getBusinessClientLink } from '@/lib/businessClientLink';
import { fetchBusinessByPublicSlug } from '@/lib/businessSlug';
import { isPublicDemoPath } from '@/lib/demoWorkspace';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

/** No staged paw: `Index` shows the business-themed loader: avoids default `--primary` paw then a second themed paw on refresh. */
function BusinessAuthHold({ label }: { label: string }) {
  return <div className="fixed inset-0 z-50 bg-background" aria-busy="true" aria-label={label} />;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isAdmin, loading, profile, business } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { businessSlug } = useParams<{ businessSlug?: string }>();
  const [showPostLoginLoading, setShowPostLoginLoading] = useState(false);
  const [loadingStartTime] = useState(Date.now());
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [clientLinkChecked, setClientLinkChecked] = useState(false);
  const [clientLinkAllowed, setClientLinkAllowed] = useState<boolean | null>(null);

  const isDemoRoute = isPublicDemoPath(location.pathname);
  // Only the demo portal is public; all real business portals (including Pet Esthetic)
  // must go through normal auth so their data is tied to the logged-in profile/business_id.
  const isPublicBusinessRoute = isDemoRoute && !requireAdmin;

  useEffect(() => {
    // Skip auth redirects for public demo / Pet Esthetic routes
    if (isPublicBusinessRoute) return;

    if (import.meta.env.DEV) {
      console.log('[ProtectedRoute] effect', { path: location.pathname, loading, hasUser: !!user, isAdmin, requireAdmin });
    }

    if (loading) return;

    // Not logged in → force to login
    // IMPORTANT: Do NOT auto-redirect; just let the UI render a message.
    // Auto-redirects combined with async auth hydration can cause loops.

    if (requireAdmin && !isAdmin) {
      if (import.meta.env.DEV) console.warn('[ProtectedRoute] Admin route accessed by non-admin', location.pathname);
      navigate('/', { replace: true });
      return;
    }
  }, [loading, user, isAdmin, requireAdmin, location.pathname, location.search, navigate, isPublicBusinessRoute]);

  // Persist last route for refresh/new tab restores (never store landing/login)
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (location.pathname === '/' || location.pathname.startsWith('/login')) return;
    setLastRoute(`${location.pathname}${location.search}`);
  }, [loading, user, location.pathname, location.search]);

  // Client on business-scoped route: must have approved business_client_link
  useEffect(() => {
    // Public demo slug is not a real client portal — never gate or redirect to /demo/login
    if (isPublicBusinessRoute) {
      setClientLinkChecked(false);
      setClientLinkAllowed(null);
      return;
    }

    if (!user?.id || !businessSlug || profile?.business_id != null || requireAdmin) {
      if (businessSlug && user && !profile?.business_id && !requireAdmin) setClientLinkAllowed(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const biz = await fetchBusinessByPublicSlug(supabase, businessSlug);
        if (cancelled || !biz?.id) {
          setClientLinkChecked(true);
          if (!biz?.id) setClientLinkAllowed(false);
          return;
        }
        const link = await getBusinessClientLink(user.id, biz.id);
        if (cancelled) return;
        setClientLinkChecked(true);
        if (link?.status === 'approved') {
          setClientLinkAllowed(true);
        } else {
          setClientLinkAllowed(false);
        }
      } catch {
        if (!cancelled) {
          setClientLinkChecked(true);
          setClientLinkAllowed(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, businessSlug, profile?.business_id, requireAdmin, isPublicBusinessRoute]);

  useEffect(() => {
    if (isPublicBusinessRoute) return;
    if (clientLinkChecked && clientLinkAllowed === false && businessSlug) {
      navigate(`/${businessSlug}/login`, { replace: true });
    }
  }, [clientLinkChecked, clientLinkAllowed, businessSlug, navigate, isPublicBusinessRoute]);

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
          if (import.meta.env.DEV) console.error('[ProtectedRoute] Error checking session:', error);
          setHasSession(false);
          setSessionChecked(true);
          return;
        }
        
        if (session?.user) {
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
        if (import.meta.env.DEV) console.error('[ProtectedRoute] Exception checking session:', err);
        setHasSession(false);
        setSessionChecked(true);
      }
    };
    
    checkSession();
  }, [user, loading, isPublicBusinessRoute]);

  // Session storage says we're signed in but AuthContext never got a user (stale tab, refresh race, etc.) — don't leave a blank screen forever.
  useEffect(() => {
    if (isPublicBusinessRoute || user) return;
    if (!sessionChecked || hasSession !== true) return;
    const t = window.setTimeout(() => {
      navigate('/', { replace: true });
    }, 12000);
    return () => window.clearTimeout(t);
  }, [isPublicBusinessRoute, user, sessionChecked, hasSession, navigate]);

  // For public business routes (demo, Pet Esthetic), always render children without auth UI states
  if (isPublicBusinessRoute) {
    return <>{children}</>;
  }

  if (loading && !isPublicBusinessRoute) {
    if (businessSlug) {
      return <BusinessAuthHold label="Loading" />;
    }
    if (showPostLoginLoading && user) {
      return (
        <PostLoginLoading
          onTimeout={() => {
            if (import.meta.env.DEV) console.warn('[ProtectedRoute] Loading timeout reached');
          }}
          timeoutMs={10000}
        />
      );
    }
    return <PawStagedLoadingFullscreen label="Loading" />;
  }
  
  if (!user && !isPublicBusinessRoute) {
    if (!sessionChecked || loading) {
      return businessSlug ? (
        <BusinessAuthHold label="Verifying authentication" />
      ) : (
        <PawStagedLoadingFullscreen label="Verifying authentication" />
      );
    }

    if (hasSession === true) {
      return businessSlug ? (
        <BusinessAuthHold label="Loading user session" />
      ) : (
        <PawStagedLoadingFullscreen label="Loading user session" />
      );
    }
    
    // No session — send to marketing home instead of a dead-end / blank-feeling page
    return <Navigate to="/" replace />;
  }
  if (requireAdmin && !isAdmin) {
    if (import.meta.env.DEV) console.warn('[ProtectedRoute] Blocked admin route render', location.pathname);
    return (
      <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
        <h2 style={{ color: '#dc2626', marginBottom: 8 }}>Access Denied</h2>
        <p>You do not have permission to access this page.</p>
      </div>
    );
  }

  if (businessSlug && user && profile != null && profile.business_id == null && !requireAdmin && !clientLinkChecked) {
    return <BusinessAuthHold label="Verifying access" />;
  }

  return <>{children}</>;
}
