import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { RouterFallback } from "@/components/RouterFallback";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthDebugFloater } from "@/components/AuthDebugFloater";
import { Landing } from "@/pages/Landing";
import { ClientHome } from "@/pages/ClientHome";
import { Pricing } from "@/pages/Pricing";
import { Login } from "@/pages/Login";
import { SignupSuccess } from "@/pages/SignupSuccess";
import { Signup } from "@/pages/Signup";
import { CompleteBusiness } from "@/pages/CompleteBusiness";
import { AuthCallback } from "@/pages/AuthCallback";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { ResetPassword } from "@/pages/ResetPassword";
import Index from "@/pages/Index";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { AdminBusinessDetail } from "@/pages/AdminBusinessDetail";
import { ImpersonateHandler } from "@/pages/ImpersonateHandler";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// In iframe (e.g. Cursor/Lovable preview), use HashRouter to avoid getUrlBasedHistory errors.
// Otherwise use RouterFallback: tries BrowserRouter, falls back to HashRouter if it throws.
const InFrame = typeof window !== 'undefined' && window.self !== window.top;

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/client" element={<ClientHome />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/signup/manager" element={<Navigate to="/signup" replace />} />
      <Route path="/signup/complete-business" element={<CompleteBusiness />} />
      <Route path="/signup/success" element={<SignupSuccess />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/:businessSlug/*" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="/admin/*" element={<ProtectedRoute requireAdmin><Routes><Route path="/" element={<AdminDashboard />} /><Route path="/businesses/:id" element={<AdminBusinessDetail />} /><Route path="*" element={<NotFound />} /></Routes></ProtectedRoute>} />
      <Route path="/admin/impersonate/:token" element={<ImpersonateHandler />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthDebugFloater />
          {InFrame ? <HashRouter><AppRoutes /></HashRouter> : <RouterFallback><AppRoutes /></RouterFallback>}
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
