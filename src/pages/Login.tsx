import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, loading: authLoading } = useAuth();

  /**
   * Low-level password login that talks directly to the Supabase REST auth endpoint.
   * This avoids any hanging behaviour in supabase-js and gives us full control.
   */
  const passwordLogin = async (loginEmail: string, loginPassword: string) => {
    try {
      if (!SUPABASE_URL || ! SUPABASE_KEY) {
        toast.error('Supabase environment variables are missing.');
        return false;
      }

      // Prefer supabase-js first (best compatibility with storage/persistence).
      // If it hangs in this environment, fall back to REST token.
      try {
        const signInPromise = supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        });
        const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('signInWithPassword timeout') }), 4000)
        );
        const { data, error } = await Promise.race([signInPromise, timeoutPromise]);
        if (!error) {
          console.log('[Login] signInWithPassword success', data);
          return true;
        }
        console.warn('[Login] signInWithPassword failed/timeout, falling back to REST:', error);
      } catch (err) {
        console.warn('[Login] signInWithPassword threw, falling back to REST:', err);
      }

      const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        console.error('[Login] REST auth error', { status: response.status, errorBody });
        const message =
          errorBody?.error_description ||
          errorBody?.msg ||
          errorBody?.message ||
          `Login failed with status ${response.status}`;
        toast.error(message);
        return false;
      }

      const json = await response.json();
      console.log('[Login] REST auth success', json);

      const { access_token, refresh_token, user } = json;

      if (!access_token || !refresh_token || !user) {
        toast.error('Supabase did not return a valid session.');
        return false;
      }

      // Tell supabase-js about this session so the rest of the app uses it.
      // Try to persist it, but don't block login if this takes too long in some environments.
      const setSessionPromise = supabase.auth.setSession({ access_token, refresh_token });
      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('setSession timeout') }), 8000)
      );
      const { data, error } = await Promise.race([setSessionPromise, timeoutPromise]);
      if (error) {
        console.warn('[Login] setSession did not confirm in time; continuing anyway:', error);
        // Wait a bit before redirect to give storage time to persist
        await new Promise(resolve => setTimeout(resolve, 500));
        return true;
      }
      console.log('[Login] setSession success', data);
      
      // Wait a moment for Supabase to fully persist the session before redirect
      await new Promise(resolve => setTimeout(resolve, 1000));

      return true;
    } catch (err: any) {
      console.error('[Login] passwordLogin unexpected error', err);
      toast.error(err?.message || 'Unexpected error during login.');
      return false;
    }
  };

  // If already authenticated, don't show login screen; send to correct portal.
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    if (next) {
      navigate(next, { replace: true });
      return;
    }

    if (isAdmin) {
      navigate('/admin', { replace: true });
      return;
    }

    // If a business slug is already in the URL, keep them inside it; otherwise default to demo/dashboard
    navigate('/demo/dashboard', { replace: true });
  }, [authLoading, user, isAdmin, location.search, navigate]);

  const getRedirectPath = async (userEmail: string): Promise<string> => {
    // Hard-coded redirects for now so demo & admin always work
    if (userEmail === 'demo@pawsomegrooming.com') {
      return '/demo/dashboard';
    }

    if (userEmail === 'tech@stratumpr.com') {
      // Super admin portal
      return '/admin';
    }

    if (userEmail === 'g.rodriguez@stratumpr.com') {
      // Pet Esthetic business user
      return '/pet-esthetic/dashboard';
    }

    // Default fallback
    return '/';
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    
    try {
      console.log('[Login] demo start');

      const demoEmail = 'demo@pawsomegrooming.com';
      const ok = await passwordLogin(demoEmail, 'DemoPassword123!');
      if (ok) {
        toast.success('Welcome to the demo!');
        const redirect = await getRedirectPath(demoEmail);
        console.log('[Login] Demo redirecting to:', redirect);
        window.location.href = redirect;
      } else {
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Demo login error:', error);
      toast.error(error.message || 'Failed to sign in to demo');
      setLoading(false);
    }
  };

  // Auto-trigger demo login when coming from landing page with ?demo=1
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === '1' && !loading) {
      handleDemoLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('[Login] handleLogin start', { email });

      const ok = await passwordLogin(email, password);
      if (ok) {
        toast.success('Signed in successfully');
        const redirect = await getRedirectPath(email);
        console.log('[Login] Redirecting to:', redirect);
        window.location.href = redirect;
      }
    } catch (error: any) {
      console.error('[Login] Unexpected error:', error);
      toast.error(error.message || 'Unexpected error during sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/stratum hub logo.svg" alt="Stratum Hub" className="h-12" />
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Demo Button */}
          <div className="mt-6">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleDemoLogin}
              disabled={loading}
            >
              View Demo
            </Button>
          </div>

          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/pricing" className="text-primary hover:underline">
                Start your free trial
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
