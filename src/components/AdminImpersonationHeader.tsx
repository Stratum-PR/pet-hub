import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, ArrowLeft } from 'lucide-react';
import { exitImpersonation, getImpersonatingBusinessName, isImpersonating } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';

export function AdminImpersonationHeader() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const impersonating = isImpersonating();
  const businessName = getImpersonatingBusinessName();

  // Only show if admin is impersonating
  if (!isAdmin || !impersonating || !businessName) return null;

  const handleExitImpersonation = () => {
    exitImpersonation();
  };

  const handleBackToAdmin = () => {
    exitImpersonation();
    navigate('/admin');
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] px-4 py-3 flex items-center justify-between text-sm font-semibold shadow-lg"
      style={{
        backgroundColor: '#F97316', // Orange warning color
        color: '#FFFFFF',
        borderBottom: '2px solid #EA580C',
      }}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5" />
        <span>
          ADMIN MODE - Impersonating: <strong>{businessName}</strong>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBackToAdmin}
          className="bg-white/20 hover:bg-white/30 text-white border-white/30"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Admin Panel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExitImpersonation}
          className="bg-white/20 hover:bg-white/30 text-white border-white/30"
        >
          <X className="w-4 h-4 mr-1" />
          Exit Impersonation
        </Button>
      </div>
    </div>
  );
}
