import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { setImpersonation } from '@/lib/auth';
import { slugify } from '@/lib/authRouting';
import { toast } from 'sonner';

export function ImpersonateHandler() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No token provided');
      setLoading(false);
      return;
    }

    handleImpersonation();
  }, [token]);

  const handleImpersonation = async () => {
    try {
      // Call database function to use the token
      const { data, error: functionError } = await supabase.rpc('use_impersonation_token', {
        impersonation_token: token,
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data) {
        throw new Error('Invalid token');
      }

      // Get business name
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('id', data)
        .single();

      if (businessError || !business) {
        throw new Error('Business not found');
      }

      // Set impersonation in sessionStorage
      setImpersonation(business.id, business.name);

      // Redirect to business dashboard with slug URL (use stored slug when available)
      const slug = (business as { slug?: string | null }).slug?.trim() || slugify(business.name);

      toast.success(`Impersonating ${business.name}`);
      if (slug) {
        navigate(`/${slug}/dashboard`);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error('Impersonation error:', err);
      setError(err.message || 'Failed to validate impersonation token');
      toast.error(err.message || 'Invalid or expired token');
      
      // Redirect to admin after a delay
      setTimeout(() => {
        navigate('/admin');
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Validating token...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-destructive text-2xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Impersonation Failed</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting to admin dashboard...</p>
        </div>
      </div>
    );
  }

  return null;
}
