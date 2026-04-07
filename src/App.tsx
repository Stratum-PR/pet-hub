import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { DEMO_WORKSPACE_SLUG } from "@/lib/demoWorkspace";
import { DemoLegacyRedirect } from "@/components/DemoLegacyRedirect";
import { DemoAwareThemeProvider } from "@/components/DemoAwareThemeProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BusinessLayout } from "@/components/BusinessLayout";
import { Landing } from "@/pages/Landing";
import { Pricing } from "@/pages/Pricing";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { AuthCallback } from "@/pages/AuthCallback";
import { SignupSuccess } from "@/pages/SignupSuccess";
import Index from "@/pages/Index";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { ImpersonateHandler } from "@/pages/ImpersonateHandler";
import NotFound from "./pages/NotFound";
import { ThemeGuard } from "@/components/ThemeGuard";
import { NoIndexForProtectedRoutes } from "@/components/NoIndexForProtectedRoutes";
import AcceptInvitation from "@/pages/employee/AcceptInvitation";
import EmployeeProfile from "@/pages/employee/EmployeeProfile";
import { EmployeeLegacyRedirect } from "@/pages/employee/EmployeeLegacyRedirect";
import { EmployeePortalRoute } from "@/components/employee/EmployeePortalRoute";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { ClientPortalPublicPage } from "@/pages/ClientPortalPublicPage";
import { ClientDirectoryPage } from "@/pages/ClientDirectoryPage";
import { useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

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
          <DemoAwareThemeProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
            <NoIndexForProtectedRoutes />
            <ThemeGuard />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/registrarse" element={<Register />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/portal" element={<ClientPortalPublicPage />} />
              <Route path="/cliente" element={<Navigate to="/portal" replace />} />
              <Route path="/signup/success" element={<SignupSuccess />} />
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
              <Route path="/:businessSlug/register" element={<Navigate to="/registrarse" replace />} />
              <Route
                path="/:businessSlug/portal"
                element={<ClientPortalPublicPage />}
              />
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
            </TooltipProvider>
          </DemoAwareThemeProvider>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
