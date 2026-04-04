import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import { type Profile, type Business, isAuthLocalSignOutInProgress } from '@/lib/auth';
import { setBusinessSlugForSession, setAuthContext, AUTH_CONTEXTS } from '@/lib/authRouting';
import { staffRecordIdFromRow } from '@/lib/staffRecordCompat';
import { subscribeAuthBroadcast } from '@/lib/authBroadcast';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  business: Business | null;
  loading: boolean;
  isAdmin: boolean;
  /** Profile role: super_admin | manager | employee | client (for schedule: manager/super_admin = full calendar, employee = My schedule) */
  role: Profile['role'];
  /** Linked `staff` row for "My schedule" and clock in/out */
  staffId: string | null;
  /** @deprecated use staffId */
  employeeId: string | null;
  isImpersonating: boolean;
  impersonatingBusinessName: string | null;
  /** Re-hydrate auth state, optionally from a known Supabase user */
  refreshAuth: (userOverride?: User | null) => Promise<void>;
  /**
   * True after another tab (or broadcast) ended the session; protected routes should show login in place instead of redirecting home.
   */
  inPlaceLoginRequired: boolean;
  clearInPlaceLoginRequirement: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)),
  ]);
}

async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) throw error ?? new Error('Profile not found');
  const base = data as Profile;
  return {
    ...base,
    staff_id: staffRecordIdFromRow(data) ?? base.staff_id ?? null,
  };
}

