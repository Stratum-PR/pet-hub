import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { setImpersonation } from '@/lib/auth';
import { toast } from 'sonner';
import { PawLoadedContent } from '@/components/PawLoadedContent';
import { devConsole } from '@/lib/clientDebug';
import { t } from '@/lib/translations';

/** One-time tokens + React 18 Strict Mode double-mount: dedupe redemption per token in-session. */
const impersonationRedemptionByToken = new Map<string, Promise<void>>();

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

    let cancelled = false;

    const run = async () => {
      let p = impersonationRedemptionByToken.get(token);
      if (!p) {
        p = (async () => {
          const { data, error: functionError } = await supabase.rpc('use_impersonation_token', {
            impersonation_token: token,
          });

          if (functionError) {
            throw new Error(functionError.message);
          }

          if (!data) {
            throw new Error('Invalid token');
          }

          const { data: business, error: businessError } = await supabase
            .from('businesses')
            .select('id, name, slug')
            .eq('id', data)
            .single();

          if (businessError || !business) {
            throw new Error('Business not found');
          }

          setImpersonation(business.id, business.name);

          const slug = business.slug?.trim();
          toast.success(`Impersonating ${business.name}`);
          if (slug) {
            navigate(`/${slug}/dashboard`);
          } else {
            navigate('/');
          }
        })().finally(() => {
          impersonationRedemptionByToken.delete(token);
        });
        impersonationRedemptionByToken.set(token, p);
      }

      try {
        await p;
      } catch (err: unknown) {
        if (!cancelled) {
          devConsole.error('Impersonation error:', err);
          const userMessage = t('common.genericError');
          setError(userMessage);
          toast.error(userMessage, { id: `impersonate-fail-${token}` });
          setTimeout(() => {
            navigate('/admin');
          }, 3000);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return (
    <PawLoadedContent
      loading={loading}
      loaderLabel="Validating token"
      loaderWrapperClassName="min-h-screen"
    >
      {error ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 text-2xl text-destructive">⚠️</div>
            <h1 className="mb-2 text-2xl font-bold">Impersonation Failed</h1>
            <p className="mb-4 text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground">Redirecting to admin dashboard...</p>
          </div>
        </div>
      ) : null}
    </PawLoadedContent>
  );
}
