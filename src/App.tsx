import { lazy, Suspense, type ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { DEMO_WORKSPACE_SLUG } from "@/lib/demoWorkspace";
import { DemoAwareThemeProvider } from "@/components/DemoAwareThemeProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import { WaitlistModalProvider } from "@/contexts/WaitlistModalContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BusinessLayout } from "@/components/BusinessLayout";
import { Landing } from "@/pages/Landing";
import { Login } from "@/pages/Login";
import NotFound from "./pages/NotFound";
import { ThemeGuard } from "@/components/ThemeGuard";
import { NoIndexForProtectedRoutes } from "@/components/NoIndexForProtectedRoutes";
import { EmployeePortalRoute } from "@/components/employee/EmployeePortalRoute";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { CookieConsentBar } from "@/components/cookies/CookieConsentBar";
import { useAuth } from "@/contexts/AuthContext";
import { RouteFallback } from "@/components/RouteFallback";

/**
 * P4-01: route code splitting. After a redeploy, a tab still running the old index.html asks for
 * old hashed chunk names that no longer exist. On a failed chunk import, reload the page once so
 * the browser picks up the new build; if it fails again within a minute (offline, or a real
 * error), the error reaches GlobalErrorBoundary as it did before.
 */
const CHUNK_RELOAD_KEY = "grumi:chunk-reload-at";
const CHUNK_RELOAD_WINDOW_MS = 60_000;

function lazyRoute<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((err: unknown) => {
      let lastReload = 0;
      try {
        lastReload = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0;
        if (Date.now() - lastReload <= CHUNK_RELOAD_WINDOW_MS) throw err;
        window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
      } catch {
        // Already reloaded recently, or storage is blocked (can't detect a reload loop): give up.
        throw err;
      }
      window.location.reload();
      // Keep the fallback on screen until the reload replaces the page.
      return new Promise<{ default: T }>(() => {});
    })
  );
}

const named = <K extends string, T extends ComponentType<object>>(key: K) => (m: Record<K, T>) => ({ default: m[key] });

// Eager (first paint and shell): Landing ("/"), Login (staff entry point), NotFound, the redirect
// components and route guards. Every other page loads on demand; the whole business app (Index and
// everything it imports) is one lazy chunk until Index.tsx itself splits its routes.
const Index = lazyRoute(() => import("@/pages/Index"));
// Lazy because it statically imports Index (an eager import here would pull Index back into main).
const DemoLegacyRedirect = lazyRoute(() =>
  import("@/components/DemoLegacyRedirect").then(named("DemoLegacyRedirect"))
);
const AdminDashboard = lazyRoute(() => import("@/pages/AdminDashboard").then(named("AdminDashboard")));
const ImpersonateHandler = lazyRoute(() => import("@/pages/ImpersonateHandler").then(named("ImpersonateHandler")));
const PublicBookingPage = lazyRoute(() => import("@/pages/PublicBookingPage").then(named("PublicBookingPage")));
const ClientPortalPublicPage = lazyRoute(() =>
  import("@/pages/ClientPortalPublicPage").then(named("ClientPortalPublicPage"))
);
const ClientDirectoryPage = lazyRoute(() => import("@/pages/ClientDirectoryPage").then(named("ClientDirectoryPage")));
const Register = lazyRoute(() => import("@/pages/Register").then(named("Register")));
const AuthCallback = lazyRoute(() => import("@/pages/AuthCallback").then(named("AuthCallback")));
const ResetPasswordPage = lazyRoute(() => import("@/pages/ResetPassword").then(named("ResetPassword")));
const SignupSuccess = lazyRoute(() => import("@/pages/SignupSuccess").then(named("SignupSuccess")));
const WaitlistConfirmed = lazyRoute(() => import("@/pages/WaitlistConfirmed").then(named("WaitlistConfirmed")));
const AcceptInvitation = lazyRoute(() => import("@/pages/employee/AcceptInvitation"));
const EmployeeProfile = lazyRoute(() => import("@/pages/employee/EmployeeProfile"));
const EmployeeLegacyRedirect = lazyRoute(() =>
  import("@/pages/employee/EmployeeLegacyRedirect").then(named("EmployeeLegacyRedirect"))
);
const Pricing = lazyRoute(() => import("@/pages/Pricing").then(named("Pricing")));
const WhyGrumi = lazyRoute(() => import("@/pages/WhyGrumi").then(named("WhyGrumi")));
const Contact = lazyRoute(() => import("@/pages/Contact").then(named("Contact")));
const TermsOfService = lazyRoute(() => import("@/pages/legal/TermsOfService").then(named("TermsOfService")));
const WebsiteTerms = lazyRoute(() => import("@/pages/legal/WebsiteTerms").then(named("WebsiteTerms")));
const PrivacyPolicy = lazyRoute(() => import("@/pages/legal/PrivacyPolicy").then(named("PrivacyPolicy")));
const CookieNotice = lazyRoute(() => import("@/pages/legal/CookieNotice").then(named("CookieNotice")));

