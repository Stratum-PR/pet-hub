import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentProfile, getCurrentBusiness, isSuperAdmin, Profile, Business } from '@/lib/auth';

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

  const refreshAuth = async (userOverride?: User | null) => {
    try {
      console.log('[AuthContext] refreshAuth start');
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

      console.log('[AuthContext] effectiveUser', {
        hasUser: !!effectiveUser,
        userId: effectiveUser?.id,
      });

      setUser(effectiveUser);

      if (!effectiveUser) {
        setProfile(null);
        setBusiness(null);
        setIsAdmin(false);
        setLoading(false);
        console.log('[AuthContext] No user after getUser, stopping refreshAuth');
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
        console.log('[AuthContext] profile query result', {
          hasProfile: !!userProfile,
          error: profileError?.message || null,
        });

        if (profileError) {
          console.error('[AuthContext] Error fetching profile:', profileError);
          // User is authenticated even if profile fetch fails
          setProfile(null);
          setIsAdmin(false);
          setBusiness(null);
        } else if (userProfile) {
          console.log('[AuthContext] Profile fetched:', {
            email: userProfile.email,
            business_id: userProfile.business_id,
            is_super_admin: userProfile.is_super_admin
          });
          setProfile(userProfile);
          const adminStatus = userProfile.is_super_admin ?? false;
          setIsAdmin(adminStatus);

          if (userProfile.business_id) {
            try {
              // Add timeout to business fetch too
              const businessPromise = getCurrentBusiness();
              const businessTimeoutPromise = new Promise<Business | null>((resolve) =>
                setTimeout(() => resolve(null), 5000)
              );
              const userBusiness = await Promise.race([businessPromise, businessTimeoutPromise]);
              console.log('[AuthContext] Business fetched:', {
                name: userBusiness?.name,
                id: userBusiness?.id,
              });
              setBusiness(userBusiness);
            } catch (businessError) {
              console.error('[AuthContext] Error fetching business:', businessError);
              setBusiness(null);
            }
          } else {
            console.warn('[AuthContext] Profile has no business_id:', userProfile.email);
            setBusiness(null);
          }
        } else {
          console.warn('[AuthContext] No profile found for user:', effectiveUser.id);
        }
      } catch (profileErr) {
        console.error('Error in profile fetch:', profileErr);
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
      setLoading(false);
      console.log('[AuthContext] refreshAuth end', {
        hasUser: !!user,
        hasProfile: !!profile,
        hasBusiness: !!business,
      });
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
        console.log('[AuthContext] onAuthStateChange', {
          event,
          hasSession: !!session,
          userId: session?.user?.id,
        });

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setBusiness(null);
          setIsAdmin(false);
          setIsImpersonating(false);
          setImpersonatingBusinessName(null);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
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
