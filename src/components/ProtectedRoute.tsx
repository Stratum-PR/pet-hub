import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { setLastRoute } from '@/lib/authRouting';
import { PostLoginLoading } from '@/components/PostLoginLoading';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isAdmin, loading, profile, business } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPostLoginLoading, setShowPostLoginLoading] = useState(false);
  const [loadingStartTime] = useState(Date.now());
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const isDemoRoute = location.pathname.startsWith('/demo');
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
            if (import.meta.env.DEV) console.warn('[ProtectedRoute] Loading timeout reached');
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
  if (requireAdmin && !isAdmin) {
    if (import.meta.env.DEV) console.warn('[ProtectedRoute] Blocked admin route render', location.pathname);
    return (
      <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
        <h2 style={{ color: '#dc2626', marginBottom: 8 }}>Access Denied</h2>
        <p>You do not have permission to access this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