const queryClient = new QueryClient();
const isLocalHostSignupEnabled =
  typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

function LegacyBusinessLoginRoute() {
  const { businessSlug } = useParams<{ businessSlug?: string }>();
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user?.id && businessSlug) {
    return <Navigate to={`/portal?business=${encodeURIComponent(businessSlug)}`} replace />;
  }

  if (businessSlug) {
    return <Navigate to={`/login?business=${encodeURIComponent(businessSlug)}`} replace />;
  }

  return <Navigate to="/login" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    {!isSupabaseConfigured && (
      <div
        role="alert"
        className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive"
      >
        <strong className="font-semibold">Configuration error:</strong> Supabase variables were not set at build
        time. Set{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">VITE_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">VITE_SUPABASE_PUBLISHABLE_KEY</code> in
        your deployment environment, then redeploy.
      </div>
    )}
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <CookieConsentProvider>
            <WaitlistModalProvider>
            <DemoAwareThemeProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
            <NoIndexForProtectedRoutes />
            <ThemeGuard />
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/why-grumi" element={<WhyGrumi />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/website-terms" element={<WebsiteTerms />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/cookie-notice" element={<CookieNotice />} />
              <Route path="/login" element={<Login />} />
              <Route path="/registrarse" element={isLocalHostSignupEnabled ? <Register /> : <Navigate to="/" replace />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/portal" element={<ClientPortalPublicPage />} />
              <Route path="/cliente" element={<Navigate to="/portal" replace />} />
              <Route path="/signup/success" element={<SignupSuccess />} />
              <Route path="/waitlist/confirmed" element={<WaitlistConfirmed />} />
              <Route path="/employee/accept-invitation" element={<AcceptInvitation />} />
              <Route path="/employee/hub" element={<EmployeeLegacyRedirect />} />
              <Route element={<EmployeePortalRoute />}>
                <Route path="/employee/profile" element={<EmployeeProfile />} />
              </Route>

              {/* Legacy public demo paths → canonical slug */}
              <Route path="/demo" element={<Navigate to={`/${DEMO_WORKSPACE_SLUG}/dashboard`} replace />} />
              <Route path="/demo/*" element={<DemoLegacyRedirect />} />

              {/* Legacy business-scoped auth routes: canonicalize to root auth */}
              <Route path="/:businessSlug/login" element={<LegacyBusinessLoginRoute />} />
              <Route
                path="/:businessSlug/register"
                element={isLocalHostSignupEnabled ? <Navigate to="/registrarse" replace /> : <Navigate to="/" replace />}
              />
              <Route
                path="/:businessSlug/portal"
                element={<ClientPortalPublicPage />}
              />
              {/* Public booking page: clients request an appointment (arrives as pending). */}
              <Route path="/:businessSlug/reservar" element={<PublicBookingPage />} />
              <Route
                path="/directorio"
                element={<ClientDirectoryPage />}
              />

              {/* Business Routes (header-based app) */}
              <Route
                path="/:businessSlug/*"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />

              {/* Impersonation (must be before /admin/* so the splat does not consume this path) */}
              <Route path="/admin/impersonate/:token" element={<ImpersonateHandler />} />

              {/* Admin Portal Routes */}
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute requireAdmin>
                    <Routes>
                      <Route path="/" element={<AdminDashboard />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </TooltipProvider>
            <CookieConsentBar />
          </DemoAwareThemeProvider>
            </WaitlistModalProvider>
          </CookieConsentProvider>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
