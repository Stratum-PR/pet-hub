import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
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
import { ClientPlaceholder } from "@/pages/ClientPlaceholder";
import Index from "@/pages/Index";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { AdminBusinessDetail } from "@/pages/AdminBusinessDetail";
import { ImpersonateHandler } from "@/pages/ImpersonateHandler";
import NotFound from "./pages/NotFound";
import { ThemeGuard } from "@/components/ThemeGuard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="pet-hub-theme">
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
          <BrowserRouter>
            <ThemeGuard />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/registrarse" element={<Register />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/cliente" element={<ClientPlaceholder />} />
              <Route path="/signup/success" element={<SignupSuccess />} />

              {/* Business Routes (header-based app) */}
              <Route
                path="/:businessSlug/*"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />

              {/* Admin Portal Routes */}
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute requireAdmin>
                    <Routes>
                      <Route path="/" element={<AdminDashboard />} />
                      <Route path="/businesses/:id" element={<AdminBusinessDetail />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />

              {/* Impersonation Handler */}
              <Route
                path="/admin/impersonate/:token"
                element={<ImpersonateHandler />}
              />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
