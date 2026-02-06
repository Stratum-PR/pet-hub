import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, Business } from '@/lib/auth';
import { setBusinessSlugForSession, setAuthContext, AUTH_CONTEXTS } from '@/lib/authRouting';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  business: Business | null;
  loading: boolean;
  isAdmin: boolean;
  isImpersonating: boolean;
  impersonatingBusinessName: string | null;
  /** Re-hydrate auth state, optionally from a known Supabase user */
  refreshAuth: (userOverride?: User | null) => Promise<void>;
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
  return data as Profile;
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

  const refreshAuth = async (userOverride?: User | null) => {
    console.log('[AuthContext] refreshAuth start');

    // 1) Determine effective user (never hang here; avoid infinite loading on refresh)
    let effectiveUser: User | null = userOverride ?? user ?? null;
    if (!effectiveUser) {
      try {
        const { data: { session }, error: sessionError } = await withTimeout(supabase.auth.getSession(), 15000, 'auth.getSession');
        if (sessionError) console.error('[AuthContext] Error getting session:', sessionError);
        effectiveUser = session?.user ?? null;
      } catch (e) {
        console.warn('[AuthContext] getSession timed out/failed:', e);
      }
    }
    if (!effectiveUser) {
      try {
        const { data: { user: apiUser }, error: userError } = await withTimeout(supabase.auth.getUser(), 15000, 'auth.getUser');
        if (userError) console.error('[AuthContext] Error getting user:', userError);
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

  useEffect(() => {
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

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
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
        isImpersonating,
        impersonatingBusinessName,
        refreshAuth,
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
