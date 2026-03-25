import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { setImpersonation } from '@/lib/auth';
import { toast } from 'sonner';
import { PawLoadedContent } from '@/components/PawLoadedContent';

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
        .select('id, name, slug')
        .eq('id', data)
        .single();

      if (businessError || !business) {
        throw new Error('Business not found');
      }

      // Set impersonation in sessionStorage
      setImpersonation(business.id, business.name);

      const slug = business.slug?.trim();
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

  return (
    <PawLoadedContent
      loading={loading}
      loaderLabel="Validating token"
      loaderWrapperClassName="min-h-screen"
    >
      {error ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <div className="text-destructive mb-4 text-2xl">⚠️</div>
            <h1 className="mb-2 text-2xl font-bold">Impersonation Failed</h1>
            <p className="mb-4 text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground">Redirecting to admin dashboard...</p>
          </div>
        </div>
      ) : null}
    </PawLoadedContent>
  );
}