async function fetchBusiness(businessId: string): Promise<Business> {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();
  if (error || !data) throw error ?? new Error('Business not found');
  return data as Business;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatingBusinessName, setImpersonatingBusinessName] = useState<string | null>(null);
  const [inPlaceLoginRequired, setInPlaceLoginRequired] = useState(false);
  const userRef = useRef<User | null>(null);
  userRef.current = user;
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => fetchProfile(user!.id),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: (failureCount) => failureCount < 3,
    refetchOnWindowFocus: true,
  });

  const businessId = profileQuery.data?.business_id ?? null;
  const businessQuery = useQuery({
    queryKey: ['business', businessId],
    enabled: !!businessId,
    queryFn: async () => fetchBusiness(businessId!),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: (failureCount) => failureCount < 3,
    refetchOnWindowFocus: true,
  });

  const profile = profileQuery.data ?? null;
  const business = businessQuery.data ?? null;
  const isAdmin = profile?.is_super_admin ?? false;
  const role = profile?.role ?? undefined;
  const staffId = profile?.staff_id ?? null;
  const employeeId = staffId;

  // Loading is only "blocking" until we know if a session exists.
  // Profile/business hydrate stale-while-revalidate (keep previous data on refetch failures).
  const loading = useMemo(() => {
    if (!authInitialized) return true;
    if (!user) return false;
    // If user exists but we have no profile yet and it's still fetching, block once (initial hydration only).
    if (!profile && profileQuery.isLoading) return true;
    // If profile implies a business but it's still fetching the first time, block once.
    if (!!businessId && !business && businessQuery.isLoading) return true;
    return false;
  }, [authInitialized, user, profile, profileQuery.isLoading, businessId, business, businessQuery.isLoading]);

  const clearInPlaceLoginRequirement = useCallback(() => {
    setInPlaceLoginRequired(false);
  }, []);

  const refreshAuth = async (userOverride?: User | null) => {
    console.log('[AuthContext] refreshAuth start');

    // 1) Determine effective user (never hang here; avoid infinite loading on refresh)
    let effectiveUser: User | null = userOverride ?? user ?? null;
    /** When getSession() succeeds with no session, user is logged out; skip getUser() to avoid AuthSessionMissingError noise. */
    let emptySessionFromStorage = false;
    if (!effectiveUser) {
      try {
        const { data: { session }, error: sessionError } = await withTimeout(supabase.auth.getSession(), 15000, 'auth.getSession');
        if (sessionError) console.error('[AuthContext] Error getting session:', sessionError);
        effectiveUser = session?.user ?? null;
        if (!sessionError && !session) emptySessionFromStorage = true;
      } catch (e) {
        console.warn('[AuthContext] getSession timed out/failed:', e);
      }
    }
    if (!effectiveUser && !emptySessionFromStorage) {
      try {
        const { data: { user: apiUser }, error: userError } = await withTimeout(supabase.auth.getUser(), 15000, 'auth.getUser');
        if (userError && userError.name !== 'AuthSessionMissingError') {
          console.error('[AuthContext] Error getting user:', userError);
        }
        effectiveUser = apiUser ?? null;
      } catch (e) {
        console.warn('[AuthContext] getUser timed out/failed:', e);
      }
    }

    setUser(effectiveUser);
    setAuthInitialized(true);

    if (!effectiveUser) {
      // Clear query caches on sign-out/anonymous state
      queryClient.removeQueries({ queryKey: ['profile'] });
      queryClient.removeQueries({ queryKey: ['business'] });
      console.log('[AuthContext] refreshAuth end (no user)');
      return;
    }

    setInPlaceLoginRequired(false);

    // 2) Best-effort: prefill query cache for immediate UI stability.
    // Fire-and-forget so refreshAuth returns instantly (React Query handles retries).
    const userId = effectiveUser.id;
    fetchProfile(userId)
      .then((p) => {
        queryClient.setQueryData(['profile', userId], p);
        if (p.business_id) {
          fetchBusiness(p.business_id)
            .then((b) => queryClient.setQueryData(['business', p.business_id], b))
            .catch((bizErr) => console.warn('[AuthContext] prefetchBusiness failed (non-blocking):', bizErr));
        }
      })
      .catch((profileErr) => {
        console.warn('[AuthContext] prefetchProfile failed (non-blocking):', profileErr);
      });

    // Trigger background revalidation via React Query (also non-blocking)
    queryClient.invalidateQueries({ queryKey: ['profile', userId] }).catch(() => {});

    console.log('[AuthContext] refreshAuth end');
  };

  const refreshAuthRef = useRef(refreshAuth);
  refreshAuthRef.current = refreshAuth;

  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.error('[AuthContext] Supabase not configured; skipping auth hydration.');
      setAuthInitialized(true);
      return;
    }

    console.log('[AuthContext] mount – hydrating initial session');
    refreshAuth().catch((e) => console.error('[AuthContext] initial refreshAuth failed:', e));

    // Check impersonation status
    const checkImpersonation = () => {
      if (typeof window !== 'undefined') {
        const impersonating = sessionStorage.getItem('is_impersonating') === 'true';
        setIsImpersonating(impersonating);
        if (impersonating) {
          setImpersonatingBusinessName(sessionStorage.getItem('impersonating_business_name'));
        } else {
          setImpersonatingBusinessName(null);
        }
      }
    };

    checkImpersonation();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] onAuthStateChange', {
          event,
          hasSession: !!session,
          userId: session?.user?.id,
        });

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setAuthInitialized(true);
          queryClient.removeQueries({ queryKey: ['profile'] });
          queryClient.removeQueries({ queryKey: ['business'] });
          setIsImpersonating(false);
          setImpersonatingBusinessName(null);
          if (!isAuthLocalSignOutInProgress()) {
            setInPlaceLoginRequired(true);
          }
        } else if (event === 'SIGNED_IN') {
          await refreshAuth(session?.user ?? null);
        } else if (event === 'TOKEN_REFRESHED') {
          // Don't clear UI state on refresh; just update user and let queries revalidate naturally.
          if (session?.user) setUser(session.user);
          setAuthInitialized(true);
          if (session?.user?.id) {
            queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] }).catch(() => {});
          }
        }
      }
    );

    // Listen for storage changes (for impersonation)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'is_impersonating' || e.key === 'impersonating_business_name') {
        checkImpersonation();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const unsubBroadcast = subscribeAuthBroadcast((msg) => {
      if (msg.type === 'LOGOUT') {
        setUser(null);
        setAuthInitialized(true);
        queryClient.removeQueries({ queryKey: ['profile'] });
        queryClient.removeQueries({ queryKey: ['business'] });
        setIsImpersonating(false);
        setImpersonatingBusinessName(null);
        setInPlaceLoginRequired(true);
        return;
      }
      if (msg.type === 'LOGIN') {
        void refreshAuthRef.current().catch((e) => console.warn('[AuthContext] refreshAuth after LOGIN broadcast:', e));
      }
    });

    const revalidateSessionOnFocus = async () => {
      if (!isSupabaseConfigured || document.visibilityState !== 'visible') return;
      if (!userRef.current) return;
      try {
        const { data: sessionData, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          12000,
          'auth.getSession.focus'
        );
        if (sessionError || !sessionData?.session?.user) {
          setUser(null);
          queryClient.removeQueries({ queryKey: ['profile'] });
          queryClient.removeQueries({ queryKey: ['business'] });
          setInPlaceLoginRequired(true);
          setAuthInitialized(true);
          return;
        }
        const { data: userData, error: userError } = await withTimeout(
          supabase.auth.getUser(),
          12000,
          'auth.getUser.focus'
        );
        if (userError || !userData?.user) {
          setUser(null);
          queryClient.removeQueries({ queryKey: ['profile'] });
          queryClient.removeQueries({ queryKey: ['business'] });
          setInPlaceLoginRequired(true);
          setAuthInitialized(true);
          return;
        }
        setUser(userData.user);
        void queryClient.invalidateQueries({ queryKey: ['profile', userData.user.id] }).catch(() => {});
      } catch (e) {
        console.warn('[AuthContext] focus session revalidation failed:', e);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void revalidateSessionOnFocus();
    };
    window.addEventListener('focus', onVisibility);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
      unsubBroadcast();
      window.removeEventListener('focus', onVisibility);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Keep session routing context/slug in sync when business loads.
  useEffect(() => {
    if (!business) return;
    setBusinessSlugForSession(business);
    if (typeof window !== 'undefined') {
      const demoMode = sessionStorage.getItem('demoMode') === 'true';
      const impersonating = sessionStorage.getItem('is_impersonating') === 'true';
      if (!demoMode && !impersonating) {
        setAuthContext(AUTH_CONTEXTS.BUSINESS);
      }
    }
  }, [business]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        business,
        loading,
        isAdmin,
        role,
        staffId,
        employeeId,
        isImpersonating,
        impersonatingBusinessName,
        refreshAuth,
        inPlaceLoginRequired,
        clearInPlaceLoginRequirement,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
