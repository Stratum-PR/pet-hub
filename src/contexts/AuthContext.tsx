import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentProfile, isSuperAdmin, Profile, Business } from '@/lib/auth';
import { setBusinessSlugForSession, setAuthContext, clearAuthContext, AUTH_CONTEXTS } from '@/lib/authRouting';
import { signOut } from '@/lib/auth';
import { authLog } from '@/lib/authDebugLog';
import { debugIngest } from '@/lib/debugIngest';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatingBusinessName, setImpersonatingBusinessName] = useState<string | null>(null);
  const refreshRunIdRef = useRef(0);

  const refreshAuth = async (userOverride?: User | null) => {
    refreshRunIdRef.current += 1;
    const myRunId = refreshRunIdRef.current;
    try {
      authLog('AuthContext', 'refreshAuth start');
      setLoading(true);

      // Prefer the user we already have from onAuthStateChange, fall back to getSession()
      let effectiveUser: User | null = userOverride ?? null;
      if (!effectiveUser) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('[AuthContext] Error getting session:', sessionError);
        }
        effectiveUser = session?.user ?? null;
      }

      authLog('AuthContext', 'effectiveUser', { hasUser: !!effectiveUser, userId: effectiveUser?.id });

      if (myRunId !== refreshRunIdRef.current) return;
      setUser(effectiveUser);

      if (!effectiveUser) {
        // #region agent log
        debugIngest({ location: 'AuthContext.tsx:refreshAuth', message: 'No user after getSession, stopping', data: { myRunId }, hypothesisId: 'H4' });
        // #endregion
        setProfile(null);
        setBusiness(null);
        setIsAdmin(false);
        setLoading(false);
        authLog('AuthContext', 'No user after getUser, stopping refreshAuth');
        return;
      }

      // Fetch profile with error handling and timeout
      try {
        const profilePromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', effectiveUser.id)
          .single();
        const profileTimeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('Profile fetch timeout') }), 5000)
        );
        
        const { data: userProfile, error: profileError } = await Promise.race([profilePromise, profileTimeoutPromise]);
        authLog('AuthContext', 'profile query result', { hasProfile: !!userProfile, error: profileError?.message || null });

        if (myRunId !== refreshRunIdRef.current) return;
        if (profileError || !userProfile) {
          // Session exists but no profile (e.g. user deleted from DB) → clear stale session and send to signup
          console.warn('[AuthContext] No profile for user (deleted or invalid account), signing out', { userId: effectiveUser.id, profileError: profileError?.message });
          setProfile(null);
          setIsAdmin(false);
          setBusiness(null);
          setUser(null);
          clearAuthContext();
          await signOut();
          if (myRunId === refreshRunIdRef.current) setLoading(false);
          if (typeof window !== 'undefined') {
            window.location.replace('/signup?reason=no-account');
          }
          return;
        }
        if (userProfile) {
          authLog('AuthContext', 'Profile fetched', { email: userProfile.email, business_id: userProfile.business_id, is_super_admin: userProfile.is_super_admin });
          setProfile(userProfile);
          const adminStatus = userProfile.is_super_admin ?? false;
          setIsAdmin(adminStatus);

          if (userProfile.business_id) {
            try {
              // Fetch business by id (avoid getCurrentBusiness() which refetches profile)
              const businessPromise = supabase
                .from('businesses')
                .select('*')
                .eq('id', userProfile.business_id)
                .maybeSingle();
              const businessTimeoutPromise = new Promise<{ data: any }>((resolve) =>
                setTimeout(() => resolve({ data: null }), 3000)
              );
              const { data: userBusiness } = await Promise.race([businessPromise, businessTimeoutPromise]) as { data: Business | null };
              if (myRunId !== refreshRunIdRef.current) return;
              authLog('AuthContext', 'Business fetched', { name: userBusiness?.name, id: userBusiness?.id });
              setBusiness(userBusiness);
              // Persist business slug for routing consistency across refresh/new tabs
              setBusinessSlugForSession(userBusiness);
              // Mark context as business unless impersonating or demo mode overrides it
              if (typeof window !== 'undefined') {
                const demoMode = sessionStorage.getItem('demoMode') === 'true';
                const impersonating = sessionStorage.getItem('is_impersonating') === 'true';
                if (!demoMode && !impersonating) {
                  setAuthContext(AUTH_CONTEXTS.BUSINESS);
                }
              }
            } catch (businessError) {
              console.error('[AuthContext] Error fetching business:', businessError);
              setBusiness(null);
            }
          } else {
            console.warn('[AuthContext] Profile has no business_id:', userProfile.email);
            setBusiness(null);
          }
        }
      } catch (profileErr) {
        console.error('Error in profile fetch:', profileErr);
        if (myRunId !== refreshRunIdRef.current) return;
        setProfile(null);
        setIsAdmin(false);
        setBusiness(null);
      }
    } catch (error: any) {
      // Ignore AbortError - it just means the request was cancelled (component unmounted, etc.)
      if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
        // Silently ignore abort errors
        setLoading(false);
        return;
      }
      
      console.error('[AuthContext] Error refreshing auth:', error);
      // On error, try to at least get the user
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user || null);
        if (!user) {
          setProfile(null);
          setBusiness(null);
          setIsAdmin(false);
        }
      } catch (err) {
        setUser(null);
        setProfile(null);
        setBusiness(null);
        setIsAdmin(false);
      }
    } finally {
      if (myRunId === refreshRunIdRef.current) setLoading(false);
      authLog('AuthContext', 'refreshAuth end');
    }
  };

  useEffect(() => {
    console.log('[AuthContext] mount – calling initial refreshAuth');
    refreshAuth();

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
        authLog('AuthContext', 'onAuthStateChange', { event, hasSession: !!session, userId: session?.user?.id });

        if (event === 'SIGNED_OUT') {
          // #region agent log
          debugIngest({ location: 'AuthContext.tsx:onAuthStateChange', message: 'SIGNED_OUT branch: clearing state', data: { event }, hypothesisId: 'H3,H4' });
          // #endregion
          setUser(null);
          setProfile(null);
          setBusiness(null);
          setIsAdmin(false);
          setIsImpersonating(false);
          setImpersonatingBusinessName(null);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // #region agent log
          debugIngest({ location: 'AuthContext.tsx:onAuthStateChange', message: 'SIGNED_IN or TOKEN_REFRESHED', data: { event, hasSession: !!session }, hypothesisId: 'H3' });
          // #endregion
          // Hydrate directly from the session user; avoid getUser() entirely.
          await refreshAuth(session?.user ?? null);
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
